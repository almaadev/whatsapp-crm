import { google } from "googleapis";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import redis from "@/lib/redis";
import { SHEET_NAMES, CONTACT_COLUMNS } from "@/lib/constants";
import { getSheetData, appendSheetData, updateSheetData } from "@/lib/googleSheets";

const getFormattedDate = () => {
  const now = new Date();
  const date = now.toLocaleDateString("en-US", { year: 'numeric', month: 'numeric', day: 'numeric' });
  const time = now.toLocaleTimeString("en-US", { hour12: false });
  return `${date} ${time}`;
};

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();

    // Support both 'phone' (new form) and 'mobile' (legacy)
    const mobile = body.phone || body.mobile;
    const {
      name, city, associate, source,
       enquiredFor,
      status, saleAmount, remarks,
      priority,
      day1Remarks, day2Remarks, day3Remarks,
      checkDuplicates
    } = body;

    if (!mobile) return NextResponse.json({ error: "Mobile number is required" }, { status: 400 });

    // --- 0. DUPLICATE CHECK (Only if requested - for new leads) ---
    if (checkDuplicates) {
      try {
        const contactRows = await getSheetData(`${SHEET_NAMES.CONTACTS}!C:C`);
        const existingPhones = contactRows ? contactRows.flat() : [];

        const cleanPhone = mobile.toString().trim();
        const exists = existingPhones.some(p => {
          const pStr = p?.toString().trim();
          return pStr === cleanPhone || pStr === `whatsapp:${cleanPhone}`;
        });

        if (exists) {
          return NextResponse.json({ error: "Lead already exists" }, { status: 409 });
        }
      } catch (e) {
        console.warn("Duplicate check failed", e);
      }
    }

    const now = new Date();
    const timestamp = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;
    const currentUser = associate || session.user.name;

    // --- 1. ALWAYS SAVE TO SHEET4 (Customers Dump) ---
    // Only if it's a new entry (not an update from CustomerInfoPanel)
    // We can infer it's a new entry if checkDuplicates is true, OR we can just always append to Sheet4 log
    const sheet4Row = [mobile, timestamp, "New", currentUser];
    await appendSheetData(`${SHEET_NAMES.SHEET4}!A:D`, [sheet4Row]);

    // --- 2. PREPARE CONTACTS DATA ---
   
    const finalPriority = priority || "Low";

    // Check if we have enough data to create a full contact entry
    const hasExtraData = (name && name.trim()) ||
      (city && city.trim()) ||
      (enquiredFor && enquiredFor.trim()) ||
      (remarks && remarks.trim()) ||
      (status && status !== "New");

    if (!hasExtraData && !day1Remarks && !day2Remarks && !day3Remarks) {
      return NextResponse.json({ success: true, mode: "Saved to Sheet4 Only" });
    }

    let rows = [];
    try {
      rows = await getSheetData(`${SHEET_NAMES.CONTACTS}!A:Q`);
    } catch (error) {
      console.warn("Contacts sheet read error");
    }

    // Find all rows matching this mobile number
    const matchingRowsIndices = [];
    rows.forEach((row, index) => {
      if (row[2] && row[2].toString().trim() === mobile.toString().trim()) {
        matchingRowsIndices.push(index);
      }
    });

    let rowIndexToUpdate = -1;
    let createNew = true;

    if (matchingRowsIndices.length > 0) {
      const lastIndex = matchingRowsIndices[matchingRowsIndices.length - 1];
      const lastRow = rows[lastIndex];
      const currentStatus = lastRow[7] || "New"; // Index 7 is Status


      if (currentStatus === "Closed" || currentStatus === "Not Closed") {
        createNew = true;
      } else {
        createNew = false;
        rowIndexToUpdate = lastIndex;
      }
    }


    const contactRowData = [
      timestamp,                // A: Date
      name || "",               // B: Name
      mobile,                   // C: Phone
      city || "",               // D: City
      currentUser,              // E: Handler
      source || "Whatsapp",     // F: Source
      enquiredFor,            // G: Enquired For
      status || "New",          // H: Status
      saleAmount || "0",        // I: Sale Amount
      remarks || "",            // J: Remarks
      "",                       // K: Last Closed By (could be updated if status is closed)
      "",                       // L: Follow Up Start
      day1Remarks || "",        // M: Day 1 Remarks
      day2Remarks || "",        // N: Day 2 Remarks
      day3Remarks || "",        // O: Day 3 Remarks
      finalPriority,            // P: Priority
      "FALSE"                   // Q: Is Closed
    ];

    if (!createNew && rowIndexToUpdate !== -1) {

      await updateSheetData(`${SHEET_NAMES.CONTACTS}!A${rowIndexToUpdate + 1}:Q${rowIndexToUpdate + 1}`, [contactRowData]);
    } else {
      // APPEND NEW ROW
      await appendSheetData(`${SHEET_NAMES.CONTACTS}!A:Q`, [contactRowData]);
    }

    // --- 4. CLEAR CACHE ---
    if (redis.status === 'ready') {
      await redis.del("chats:all_data");
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("Contacts API Error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    // Fetch all data from the Contacts sheet
    const rows = await getSheetData(`${SHEET_NAMES.CONTACTS}!A2:Q`);

    // Map rows to objects using the CONTACT_COLUMNS indices
    // We now include ALL relevant fields for the detailed view
    const leads = rows.map((row) => ({
      date: row[CONTACT_COLUMNS.DATE] || "",
      name: row[CONTACT_COLUMNS.NAME] || "Unknown",
      phone: row[CONTACT_COLUMNS.PHONE] || "",
      city: row[CONTACT_COLUMNS.CITY] || "",
      handler: row[CONTACT_COLUMNS.HANDLER] || "",
      source: row[CONTACT_COLUMNS.SOURCE] || "",
      enquiredFor: row[CONTACT_COLUMNS.ENQUIRED_FOR] || "",
      status: row[CONTACT_COLUMNS.STATUS] || "New",
      saleAmount: row[CONTACT_COLUMNS.SALE_AMOUNT] || "",
      remarks: row[CONTACT_COLUMNS.REMARKS] || "",
      day1Remarks: row[12] || "", // Column M (Index 12)
      day2Remarks: row[13] || "", // Column N (Index 13)
      day3Remarks: row[14] || "", // Column O (Index 14)
      priority: row[CONTACT_COLUMNS.PRIORITY] || "Medium",
    })).reverse(); // Show newest leads first

    return NextResponse.json(leads);
  } catch (error) {
    console.error("Fetch Leads API Error:", error);
    return NextResponse.json({ error: "Failed to fetch leads" }, { status: 500 });
  }
}