import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSheetData, appendSheetData, updateSheetData, batchUpdateSheet } from "@/lib/googleSheets";
import { SHEET_NAMES } from "@/lib/constants";
import twilio from "twilio";

const nowStr = () => new Date().toISOString();

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();

    // --- 1. SET NEW REMINDER ---
    if (body.action === "SET") {
        const { phone, message, date, time } = body;
        const scheduledTime = new Date(`${date}T${time}`).toISOString();
        
        // Cancel any existing pending reminders for this phone first (Policy: One active reminder per lead)
        // ideally we should check, but appending is safer, we can filter latest.
        // For cleaner logic, let's mark previous PENDING as CANCELLED before adding new.
        
        // (Optional: You can skip this cleanup if you want multiple reminders)

        const row = [
            nowStr(),
            session.user.name,
            phone,
            message,
            scheduledTime,
            "PENDING"
        ];

        await appendSheetData(`${SHEET_NAMES.REMINDERS}!A:F`, [row]);
        return NextResponse.json({ success: true, message: "Reminder Set" });
    }

    // --- 2. GET ACTIVE REMINDER ---
    if (body.action === "GET") {
        const { phone } = body;
        const remindersData = await getSheetData(`${SHEET_NAMES.REMINDERS}!A:F`);
        
        // Find the latest PENDING reminder for this phone
        let activeReminder = null;
        
        // Loop backwards to find latest
        for (let i = remindersData.length - 1; i >= 0; i--) {
            const row = remindersData[i];
            if (row[2] === phone && row[5] === "PENDING") {
                activeReminder = {
                    date: row[4], // ScheduledTime
                    message: row[3],
                    associate: row[1]
                };
                break; 
            }
        }
        
        return NextResponse.json({ success: true, reminder: activeReminder });
    }

    // --- 3. CANCEL REMINDER ---
    if (body.action === "CANCEL") {
        const { phone } = body;
        const remindersData = await getSheetData(`${SHEET_NAMES.REMINDERS}!A:F`);
        const updates = [];

        // Find ALL PENDING reminders for this phone and Cancel them
        for (let i = 0; i < remindersData.length; i++) {
            const row = remindersData[i];
            if (row[2] === phone && row[5] === "PENDING") {
                // Update Column F (Index 5) to CANCELLED
                // Row in sheet is i + 1
                updates.push({
                    range: `${SHEET_NAMES.REMINDERS}!F${i + 1}`,
                    values: [["CANCELLED"]]
                });
            }
        }

        if (updates.length > 0) {
            await batchUpdateSheet(updates);
        }

        return NextResponse.json({ success: true, message: "Reminder Cancelled" });
    }

    // --- 4. CHECK & PROCESS DUE (Existing Logic) ---
    if (body.action === "CHECK") {
        const remindersData = await getSheetData(`${SHEET_NAMES.REMINDERS}!A:F`);
        const dueReminders = [];
        const now = new Date();
        const updates = [];

        const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        const myTwilioNumber = process.env.NEXT_PUBLIC_TWILIO_PHONE_NUMBER;

        for (let i = 0; i < remindersData.length; i++) {
            const row = remindersData[i];
            // Safe check for row length
            if (!row || row.length < 6) continue;

            const [createdAt, associate, phone, msg, scheduledTimeStr, status] = row;

            if (status === "PENDING" && scheduledTimeStr) {
                const scheduledTime = new Date(scheduledTimeStr);
                
                if (scheduledTime <= now) {
                    try {
                        await client.messages.create({
                            body: `[Reminder]: ${msg}`,
                            from: myTwilioNumber,
                            to: phone.startsWith("whatsapp:") ? phone : `whatsapp:${phone}`
                        });

                        const timestamp = new Date().toLocaleDateString("en-US") + " " + new Date().toLocaleTimeString("en-US", { hour12: false });
                        await appendSheetData(`${SHEET_NAMES.MESSAGES}!A:L`, [[
                            myTwilioNumber, phone, msg, "OUTBOUND", "SENT", "TRUE", 
                            timestamp, "reminder_auto", associate, "sales", "", ""
                        ]]);

                        // Collect update for batch
                        updates.push({
                            range: `${SHEET_NAMES.REMINDERS}!F${i + 1}`,
                            values: [["DONE"]]
                        });

                        dueReminders.push({ phone, message: msg, associate });

                    } catch (e) {
                        console.error("Reminder Send Failed", e);
                    }
                }
            }
        }

        if (updates.length > 0) {
            await batchUpdateSheet(updates);
        }

        return NextResponse.json({ success: true, processed: dueReminders });
    }

    return NextResponse.json({ error: "Invalid Action" }, { status: 400 });

  } catch (error) {
    console.error("Reminder API Error:", error);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}