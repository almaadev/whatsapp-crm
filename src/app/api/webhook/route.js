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

async function appendWithRetry(sheets, params, retries = 3, delay = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      return await sheets.spreadsheets.values.append(params);
    } catch (error) {
      if ((error.code === 429 || error.code === 503) && i < retries - 1) {
        await new Promise(res => setTimeout(res, delay * (i + 1)));
        continue;
      }
      throw error;
    }
  }
}

async function updateWithRetry(sheets, params, retries = 3, delay = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      return await sheets.spreadsheets.values.update(params);
    } catch (error) {
      if ((error.code === 429 || error.code === 503) && i < retries - 1) {
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
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      body = await req.json();
    } else {
      const formData = await req.formData();
      body = Object.fromEntries(formData.entries());
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

    const twilioSID = body.MessageSid || body.SmsSid || body.Sid || "";
    const messageStatus = body.MessageStatus || body.SmsStatus || "";

    const statusTypes = ['sent', 'delivered', 'read', 'failed'];
    if (messageStatus && statusTypes.includes(messageStatus.toLowerCase())) {
      const formattedStatus = messageStatus.toUpperCase();

      if (global.io) {
        global.io.emit("message_status_update", {
          sid: twilioSID,
          status: formattedStatus
        });
      }

      const sidCheck = await sheets.spreadsheets.values.get({
        spreadsheetId: MSG_SHEET_ID,
        range: `${SHEET_NAMES.MESSAGES}!H:H`
      });

      const sidRows = sidCheck.data.values || [];
      const rowIndex = sidRows.findIndex(row => row[0] === twilioSID);

      if (rowIndex !== -1) {
        const sheetRowNumber = rowIndex + 1;
        await updateWithRetry(sheets, {
          spreadsheetId: MSG_SHEET_ID,
          range: `${SHEET_NAMES.MESSAGES}!E${sheetRowNumber}`,
          valueInputOption: "USER_ENTERED",
          requestBody: { values: [[formattedStatus]] }
        });
      }

      if (redis && redis.status !== 'disabled') {
        try { await redis.del("chats:all_data"); } catch (e) { }
      }

      return NextResponse.json({ success: true, updated: formattedStatus });
    }

    const rawFrom = body.from || body.From || "";
    const rawTo = body.to || body.To || "";
    const phone = rawFrom;
    const messageTo = rawTo;
    const message = body.body || body.Body || "";
    const numMedia = parseInt(body.numMedia || body.NumMedia || "0");
    const profileName = body.ProfileName || rawFrom;

    if (!phone) {
      return NextResponse.json({ error: "Invalid Request" }, { status: 400 });
    }

    const timestamp = getFormattedDate();
    const isoTimestamp = new Date().toISOString();

    if (redis && redis.status !== 'disabled') {
      try { await redis.del("chats:all_data"); } catch (e) { }
    }

    if (global.io) {
      global.io.emit("new_message", {
        phone: phone, message: message, direction: "INBOUND",
        timestamp: isoTimestamp, name: profileName || phone,
        status: "RECEIVED", read: "FALSE"
      });
    }

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
        requestBody: { values: [[phone, timestamp, "New"]] }
      });
    }

    const msgRows = [];
    const baseRow = [phone, messageTo, message, "INBOUND", "RECEIVED", "FALSE", timestamp, twilioSID, "", ""];

    if (numMedia > 0) {
      for (let i = 0; i < numMedia; i++) {
        msgRows.push([...baseRow, body[`MediaUrl${i}`] || "", body[`MediaContentType${i}`] || ""]);
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