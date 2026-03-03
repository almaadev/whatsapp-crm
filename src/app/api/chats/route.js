import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import redis from "@/lib/redis";
import { getSheetData, appendSheetData } from "@/lib/googleSheets";
import { SHEET_NAMES, CONTACT_COLUMNS, FORWARD_COLUMNS } from "@/lib/constants";
import twilio from "twilio";

const REDIS_CACHE_TTL = 30;

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // 1. CHECK REDIS FIRST
    if (redis && redis.status === 'ready') {
      try {
        const cachedData = await redis.get("chats:all_data");
        if (cachedData) {
          return NextResponse.json(JSON.parse(cachedData));
        }
      } catch (e) { console.error("Redis Read Error", e); }
    }

    // 2. FETCH FROM GOOGLE SHEETS
    const [chatRows, contactRows, forwardedRows] = await Promise.all([
      getSheetData(`${SHEET_NAMES.MESSAGES}!A2:L`),
      getSheetData(`${SHEET_NAMES.CONTACTS}!A:Q`),
      getSheetData(`${SHEET_NAMES.FORWARDED}!A:F`)
    ]);

    // --- PROCESSING LOGIC ---
    const forwardedMap = new Map();
    (forwardedRows || []).forEach(row => {
      if (row?.[FORWARD_COLUMNS.TO_CUSTOMER]) {
        forwardedMap.set(row[FORWARD_COLUMNS.TO_CUSTOMER], {
          forwardedBy: row[FORWARD_COLUMNS.BY],
          lastForwardedTo: row[FORWARD_COLUMNS.TO_CUSTOMER],
          forwardMessage: row[FORWARD_COLUMNS.MESSAGE],
          lastForwardedName: row[FORWARD_COLUMNS.TO_ASSOCIATE],
          forwardDate: row[FORWARD_COLUMNS.DATE],
          isClosedForward: row[FORWARD_COLUMNS.IS_CLOSED]
        });
      }
    });

    const contactMap = new Map();
    const visitCounts = new Map();

    (contactRows || []).forEach(row => {
      const phone = row[CONTACT_COLUMNS.PHONE]?.toString().trim();
      if (!phone) return;

      visitCounts.set(phone, (visitCounts.get(phone) || 0) + 1);
      const fw = forwardedMap.get(phone) || {};
      
      let currentStatus = row[CONTACT_COLUMNS.STATUS] || "New";
      const followUpDateStr = row[CONTACT_COLUMNS.FOLLOW_UP_START];

      if (currentStatus === "Follow Up" && followUpDateStr) {
        const followUpStart = new Date(followUpDateStr);
        const today = new Date();
        if (!isNaN(followUpStart.getTime())) {
          const diffTime = today - followUpStart;
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          if (diffDays > 1) {
            currentStatus = "Not Closed";
          }
        }
      }

      contactMap.set(phone, {
        date: row[CONTACT_COLUMNS.DATE] || "",
        name: row[CONTACT_COLUMNS.NAME] || "",
        status: currentStatus,
        priority: row[CONTACT_COLUMNS.PRIORITY] || "Low",
        isClosed: row[CONTACT_COLUMNS.IS_CLOSED] || "FALSE",
        ...fw
      });
    });

    const chats = (chatRows || []).map((row) => {
      const sender = row[0]?.toString().trim() || "";
      const receiver = row[1]?.toString().trim() || "";
      const message = row[2] || "";
      const direction = row[3] || "INBOUND";
      
      // FIX: Message Delivery Status-ஐ சரியாக எடுக்கிறோம் (Column E)
      const messageStatus = row[4] || ""; 
      
      const customerPhone = direction === "OUTBOUND" ? receiver : sender;
      const contactInfo = contactMap.get(customerPhone) || {};

      return {
        phone: customerPhone,
        name: contactInfo.name || row[8] || customerPhone,
        message,
        direction,
        status: contactInfo.status || "New", // Lead Status
        messageStatus: messageStatus, // Message Delivery Status
        read: row[5] || "FALSE",
        timestamp: row[6] || new Date().toISOString(),
        twilioSid: row[7] || "",
        associate: row[8] || "",
        role: row[9]?.toLowerCase() || "sales",
        mediaUrl: row[10] || "",
        mediaType: row[11] || "",
        lastSeenAt: row[6] || new Date().toISOString(),
        visitCount: visitCounts.get(customerPhone) || 1,
        ...contactInfo
      };
    }).filter(chat => chat.phone && !chat.phone.includes("whatsapp:+14155238886"));

    // 3. Update Redis Cache
    if (redis && redis.status === 'ready') {
      await redis.set("chats:all_data", JSON.stringify(chats), "EX", REDIS_CACHE_TTL);
    }

    return NextResponse.json(chats);

  } catch (error) {
    console.error("Chats API Error:", error.message);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { phone, message, name, role, skipSave } = await req.json();
    if (!phone || !message) return NextResponse.json({ error: "Required fields missing" }, { status: 400 });

    let twilioSid = "sys_msg";
    const myTwilioNumber = process.env.NEXT_PUBLIC_TWILIO_PHONE_NUMBER;

    try {
      const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      const sent = await client.messages.create({
        body: message,
        from: myTwilioNumber,
        to: phone.startsWith("whatsapp:") ? phone : `whatsapp:${phone}`,
      });
      twilioSid = sent.sid;
    } catch (e) {
      console.error("Twilio Error:", e.message);
    }

    if (!skipSave) {
      const now = new Date();
      const timestamp = `${now.toLocaleDateString("en-US")} ${now.toLocaleTimeString("en-US", { hour12: false })}`;
      const isoTimestamp = new Date().toISOString();

      await appendSheetData(`${SHEET_NAMES.MESSAGES}!A:L`, [[
        myTwilioNumber, phone, message, "OUTBOUND", "SENT", "TRUE",
        timestamp, twilioSid, name || phone, role || "sales", "", ""
      ]]);

      if (global.io) {
        global.io.emit("new_message", { 
            phone: phone, 
            message: message, 
            direction: "OUTBOUND", 
            timestamp: isoTimestamp,
            status: "SENT",
            role: role || "sales",
            name: name || phone
        });
      }

      if (redis && redis.status === 'ready') await redis.del("chats:all_data");
    }

    return NextResponse.json({ success: true, twilioSid });
  } catch (error) {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}