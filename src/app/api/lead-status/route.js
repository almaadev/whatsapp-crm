import { NextResponse } from "next/server";
import { getSheetData, batchUpdateSheet, updateSheetData, appendSheetData } from "@/lib/googleSheets";
import { SHEET_NAMES } from "@/lib/constants";
import redis from "@/lib/redis";

export async function POST(req) {
  try {
    const { phone, status, associateEmail, associateName, notes, priority } = await req.json();
    const contactData = await getSheetData(`${SHEET_NAMES.CONTACTS}!A:Q`);
    
    let contactIndex = -1;
    let lastRowData = null;
    const cleanPhone = phone.toString().trim();

    for (let i = contactData.length - 1; i >= 0; i--) {
        if (contactData[i][2]?.toString().trim() === cleanPhone) {
            contactIndex = i;
            lastRowData = contactData[i];
            break;
        }
    }


    const isPreviouslyClosed = lastRowData && (lastRowData[16] === 'TRUE' || lastRowData[7] === 'Closed');
    const isReopening = status !== 'Closed' && status !== 'Not Interested';

    if (contactIndex !== -1 && isPreviouslyClosed && isReopening) {
        
        const now = new Date();
        const todayFormatted = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;

        const newRow = [
            todayFormatted,                 // A: Date (New)
            lastRowData[1] || "",           // B: Name (Copy)
            cleanPhone,                     // C: Phone (Copy)
            lastRowData[3] || "",           // D: City (Copy)
            associateName,                  // E: Handler (New)
            lastRowData[5] || "Re-entry",   // F: Source (Copy)
            lastRowData[6] || "",           // G: EnqFor (Copy)
            status,                         // H: Status (New)
            "0",                            // I: SaleAmount (Reset)
            notes || "",                    // J: Remarks (New)
            status === "Closed" ? associateName : "",                             // K: LastClosedBy
            status === "Follow Up" ? new Date().toISOString().split('T')[0] : "", // L: FollowUpStart
            "", "", "",                     // M, N, O: Days
            priority || "",              // P: Priority
            "FALSE"                         // Q: IsClosed (Reset)
        ];

        await appendSheetData(`${SHEET_NAMES.CONTACTS}!A:Q`, [newRow]);

    } else if (contactIndex !== -1) {
      // >> UPDATE EXISTING ROW (Normal Flow)
      const row = contactIndex + 1;
      const updates = [];

      if (status === "Follow Up") {
          // Check Start Date in Col L (Index 11) 
          // Note: contactData is 0-indexed, so row-1
          let startDate = contactData[contactIndex][11];

          if (!startDate) {
              startDate = new Date().toISOString().split('T')[0];
              updates.push({ range: `${SHEET_NAMES.CONTACTS}!L${row}`, values: [[startDate]] });
          }

          const start = new Date(startDate);
          const now = new Date();
          const dayDiff = Math.floor((now - start) / (1000 * 60 * 60 * 24));

          let targetCol = "";
          if (dayDiff <= 1) targetCol = "M";      
          else if (dayDiff === 2) targetCol = "N"; 
          else if (dayDiff >= 3) targetCol = "O";  

          if (targetCol && notes) {
             updates.push({ range: `${SHEET_NAMES.CONTACTS}!${targetCol}${row}`, values: [[notes]] });
          }
          if (priority) {
              updates.push({ range: `${SHEET_NAMES.CONTACTS}!P${row}`, values: [[priority]] });
          }

      } else {
          // Clear Follow Up Columns
          updates.push({ range: `${SHEET_NAMES.CONTACTS}!M${row}:P${row}`, values: [["", "", "", ""]] });
          
          // Only uncheck closed if we are NOT closing (and not re-registering)
          if (status !== "Closed") {
             updates.push({ range: `${SHEET_NAMES.CONTACTS}!Q${row}`, values: [["FALSE"]] });
          }
      }

      if (status === "Closed") {
          updates.push({ range: `${SHEET_NAMES.CONTACTS}!Q${row}`, values: [["TRUE"]] });
      }

      if (notes) updates.push({ range: `${SHEET_NAMES.CONTACTS}!J${row}`, values: [[notes]] });
      updates.push({ range: `${SHEET_NAMES.CONTACTS}!E${row}`, values: [[associateName]] });
      updates.push({ range: `${SHEET_NAMES.CONTACTS}!H${row}`, values: [[status]] });

      if (updates.length > 0) {
          await batchUpdateSheet(updates);
      }
    }

    // Target Logic (Users Sheet) - Increment Closed Count
    if (status === "Closed" && associateEmail) {
        const userRows = await getSheetData(`${SHEET_NAMES.USERS}!A:G`);
        const userIndex = userRows.findIndex(r => r[1] === associateEmail);

        if (userIndex !== -1) {
            const currentAchieved = parseInt(userRows[userIndex][6] || "0");
            await updateSheetData(`${SHEET_NAMES.USERS}!G${userIndex + 1}`, [[currentAchieved + 1]]);
        }
    }

    await redis.del("chats:all_data");
    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("Status Update Error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}