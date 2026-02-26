import { google } from "googleapis";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SHEET_NAMES } from "@/lib/constants";
import redis from "@/lib/redis"; 

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { mobile, currentState } = await req.json();
    if (!mobile) return NextResponse.json({ error: "Mobile required" }, { status: 400 });

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
    const newState = currentState === "TRUE" ? "FALSE" : "TRUE";

    // ---------------------------------------------------------
    // 1. UPDATE MAIN "CONTACTS" SHEET (Column Q)
    // ---------------------------------------------------------
    const contactRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${SHEET_NAMES.CONTACTS}!C:C`, // Column C contains Mobile
    });
    const contactRows = contactRes.data.values || [];
    
    let contactRowIndex = -1;
    const cleanMobile = mobile.toString().trim();
    
    // Find LAST occurrence in Contacts
    for (let i = contactRows.length - 1; i >= 0; i--) {
        if (contactRows[i][0] && contactRows[i][0].toString().trim() === cleanMobile) {
            contactRowIndex = i;
            break;
        }
    }

    const updates = [];

    if (contactRowIndex !== -1) {
        const contactRowNumber = contactRowIndex + 1;
        // Update Column Q (Index 16) - IsClosed
        updates.push(
            sheets.spreadsheets.values.update({
                spreadsheetId,
                range: `${SHEET_NAMES.CONTACTS}!Q${contactRowNumber}`, 
                valueInputOption: "USER_ENTERED",
                requestBody: { values: [[newState]] }
            })
        );
    } else {
        console.warn("Contact not found in Contacts sheet");
    }

    // ---------------------------------------------------------
    // 2. UPDATE "FORWARDED" SHEET (Column F)
    // ---------------------------------------------------------
    const forwardedRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${SHEET_NAMES.FORWARDED}!B:B`, // Column B contains Mobile in Forwarded tab
    });
    const forwardedRows = forwardedRes.data.values || [];
    
    let forwardedRowIndex = -1;
    
    // Find LAST occurrence in Forwarded
    for (let i = forwardedRows.length - 1; i >= 0; i--) {
        if (forwardedRows[i][0] && forwardedRows[i][0].toString().trim() === cleanMobile) {
            forwardedRowIndex = i;
            break;
        }
    }

    if (forwardedRowIndex !== -1) {
        const forwardedRowNumber = forwardedRowIndex + 1;
        // Update Column F (Index 5) - IsClosed
        updates.push(
            sheets.spreadsheets.values.update({
                spreadsheetId,
                range: `${SHEET_NAMES.FORWARDED}!F${forwardedRowNumber}`, 
                valueInputOption: "USER_ENTERED",
                requestBody: { values: [[newState]] }
            })
        );
    }

    // Execute all updates
    if (updates.length > 0) {
        await Promise.all(updates);
    }

    try { await redis.del("chats:all_data"); } catch (e) {}

    return NextResponse.json({ success: true, newState });

  } catch (error) {
    console.error("Update Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}