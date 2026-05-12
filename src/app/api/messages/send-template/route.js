import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import Message from "@/models/Message";
import ProductMessage from "@/models/ProductMessage";
import TherapyMessage from "@/models/TherapyMessage";
import MDCampMessage from "@/models/MDCampMessage";
import twilio from "twilio";

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

export async function POST(req) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        await connectDB();
        const { phone, templateSid, chatType, associateName } = await req.json();

        if (!phone || !templateSid) {
            return NextResponse.json({ error: "Phone and Template SID required" }, { status: 400 });
        }

        const formattedPhone = phone.startsWith("whatsapp:") ? phone : `whatsapp:${phone}`;

        // 1. Trigger Twilio Content API to send the template
        const twilioMessage = await client.messages.create({
            contentSid: templateSid,
            from: process.env.NEXT_PUBLIC_TWILIO_PHONE_NUMBER || "whatsapp:+14155238886", // Replace with your sender
            to: formattedPhone,
        });

        // 2. Prepare payload for DB
        const messageData = {
            phone: formattedPhone,
            message: "Template Message", // Fallback UI text (overridden by isTemplate flag on frontend)
            direction: "OUTBOUND",
            status: "SENT",
            twilioSid: twilioMessage.sid,
            timestamp: new Date(),
            name: associateName || session.user.name,
            role: session.user.role || "associate",
            isTemplate: true,
            templateSid: templateSid
        };

        // 3. Save to appropriate collection
        let savedMsg;
        if (chatType === "Product Lead") savedMsg = await ProductMessage.create(messageData);
        else if (chatType === "Therapy") savedMsg = await TherapyMessage.create(messageData);
        else if (chatType === "MD Camp") savedMsg = await MDCampMessage.create(messageData);
        else savedMsg = await Message.create(messageData);

        return NextResponse.json({ success: true, twilioSid: twilioMessage.sid, message: savedMsg });
    } catch (error) {
        console.error("[Twilio Template Send Error]:", error);
        return NextResponse.json({ error: "Failed to send template" }, { status: 500 });
    }
}