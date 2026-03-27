import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Customer from "@/models/Customer";
import Lead from "@/models/Lead";
import ProductMessage from "@/models/ProductMessage";
import twilio from "twilio";

export async function GET() {
    try {
        await connectDB();
        const targetType = "Product Lead";
        
        const specificPhones = await ProductMessage.distinct('phone');
        
        const rawLeads = await Lead.find({
            $or: [ { leadType: targetType }, { phone: { $in: specificPhones } } ]
        }).lean();
        
        // 👇 Database Deduplication to prevent mapping errors
        const leadMap = new Map();
        for (const l of rawLeads) { if (!leadMap.has(l.phone)) leadMap.set(l.phone, l); }
        const leads = Array.from(leadMap.values());
        const phones = leads.map(l => l.phone);
        
        const allMessages = await ProductMessage.find({ phone: { $in: phones } }).lean();
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
                message: leadMsgs.length === 0 ? "No product messages yet" : null // Alternate display text
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
        const targetType = "Product Lead";
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

        const newMessage = await ProductMessage.create({
            phone: formattedTo, message, direction: "OUTBOUND", status: twilioRes?.status ? twilioRes.status.toUpperCase() : "SENT", twilioSid: twilioRes?.sid || "sys_" + Date.now()
        });

        await Lead.findOneAndUpdate({ phone: formattedTo }, { $set: { leadType: targetType } }, { upsert: true });

        if (global.io) {
            global.io.emit("new_product_message", { phone: formattedTo, message, direction: "OUTBOUND", timestamp: new Date().toISOString() });
        }

        return NextResponse.json({ success: true, message: newMessage });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}