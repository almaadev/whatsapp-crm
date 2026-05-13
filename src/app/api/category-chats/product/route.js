import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { getServerSession } from "next-auth"; 
import { authOptions } from "@/lib/auth";
import Customer from "@/models/Customer";
import Message from "@/models/Message";
import ProductMessage from "@/models/ProductMessage";
import twilio from "twilio";


export async function GET() {
  try {
    await connectDB();

    // ── 1. Unique phone numbers that have product messages ───────────────────
    const phones = await ProductMessage.distinct("phone");

    if (!phones.length) return NextResponse.json([]);

    // ── 2. All messages for those phones (single query, no N+1) ─────────────
    //       Normalise timestamp → virtual `.time` for sorting
    const allMessages = await ProductMessage
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
        { phone: 1, name: 1, priority: 1, status: 1 , city: 1}
      )
      .lean();


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
        name: customer?.name && customer.name !== "Unknown"
                    ? customer.name
                    : phone,
        priority: customer?.priority ?? null,
        city: customer?.city ?? null,
        status: customer?.status ?? null,
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


export async function POST(req) {
  const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

    // ── 2. Normalise to whatsapp:+XXXXXXXXXXX format ──────────────────────────
    const formattedTo = phone.startsWith("whatsapp:")
      ? phone
      : `whatsapp:${phone}`;

    const twilioPhoneRaw = process.env.NEXT_PUBLIC_TWILIO_PHONE_NUMBER ?? "";
    const formattedFrom  = twilioPhoneRaw.startsWith("whatsapp:")
      ? twilioPhoneRaw
      : `whatsapp:${twilioPhoneRaw}`;

    // ── 3. Send via Twilio ────────────────────────────────────────────────────
    let twilioSid    = `sys_${Date.now()}`;
    let twilioStatus = "SENT";

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

    // ── 4. Persist to ProductMessage only ────────────────────────────────────
    const saved = await ProductMessage.create({
      phone:     formattedTo,
      message,
      direction: "OUTBOUND",
      status:    twilioStatus,
      twilioSid,
      timestamp: new Date(),
    });
    
    const messageRecord = await Message.create({
      phone:     formattedTo,
      message:   `${message}\nFrom Product Lead chat by ${session?.user?.name || session?.user?.email}`, // Append category for clarity in unified inbox
      direction: "OUTBOUND",
      status:    twilioStatus,
      twilioSid,
      timestamp: new Date(),
    });

    // ── 5. Real-time socket notification (optional) ───────────────────────────
    if (global.io) {
      global.io.emit("new_product_message", {
        phone:     formattedTo,
        message,
        direction: "OUTBOUND",
        timestamp: saved.timestamp ?? saved.createdAt ?? new Date(),
      });

      global.io.emit("new_message", {
        phone:     formattedTo,
        message,
        direction: "OUTBOUND",
        timestamp: messageRecord.timestamp ?? messageRecord.createdAt ?? new Date(),
      });
    }

    return NextResponse.json({ success: true, message: saved });

  } catch (error) {
    console.error("[POST /api/messages]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}