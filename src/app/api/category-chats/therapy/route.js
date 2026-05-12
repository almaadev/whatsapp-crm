import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Customer from "@/models/Customer";
<<<<<<< HEAD
import Lead from "@/models/Lead";
import TherapyMessage from "@/models/TherapyMessage";
import twilio from "twilio";

export async function GET() {
    try {
        await connectDB();
        const targetType = "Therapy";
        
        const specificPhones = await TherapyMessage.distinct('phone');
        
        const rawLeads = await Lead.find({
            $or: [ { leadType: targetType }, { phone: { $in: specificPhones } } ]
        }).lean();
        
        // 👇 Database Deduplication to prevent mapping errors
        const leadMap = new Map();
        for (const l of rawLeads) { if (!leadMap.has(l.phone)) leadMap.set(l.phone, l); }
        const leads = Array.from(leadMap.values());
        const phones = leads.map(l => l.phone);
        
        const allMessages = await TherapyMessage.find({ phone: { $in: phones } }).lean();
        allMessages.forEach(m => m.time = new Date(m.createdAt || m.timestamp || 0).getTime());
        allMessages.sort((a, b) => a.time - b.time);

        const customers = await Customer.find({ phone: { $in: phones } }).lean(); 

        const chats = leads.map(lead => {
            const leadMsgs = allMessages.filter(m => m.phone === lead.phone);
            const customerMatch = customers.find(c => c.phone === lead.phone); 

            return {
                ...lead,
                name: customerMatch?.name && customerMatch.name !== "Unknown" ? customerMatch.name : (lead.name || lead.phone),
                city: customerMatch?.city || "",
                enquiredFor: customerMatch?.enquiredFor || lead.lastKeyword || "",
                history: leadMsgs,
                message: leadMsgs.length === 0 ? "No therapy messages yet" : null // Alternate display text
            };
        }).sort((a, b) => {
            const getTime = (leadObj) => {
                if (leadObj.history && leadObj.history.length > 0) {
                    const lastMsg = leadObj.history[leadObj.history.length - 1];
                    return lastMsg.time || 0;
                }
                return new Date(leadObj.createdAt || leadObj.date || 0).getTime();
            };
            return getTime(b) - getTime(a);
        });

        return NextResponse.json(chats);
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req) {
    try {
        await connectDB();
        const targetType = "Therapy";
        const { phone, message } = await req.json();

        if (!phone || !message) return NextResponse.json({ error: "Missing data" }, { status: 400 });

        const formattedTo = phone.startsWith("whatsapp:") ? phone : `whatsapp:${phone}`;
        const twilioPhone = process.env.NEXT_PUBLIC_TWILIO_PHONE_NUMBER || "";
        const formattedFrom = twilioPhone.startsWith("whatsapp:") ? twilioPhone : `whatsapp:${twilioPhone}`;

        let twilioRes;
        try {
            const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
            twilioRes = await client.messages.create({ body: message, from: formattedFrom, to: formattedTo });
        } catch (twilioError) {}

        const newMessage = await TherapyMessage.create({
            phone: formattedTo, message, direction: "OUTBOUND", status: twilioRes?.status ? twilioRes.status.toUpperCase() : "SENT", twilioSid: twilioRes?.sid || "sys_" + Date.now()
        });

        await Lead.findOneAndUpdate({ phone: formattedTo }, { $set: { leadType: targetType } }, { upsert: true });

        if (global.io) {
            global.io.emit("new_therapy_message", { phone: formattedTo, message, direction: "OUTBOUND", timestamp: new Date().toISOString() });
        }

        return NextResponse.json({ success: true, message: newMessage });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
=======
import TherapyMessage from "@/models/TherapyMessage";
import twilio from "twilio";

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/messages
//  Returns all product chats grouped by phone, enriched with Customer metadata.
//  No Lead collection is touched anywhere in this file.
// ─────────────────────────────────────────────────────────────────────────────
export async function GET() {
  try {
    await connectDB();

    // ── 1. Unique phone numbers that have product messages ───────────────────
    const phones = await TherapyMessage.distinct("phone");

    if (!phones.length) return NextResponse.json([]);

    // ── 2. All messages for those phones (single query, no N+1) ─────────────
    //       Normalise timestamp → virtual `.time` for sorting
    const allMessages = await TherapyMessage
      .find({ phone: { $in: phones } })
      .lean();

    allMessages.forEach((m) => {
      m.time = new Date(m.createdAt || m.timestamp || 0).getTime();
    });

    // Sort ascending (oldest first) so history reads chronologically
    allMessages.sort((a, b) => a.time - b.time);

    // ── 3. Customer metadata for those phones (single query) ─────────────────
    //       Only pull the fields we actually need
    const customers = await Customer
      .find(
        { phone: { $in: phones } },
        { phone: 1, name: 1, priority: 1, status: 1 }
      )
      .lean();

    // ── 4. Build O(1) lookup maps — avoids repeated .find() inside loops ─────
    //       messagesByPhone : phone → Message[]
    //       customerByPhone : phone → Customer
    const messagesByPhone = new Map();
    for (const msg of allMessages) {
      if (!messagesByPhone.has(msg.phone)) messagesByPhone.set(msg.phone, []);
      messagesByPhone.get(msg.phone).push(msg);
    }

    const customerByPhone = new Map(customers.map((c) => [c.phone, c]));

    // ── 5. Group chats — one entry per phone ─────────────────────────────────
    const chats = phones.map((phone) => {
      const history  = messagesByPhone.get(phone) ?? [];
      const customer = customerByPhone.get(phone);

      return {
        phone,
        name:     customer?.name && customer.name !== "Unknown"
                    ? customer.name
                    : phone,
        priority: customer?.priority ?? null,
        status:   customer?.status   ?? null,
        history,
      };
    });

    // ── 6. Sort chats by latest message time (most recent conversation first) ─
    chats.sort((a, b) => {
      const latestTime = (chat) => {
        const last = chat.history[chat.history.length - 1];
        return last?.time ?? 0;
      };
      return latestTime(b) - latestTime(a);
    });

    return NextResponse.json(chats);

  } catch (error) {
    console.error("[GET /api/messages]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/messages
//  Sends a WhatsApp message via Twilio and stores it in TherapyMessage only.
//  No Lead collection is created or updated.
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(req) {
  try {
    await connectDB();

    // ── 1. Parse and validate request body ───────────────────────────────────
    const body = await req.json();
    const { phone, message } = body;

    if (!phone || !message) {
      return NextResponse.json(
        { error: "Both 'phone' and 'message' are required." },
        { status: 400 }
      );
    }

    const formattedTo = phone.startsWith("whatsapp:")
      ? phone
      : `whatsapp:${phone}`;

    const twilioPhoneRaw = process.env.NEXT_PUBLIC_TWILIO_PHONE_NUMBER ?? "";
    const formattedFrom  = twilioPhoneRaw.startsWith("whatsapp:")
      ? twilioPhoneRaw
      : `whatsapp:${twilioPhoneRaw}`;

    // ── 3. Send via Twilio ────────────────────────────────────────────────────
    let twilioSid    = `sys_${Date.now()}`;
    let twilioStatus = "SENT"; // safe fallback if Twilio is unreachable

    try {
      const client  = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );
      const twilioRes = await client.messages.create({
        body:  message,
        from:  formattedFrom,
        to:    formattedTo,
      });

      if (twilioRes.sid)    twilioSid    = twilioRes.sid;
      if (twilioRes.status) twilioStatus = twilioRes.status.toUpperCase();

    } catch (twilioError) {
      // Log but do NOT surface Twilio errors to the client —
      // the message is still stored so associates can see it was attempted
      console.error("[Twilio send error]", twilioError.message);
    }

    // ── 4. Persist to TherapyMessage only ────────────────────────────────────
    const saved = await TherapyMessage.create({
      phone:     formattedTo,
      message,
      direction: "OUTBOUND",
      status:    twilioStatus,
      twilioSid,
      timestamp: new Date(),
    });

    // ── 5. Real-time socket notification (optional) ───────────────────────────
    if (global.io) {
      global.io.emit("new_therapy_message", {
        phone:     formattedTo,
        message,
        direction: "OUTBOUND",
        timestamp: saved.timestamp ?? saved.createdAt ?? new Date(),
      });
    }

    return NextResponse.json({ success: true, message: saved });

  } catch (error) {
    console.error("[POST /api/messages]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
>>>>>>> c1be5bc (Initial commit from new system)
}