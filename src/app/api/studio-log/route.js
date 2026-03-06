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

export async function POST(req) {
  try {
    // நேராக JSON-ஆக படிக்கும் முறை (JSON Body Only)
    const body = await req.json();

    let phone = body.phone || body.To || body.From || "";
    const message = body.message || body.Body || "Automated Message";
    const twilioSID = body.twilioSid || body.MessageSid || "auto_" + Date.now();

    // WhatsApp prefix கட்டாயம் இருக்க வேண்டும்
    if (phone && !phone.startsWith("whatsapp:")) {
        phone = `whatsapp:${phone}`;
    }

    if (!phone) {
      console.log("❌ Missing Phone Number in JSON");
      return NextResponse.json({ error: "Missing phone" }, { status: 400 });
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

    const myTwilioNumber = process.env.NEXT_PUBLIC_TWILIO_PHONE_NUMBER || "Automated Bot";
    const timestamp = getFormattedDate();
    const isoTimestamp = new Date().toISOString();

    // 1. Google Sheet-ல் சேவ் செய்தல்
    await sheets.spreadsheets.values.append({
      spreadsheetId: MSG_SHEET_ID,
      range: `${SHEET_NAMES.MESSAGES}!A:L`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[
          myTwilioNumber, phone, message, "OUTBOUND", "DELIVERED", "TRUE",
          timestamp, twilioSID, "", "Twilio bot", "", ""
        ]]
      }
    });

    // 2. UI-க்கு லைவ்வாக அனுப்புதல்
    if (global.io) {
      global.io.emit("new_message", { 
          phone: phone, 
          message: message, 
          direction: "OUTBOUND", 
          timestamp: isoTimestamp, 
          status: "DELIVERED", 
          role: "bot", 
          name: "Automation Bot"
      });
    }

    // 3. Cache Clear
    if (redis && redis.status !== 'disabled') {
      try { await redis.del("chats:all_data"); } catch (e) { }
    }

    return NextResponse.json({ success: true, method: "POST (JSON)" });

  } catch (error) {
    console.error("Studio Log JSON Error:", error.message);
    // JSON பிழையாக இருந்தால் எரர் காட்டும்
    return NextResponse.json({ error: "Invalid JSON or Server Error: " + error.message }, { status: 500 });
  }
}