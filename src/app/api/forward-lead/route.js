import { google } from "googleapis";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import twilio from "twilio";
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
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { customerPhone, targetPhone, message, associateName } = await req.json();

    if (!customerPhone || !targetPhone) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

    // 1. Send WhatsApp to the Associate
    const myTwilioNumber = process.env.NEXT_PUBLIC_TWILIO_PHONE_NUMBER;
    try {
      const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      await client.messages.create({
        body: message, 
        from: myTwilioNumber, 
        to: targetPhone.startsWith("whatsapp:") ? targetPhone : `whatsapp:${targetPhone}`,
      });
    } catch (e) { console.error("Twilio Error", e); }

    // 2. Save to Google Sheets
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });
    const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID; 

    const timestamp = getFormattedDate(); // "MM/DD/YYYY HH:MM:SS"
    const forwardedBy = session.user.name;

    // Only update (append to) the Forwarded Sheet
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAMES.FORWARDED}!A:F`, 
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[ forwardedBy, customerPhone, message, associateName, timestamp, "FALSE" ]]
      }
    });

    // 3. Clear Redis Cache
    try { await redis.del("chats:all_data"); } catch (e) {}

    // 4. --- SOCKET.IO EMISSION (NEW) ---
    if (global.io) {
        const isoTimestamp = new Date().toISOString();
        
        // We emit a 'new_message' event.
        // By marking direction as 'INBOUND', the dashboard will treat it as a new notification.
        global.io.emit("new_message", {
            phone: customerPhone, 
            name: `Lead: ${customerPhone}`, // You can change this to look up the name if available
            message: `Lead Forwarded to ${associateName} by ${forwardedBy}`, 
            direction: "INBOUND", 
            timestamp: isoTimestamp,
            status: "RECEIVED",
            read: "FALSE",
            // Custom fields helpful for frontend logic
            isForwarded: true,
            forwardedBy: forwardedBy,
            assignedTo: associateName
        });
        console.log("📡 Socket Event Emitted: Lead Forwarded");
    }
    // ------------------------------------

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("Forward Lead Error:", error);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}