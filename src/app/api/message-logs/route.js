import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import twilio from "twilio";

export const dynamic = "force-dynamic";

export async function GET(req) {
    try {
        await connectDB();
        const session = await getServerSession(authOptions);

        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const limitParam = searchParams.get("limit") || "500";
        const startDate = searchParams.get("startDate");
        const endDate = searchParams.get("endDate");
        const status = searchParams.get("status");

        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        const client = twilio(accountSid, authToken);

        // Start with empty options
        const fetchOptions = {};

        // 👇 FIX: Only apply the limit if it is NOT "all"
        if (limitParam !== "all") {
            fetchOptions.limit = parseInt(limitParam, 10);
        }

        if (startDate) fetchOptions.dateSentAfter = new Date(startDate);
        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            fetchOptions.dateSentBefore = end;
        }
        if (status && status !== 'all') fetchOptions.status = status;

        // Twilio will automatically fetch ALL records if fetchOptions.limit is undefined
        const messages = await client.messages.list(fetchOptions);

        let delivered = 0, failed = 0, inbound = 0, outbound = 0, media = 0;

        const formattedMessages = messages.map(msg => {
            const numMedia = Number(msg.numMedia || 0);
            const msgStatus = msg.status?.toLowerCase() || "";
            const isOutbound = msg.direction.includes('outbound');

            if (['delivered', 'read'].includes(msgStatus)) delivered++;
            if (['failed', 'undelivered'].includes(msgStatus)) failed++;
            if (isOutbound) outbound++; else inbound++;
            if (numMedia > 0) media++;

            return {
                id: msg.sid,
                dateSent: msg.dateSent,
                direction: msg.direction,
                from: msg.from,
                to: msg.to,
                body: msg.body || "",
                numMedia: numMedia,
                status: msg.status,
                errorMessage: msg.errorMessage || null
            };
        });

        const analytics = {
            total: formattedMessages.length,
            delivered,
            failed,
            inbound,
            outbound,
            media
        };

        return NextResponse.json({
            success: true,
            analytics: analytics,
            messages: formattedMessages
        });

    } catch (error) {
        console.error("Message Logs API Error:", error);
        return NextResponse.json({ success: false, error: "Failed to fetch logs" }, { status: 500 });
    }
}