import { NextResponse } from "next/server";
import twilio from "twilio";
import BulkMessage from "@/models/BulkMessage";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// Helper function to strictly format numbers for Twilio WhatsApp
const formatWhatsAppNumber = (rawNumber) => {
    // 1. Strip everything except digits and the plus sign
    let cleanNumber = rawNumber.replace(/[^\d+]/g, '');
    
    // 2. If it already starts with whatsapp:, remove it temporarily to clean the number
    if (cleanNumber.startsWith('whatsapp:')) {
        cleanNumber = cleanNumber.replace('whatsapp:', '');
    }

    // 3. Assume India (+91) if it's exactly 10 digits (Standard Indian Mobile)
    if (cleanNumber.length === 10) {
        cleanNumber = `+91${cleanNumber}`;
    } 
    // 4. If it's 12 digits starting with 91 (e.g., 919876543210), just add the plus
    else if (cleanNumber.length === 12 && cleanNumber.startsWith('91')) {
        cleanNumber = `+${cleanNumber}`;
    }
    // 5. If it starts with 0 and is 11 digits, remove 0 and add +91
    else if (cleanNumber.length === 11 && cleanNumber.startsWith('0')) {
        cleanNumber = `+91${cleanNumber.substring(1)}`;
    }
    // 6. Ensure it has a plus sign at the beginning if it doesn't already
    else if (!cleanNumber.startsWith('+')) {
         cleanNumber = `+${cleanNumber}`;
    }

    // Return strictly formatted Twilio WhatsApp string
    return `whatsapp:${cleanNumber}`;
};

export async function POST(req) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        await connectDB();
        
        // Extract variables from the body
        const { numbers, templateId, contentVariables } = await req.json();

        if (!numbers || !Array.isArray(numbers) || numbers.length === 0) {
            return NextResponse.json({ error: "Invalid or empty phone numbers array." }, { status: 400 });
        }
        if (!templateId) {
            return NextResponse.json({ error: "Template ID (SID) is required." }, { status: 400 });
        }

        const twilioPhoneNumber = process.env.NEXT_PUBLIC_TWILIO_PHONE_NUMBER || "whatsapp:+14155238886";
        const formattedFrom = twilioPhoneNumber.startsWith("whatsapp:") ? twilioPhoneNumber : `whatsapp:${twilioPhoneNumber}`;
        const callbackUrl = process.env.NEXT_PUBLIC_BASE_URL ? `${process.env.NEXT_PUBLIC_BASE_URL}/api/webhook/status` : "https://pediatric-opossum-gambling.ngrok-free.dev/api/webhook/status";
        let successCount = 0;
        let failedCount = 0;

          const findUserNameById = async (id) => {
            const user = await User.findById(id).lean();
            return user ? user.name : "Unknown";
          };

        const bulkRecord = await BulkMessage.create({
            templateId,
            accountSid: process.env.TWILIO_ACCOUNT_SID || "unknown",
            contentSid: templateId, 
            body: `Template Broadcast (SID: ${templateId})`, 
            totalRecipients: numbers.length,
            sentBy: await findUserNameById(session.user.id),
            status: "IN_PROGRESS",
            callbackUrl: callbackUrl
        });

        for (const rawPhone of numbers) {
            if (!rawPhone || typeof rawPhone !== 'string') continue;

            // 🚨 Use the strict formatting function
            const formattedTo = formatWhatsAppNumber(rawPhone);

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
                // Log the formatted number to terminal so you can see exactly why Twilio rejected it
                console.error(`Twilio Error sending to ${formattedTo}:`, err.message);
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