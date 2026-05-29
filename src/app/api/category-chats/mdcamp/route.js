import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { getServerSession } from "next-auth"; 
import { authOptions } from "@/lib/auth";
import Customer from "@/models/Customer";
import Message from "@/models/Message";
import MDCampMessage from "@/models/MDCampMessage";
import twilio from "twilio";

export async function GET(req) {
  try {
    await connectDB();
    const url = new URL(req.url);
    const searchQuery = url.searchParams.get('search');

    let phones = [];

    if (searchQuery && searchQuery.trim() !== '') {
        const searchRegex = new RegExp(searchQuery.trim(), 'i');
        const matchedCustomers = await Customer.find({ $or: [{ name: searchRegex }, { phone: searchRegex }] }, { phone: 1 }).lean();
        const matchedCustomerPhones = matchedCustomers.map(c => c.phone);
        const matchedMessagePhones = await MDCampMessage.distinct("phone", { phone: searchRegex });
        phones = [...new Set([...matchedCustomerPhones, ...matchedMessagePhones])];

        if (!phones.length) return NextResponse.json([]);
    } else {
        phones = await MDCampMessage.distinct("phone");
        if (!phones.length) return NextResponse.json([]);
    }

    const allMessages = await MDCampMessage.find({ phone: { $in: phones } }).lean();
    allMessages.forEach((m) => m.time = new Date(m.createdAt || m.timestamp || 0).getTime());
    allMessages.sort((a, b) => a.time - b.time);

    const customers = await Customer.find( { phone: { $in: phones } }, { phone: 1, name: 1, priority: 1, status: 1 , city: 1} ).lean();

    const messagesByPhone = new Map();
    for (const msg of allMessages) {
      if (!messagesByPhone.has(msg.phone)) messagesByPhone.set(msg.phone, []);
      messagesByPhone.get(msg.phone).push(msg);
    }

    const customerByPhone = new Map(customers.map((c) => [c.phone, c]));

    const chats = phones.map((phone) => {
      const history  = messagesByPhone.get(phone) ?? [];
      const customer = customerByPhone.get(phone);
      return {
        phone,
        name: customer?.name && customer.name !== "Unknown" ? customer.name : phone,
        priority: customer?.priority ?? null,
        city: customer?.city ?? null,
        status: customer?.status ?? null,
        history,
      };
    });

    chats.sort((a, b) => {
      const latestTimeA = a.history.length > 0 ? a.history[a.history.length - 1].time : Date.now();
      const latestTimeB = b.history.length > 0 ? b.history[b.history.length - 1].time : Date.now();
      return latestTimeB - latestTimeA;
    });

    return NextResponse.json(chats);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await connectDB();
    const body = await req.json();
    const { phone, message } = body;

    if (!phone || !message) return NextResponse.json({ error: "Both 'phone' and 'message' are required." }, { status: 400 });

    const formattedTo = phone.startsWith("whatsapp:") ? phone : `whatsapp:${phone}`;
    const twilioPhoneRaw = process.env.NEXT_PUBLIC_TWILIO_PHONE_NUMBER ?? "";
    const formattedFrom  = twilioPhoneRaw.startsWith("whatsapp:") ? twilioPhoneRaw : `whatsapp:${twilioPhoneRaw}`;

    let twilioSid = `sys_${Date.now()}`;
    let twilioStatus = "SENT";

    try {
      const client  = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      const twilioRes = await client.messages.create({ body: message, from: formattedFrom, to: formattedTo });
      if (twilioRes.sid) twilioSid = twilioRes.sid;
      if (twilioRes.status) twilioStatus = twilioRes.status.toUpperCase();
    } catch (twilioError) {}

    const saved = await MDCampMessage.create({
      phone: formattedTo, message, direction: "OUTBOUND", status: twilioStatus, twilioSid, timestamp: new Date(),
    });
    
    const messageRecord = await Message.create({
      phone: formattedTo, message: `${message}\nFrom MD Camp chat by ${session?.user?.name || session?.user?.email}`, direction: "OUTBOUND", status: twilioStatus, twilioSid, timestamp: new Date(),
    });

    if (global.io) {
      global.io.emit("new_mdcamp_message", { phone: formattedTo, message, direction: "OUTBOUND", timestamp: saved.timestamp ?? saved.createdAt ?? new Date() });
      global.io.emit("new_message", { phone: formattedTo, message, direction: "OUTBOUND", timestamp: messageRecord.timestamp ?? messageRecord.createdAt ?? new Date() });
    }

    return NextResponse.json({ success: true, message: saved });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}