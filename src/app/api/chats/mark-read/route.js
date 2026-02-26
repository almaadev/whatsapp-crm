import { google } from "googleapis";
import { NextResponse } from "next/server";
import redis from "@/lib/redis";
import { SHEET_NAMES } from "@/lib/constants";
const CHAT_CACHE_KEY = "chats:all_data";

export async function POST(req) {
  try {
    const { phone } = await req.json();
    if (!phone) return NextResponse.json({ error: "Phone required" }, { status: 400 });

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
    
    const sheetRes = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${SHEET_NAMES.MESSAGES}!A:A`, 
    });
    
    const rows = sheetRes.data.values || [];

    if (redis.status === 'ready') {
        try {
            const cachedData = await redis.get(CHAT_CACHE_KEY);
            if (cachedData) {
                let chats = JSON.parse(cachedData);
                
                // Update the specific chat in cache
                chats = chats.map(c => {
                    if (c.phone === phone) {
                        return { ...c, read: "TRUE" }; // Force Read
                    }
                    return c;
                });

                // Save back to Redis
                await redis.set(CHAT_CACHE_KEY, JSON.stringify(chats), "EX", 600); // 10 mins
            }
        } catch (e) {
            console.error("Redis Mark-Read Error", e);
        }
    }
    
    (async () => {
        try {
            // Fetch A (Sender) and F (Read)
            const data = await sheets.spreadsheets.values.get({
                spreadsheetId,
                range: `${SHEET_NAMES.MESSAGES}!A:F`
            });
            
            const rows = data.data.values || [];
            const rangesToUpdate = [];
            
            rows.forEach((row, index) => {
                // row[0] is Sender (Phone), row[3] is Direction, row[5] is Read
                if (row[0] === phone && row[3] === "INBOUND" && row[5] === "FALSE") {
                    rangesToUpdate.push({
                        range: `${SHEET_NAMES.MESSAGES}!F${index + 1}`,
                        values: [["TRUE"]]
                    });
                }
            });

            if (rangesToUpdate.length > 0) {
                await sheets.spreadsheets.values.batchUpdate({
                    spreadsheetId,
                    requestBody: {
                        data: rangesToUpdate,
                        valueInputOption: "USER_ENTERED"
                    }
                });
            }
        } catch (err) {
            console.error("Sheet Update Background Fail:", err);
        }
    })();

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("Mark Read Error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}