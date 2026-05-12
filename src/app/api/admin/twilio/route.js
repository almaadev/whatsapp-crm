import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import mongoose from "mongoose";
import twilio from "twilio";

export const dynamic = "force-dynamic";

export async function GET(req) {
    try {
        await connectDB();
        const session = await getServerSession(authOptions);

        // 1. Strict Role Validation
        const isSuperAdmin = session?.user?.role === 'superAdmin';
        const isAdmin = session?.user?.department === 'admin';

        if (!session || (!isSuperAdmin && !isAdmin)) {
            return NextResponse.json({ error: "Forbidden: Admin access required." }, { status: 403 });
        }

        // 2. Parse Enterprise Filters
        const { searchParams } = new URL(req.url);
        const limitParam = searchParams.get("limit") || "100";
        const startDate = searchParams.get("startDate");
        const endDate = searchParams.get("endDate");
        const status = searchParams.get("status");
        
        let fetchLimit = limitParam === "all" ? 1000 : parseInt(limitParam, 10);

        // 3. Fetch Exchange Rate
        let exchangeRate = 83.50;
        const rateDoc = await mongoose.connection.collection('settings').findOne({ key: 'usd_to_inr' });
        if (rateDoc && rateDoc.value) {
            exchangeRate = parseFloat(rateDoc.value);
        }

        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;

        // 4. Fetch Account Balance
        const authHeader = `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`;
        const balanceRes = await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Balance.json`,
            { headers: { Authorization: authHeader } }
        );
        const balanceData = await balanceRes.json();

        // 5. Fetch Message Logs with Server-Side Filtering
        const client = twilio(accountSid, authToken);
        const fetchOptions = { limit: fetchLimit };

        // 👇 FIX: Use exact Date/Time objects passed from the client
        if (startDate) fetchOptions.dateSentAfter = new Date(startDate);
        if (endDate) fetchOptions.dateSentBefore = new Date(endDate);
        if (status && status !== 'all') fetchOptions.status = status;

        const messages = await client.messages.list(fetchOptions);

        // 6. Compute Enterprise Metrics
        let delivered = 0, failed = 0, inbound = 0, outbound = 0, media = 0;
        let totalCost = 0;

        const formattedMessages = messages.map(msg => {
            const numMedia = Number(msg.numMedia || 0);
            const price = Math.abs(Number(msg.price || 0));
            const msgStatus = msg.status?.toLowerCase();
            const isOutbound = msg.direction.includes('outbound');

            if (['delivered', 'read'].includes(msgStatus)) delivered++;
            if (['failed', 'undelivered'].includes(msgStatus)) failed++;
            if (isOutbound) outbound++; else inbound++;
            if (numMedia > 0) media++;
            totalCost += price;

            return {
                id: msg.sid,
                dateSent: msg.dateSent,
                direction: msg.direction,
                from: msg.from,
                to: msg.to,
                body: msg.body || "",
                numMedia: numMedia,
                status: msg.status,
                price: msg.price || "0.00",
                errorMessage: msg.errorMessage
            };
        });

        const analytics = {
            total: formattedMessages.length,
            delivered,
            failed,
            inbound,
            outbound,
            media,
            totalCostUsd: totalCost.toFixed(4),
            totalCostInr: (totalCost * exchangeRate).toFixed(2),
            deliveryRate: formattedMessages.length > 0 ? ((delivered / formattedMessages.length) * 100).toFixed(1) : 0
        };

        return NextResponse.json({
            success: true,
            balance: balanceData.balance,
            currency: balanceData.currency,
            exchangeRate: exchangeRate,
            analytics: analytics,
            messages: formattedMessages
        });

    } catch (error) {
        console.error("Twilio Dashboard API Error:", error);
        return NextResponse.json({ success: false, error: "Failed to fetch Twilio data" }, { status: 500 });
    }
}

export async function POST(req) {
    try {
        await connectDB();
        const session = await getServerSession(authOptions);

        const isSuperAdmin = session?.user?.role === 'superAdmin';
        const isAdmin = session?.user?.department === 'admin';

        if (!session || (!isSuperAdmin && !isAdmin)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const { rate } = await req.json();
        
        if (!rate || isNaN(rate)) {
            return NextResponse.json({ error: "Invalid rate" }, { status: 400 });
        }

        await mongoose.connection.collection('settings').updateOne(
            { key: 'usd_to_inr' },
            { $set: { value: parseFloat(rate) } },
            { upsert: true }
        );

        return NextResponse.json({ success: true, rate: parseFloat(rate) });
    } catch (error) {
        console.error("Update Rate Error:", error);
        return NextResponse.json({ success: false, error: "Failed to update exchange rate" }, { status: 500 });
    }
}