import { NextResponse } from "next/server";
import twilio from "twilio";

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const twilioNumber = process.env.NEXT_PUBLIC_TWILIO_PHONE_NUMBER;

// Bulk messages anuppum pothu API rate limit avoid panna oru small delay function
const delay = (ms) => new Promise(res => setTimeout(res, ms));

export async function POST(req) {
    try {
        const { numbers, templateId, variables } = await req.json();

        if (!numbers || !templateId) {
            return NextResponse.json({ error: "Missing numbers or templateId" }, { status: 400 });
        }

        const formattedNumbers = numbers.map(num => {
            let cleaned = num.toString().replace(/\D/g, '');
            if (cleaned.length === 10) cleaned = '91' + cleaned;
            return `whatsapp:+${cleaned}`;
        });

        const results = [];
        const chunkSize = 20; // Oru nerathukku 20 messages mattum anuppum batch size

        for (let i = 0; i < formattedNumbers.length; i += chunkSize) {
            const chunk = formattedNumbers.slice(i, i + chunkSize);
            
            const chunkResults = await Promise.allSettled(chunk.map(phone => {
                const messageParams = {
                    from: twilioNumber,
                    to: phone,
                    contentSid: templateId,
                };
                
                // 👇 FIX: Variables irunthaal mattum attach pannanum, illaiyel omit pannanum
                if (variables && Object.keys(variables).length > 0) {
                    messageParams.contentVariables = JSON.stringify(variables);
                }

                return client.messages.create(messageParams);
            }));

            results.push(...chunkResults);
            
            // Twilio API block aagama irukka, adutha chunk anuppurathukku munnadi 500ms delay
            if (i + chunkSize < formattedNumbers.length) {
                await delay(500); 
            }
        }

        console.log("Bulk message results:", results);
        const successCount = results.filter(r => r.status === 'fulfilled').length;
        const failedCount = results.filter(r => r.status === 'rejected').length;

        return NextResponse.json({ success: true, successCount, failedCount });
    } catch (error) {
        console.error("API Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}