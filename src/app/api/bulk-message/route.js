import { NextResponse } from "next/server";
import twilio from "twilio";
import BulkMessage from "@/models/BulkMessage";
import connectDB from "@/lib/mongodb";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

export async function POST(req) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        await connectDB();
        
        // Extract contentVariables from the body
        const { numbers, templateId, contentVariables } = await req.json();

        if (!numbers || !Array.isArray(numbers) || numbers.length === 0) {
            return NextResponse.json({ error: "Invalid or empty phone numbers array." }, { status: 400 });
        }
        if (!templateId) {
            return NextResponse.json({ error: "Template ID (SID) is required." }, { status: 400 });
        }

        const twilioPhoneNumber = process.env.NEXT_PUBLIC_TWILIO_PHONE_NUMBER || "whatsapp:+14155238886";
        let successCount = 0;
        let failedCount = 0;

        const bulkRecord = await BulkMessage.create({
            templateId,
            totalRecipients: numbers.length,
            sentBy: session.user.name || session.user.email,
            status: "IN_PROGRESS"
        });

        for (const rawPhone of numbers) {
            const phone = rawPhone.trim();
            if (!phone) continue;

            const formattedTo = phone.startsWith("whatsapp:") ? phone : `whatsapp:${phone}`;
            const formattedFrom = twilioPhoneNumber.startsWith("whatsapp:") ? twilioPhoneNumber : `whatsapp:${twilioPhoneNumber}`;

            // Prepare the payload for Twilio Content API
            const messagePayload = {
                contentSid: templateId,
                from: formattedFrom,
                to: formattedTo,
            };

            // Inject variables if they exist
            if (contentVariables && Object.keys(contentVariables).length > 0) {
                messagePayload.contentVariables = JSON.stringify(contentVariables);
            }

            try {
                // Send the template message
                await client.messages.create(messagePayload);
                successCount++;
            } catch (err) {
                console.error(`Failed to send template to ${phone}:`, err.message);
                failedCount++;
            }
        }

        bulkRecord.successfulSends = successCount;
        bulkRecord.failedSends = failedCount;
        bulkRecord.status = "COMPLETED";
        await bulkRecord.save();

        return NextResponse.json({
            success: true,
            successCount,
            failedCount,
            total: numbers.length
        }, { status: 200 });

    } catch (error) {
        console.error("Bulk Send Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}