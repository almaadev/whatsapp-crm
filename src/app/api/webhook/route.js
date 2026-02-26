import { google } from "googleapis";
import { NextResponse } from "next/server";
import redis from "@/lib/redis";
import { SHEET_NAMES } from "@/lib/constants"; 

const getFormattedDate = () => {
  const now = new Date();
  const date = now.toLocaleDateString("en-US", { year: 'numeric', month: 'numeric', day: 'numeric' });
  const time = now.toLocaleTimeString("en-US", { hour12: false });
  return `${date} ${time}`;
};

// --- HELPER: RETRY LOGIC FOR GOOGLE SHEETS ---
async function appendWithRetry(sheets, params, retries = 3, delay = 1000) {
    for (let i = 0; i < retries; i++) {
        try {
            return await sheets.spreadsheets.values.append(params);
        } catch (error) {
            if ((error.code === 429 || error.code === 503) && i < retries - 1) {
                console.warn(`⚠️ Google Sheet Busy (Attempt ${i + 1}). Retrying...`);
                await new Promise(res => setTimeout(res, delay * (i + 1)));
                continue;
            }
            throw error;
        }
    }
}

export async function POST(req) {
  try {
    let body;
    try {
        body = await req.json();
    } catch (e) {
        const formData = await req.formData();
        body = Object.fromEntries(formData.entries());
    }

    const rawFrom = body.from || body.From || "";
    const rawTo   = body.to   || body.To   || "";
    
    const phone     = rawFrom;
    const messageTo = rawTo;
    const message   = body.body || body.Body || "";
    const twilioSID = body.sid  || body.MessageSid || body.Sid || "";
    const numMedia  = parseInt(body.numMedia || body.NumMedia || "0");
    const profileName = body.ProfileName || "Unknown";

    if (!phone) {
      return NextResponse.json({ error: "Invalid Request: 'from' field missing" }, { status: 400 });
    }

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });
    const MSG_SHEET_ID = process.env.GOOGLE_SHEETS_ID;
    
    const timestamp = getFormattedDate();
    const isoTimestamp = new Date().toISOString(); 
    
    // --- REDIS CACHE INVALIDATION ---
    if (redis.status !== 'disabled') {
        try {
            await redis.del("chats:all_data");
        } catch (e) {
            console.error("Redis Clear Failed", e);
        }
    }
    
    // --- EMIT SOCKET EVENT (Real-time update) ---
    if (global.io) {
        global.io.emit("new_message", { 
            phone: phone, 
            message: message, 
            direction: "INBOUND", 
            timestamp: isoTimestamp,
            name: profileName || phone,
            status: "RECEIVED",
            read: "FALSE"
        });
        console.log("📡 Socket Event Emitted: INBOUND Message");
    }
    // ---------------------------------------------

    // Save New Customer Logic
    const userCheck = await sheets.spreadsheets.values.get({
      spreadsheetId: MSG_SHEET_ID,
      range: `${SHEET_NAMES.SHEET4}!A:A` 
    });

    const existingPhones = userCheck.data.values ? userCheck.data.values.flat() : [];
    
    if (!existingPhones.includes(phone)) {
      await appendWithRetry(sheets, {
        spreadsheetId: MSG_SHEET_ID,
        range: `${SHEET_NAMES.SHEET4}!A:D`,
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [[ phone, timestamp, "New" ]]
        }
      });
    }

    // Save Message Logic
    const msgRows = [];
    const baseRow = [
        phone, messageTo, message, "INBOUND", "RECEIVED", "FALSE", 
        timestamp, twilioSID, "", ""
    ];

    if (numMedia > 0) {
      for (let i = 0; i < numMedia; i++) {
        const mediaUrl  = body[`MediaUrl${i}`] || body[`mediaUrl${i}`] || "";
        const mediaType = body[`MediaContentType${i}`] || body[`mediaContentType${i}`] || "";
        msgRows.push([...baseRow, mediaUrl, mediaType]);
      }
    } else {
      msgRows.push([...baseRow, "", ""]);
    }

    if (msgRows.length > 0) {
        await appendWithRetry(sheets, {
            spreadsheetId: MSG_SHEET_ID,
            range: `${SHEET_NAMES.MESSAGES}!A:L`, 
            valueInputOption: "USER_ENTERED",
            requestBody: { values: msgRows }
        });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("Webhook Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}