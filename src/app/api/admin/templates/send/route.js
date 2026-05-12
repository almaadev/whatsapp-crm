import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import twilio from "twilio";

export const dynamic = "force-dynamic";

export async function POST(req) {
    try {
        const session = await getServerSession(authOptions);

        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { to, contentSid, variables } = await req.json();

        if (!to || !contentSid) {
            return NextResponse.json({ error: "Destination number (to) and Content SID are required." }, { status: 400 });
        }

        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        const fromNumber = process.env.NEXT_PUBLIC_TWILIO_PHONE_NUMBER;
        
        const client = twilio(accountSid, authToken);

        // Format the destination number for WhatsApp
        let formattedTo = to.toString().replace(/\D/g, '');
        if (formattedTo.length === 10) formattedTo = `91${formattedTo}`;
        if (!formattedTo.startsWith("whatsapp:")) formattedTo = `whatsapp:+${formattedTo}`;

        // Prepare Message Payload using the Content API
        const messagePayload = {
            from: fromNumber,
            to: formattedTo,
            contentSid: contentSid,
        };

        // Important: If the template has variables (e.g. {{1}}), you MUST pass contentVariables
        if (variables && Object.keys(variables).length > 0) {
            messagePayload.contentVariables = JSON.stringify(variables);
        } else {
            messagePayload.contentVariables = "{}"; 
        }

        // Send Message via Twilio Messaging API
        const message = await client.messages.create(messagePayload);

        return NextResponse.json({
            success: true,
            messageSid: message.sid,
            status: message.status
        });

    } catch (error) {
        console.error("Send Template Error:", error);
        
        // Handle specific Twilio errors (like Unapproved Template)
        if (error.code === 63016) {
             return NextResponse.json({ success: false, error: "Sender is waiting for template approval." }, { status: 400 });
        }
        if (error.code === 90016) {
             return NextResponse.json({ success: false, error: "Missing required template variables or variables mismatch." }, { status: 400 });
        }

        return NextResponse.json({ success: false, error: error.message || "Internal Server Error" }, { status: 500 });
    }
}