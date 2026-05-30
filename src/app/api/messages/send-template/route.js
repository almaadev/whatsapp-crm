import { NextResponse } from "next/server";
import twilio from "twilio";
import connectDB from "@/lib/mongodb";
import Message from "@/models/Message";
import Customer from "@/models/Customer";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

export async function POST(req) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        await connectDB();
        
        // 🚨 contentVariables vangi Twilio payload-ku anupuvom
        const { phone, templateSid, chatType, associateName, contentVariables } = await req.json();

        if (!phone || !templateSid) return NextResponse.json({ error: "Phone and Template SID required" }, { status: 400 });

        const twilioPhoneNumber = process.env.NEXT_PUBLIC_TWILIO_PHONE_NUMBER || "whatsapp:+14155238886";
        const formattedTo = phone.startsWith("whatsapp:") ? phone : `whatsapp:${phone}`;
        const formattedFrom = twilioPhoneNumber.startsWith("whatsapp:") ? twilioPhoneNumber : `whatsapp:${twilioPhoneNumber}`;

        const messagePayload = {
            contentSid: templateSid,
            from: formattedFrom,
            to: formattedTo,
        };

        // Inject Dynamic Variables into Twilio Payload
        if (contentVariables && Object.keys(contentVariables).length > 0) {
            messagePayload.contentVariables = JSON.stringify(contentVariables);
        }

        const message = await client.messages.create(messagePayload);

        // Store in DB for UI history
        await Message.create({
            phone: formattedTo,
            message: `Template Sent (SID: ${templateSid})`,
            direction: "OUTBOUND",
            status: "SENT",
            twilioSid: message.sid,
            chatType: chatType || "Direct Lead",
            associateName: associateName || session.user.name,
            role: session.user.role || "associate",
            isTemplate: true,
            templateSid: templateSid
        });

        await Customer.findOneAndUpdate(
            { phone: formattedTo },
            { lastMessageAt: new Date(), $setOnInsert: { status: "New" } },
            { upsert: true }
        );

        return NextResponse.json({ success: true, messageSid: message.sid }, { status: 200 });

    } catch (error) {
        console.error("Send Template Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}