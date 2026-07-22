import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/shared/lib/auth";
import connectDB from "@/shared/lib/db/mongodb";
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
        const mode = searchParams.get("mode"); // 'export' or null
        
        let fetchLimit = limitParam === "all" ? undefined : parseInt(limitParam, 10);

        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        const client = twilio(accountSid, authToken);

        const fetchOptions = {};
        if (fetchLimit) fetchOptions.limit = fetchLimit;

        if (startDate) fetchOptions.dateSentAfter = new Date(startDate);
        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            fetchOptions.dateSentBefore = end;
        }

        const messages = await client.messages.list(fetchOptions);

        const filterByGroupedStatus = (msgStatus, targetStatus) => {
            if (!targetStatus || targetStatus === 'all') return true;
            const s = msgStatus?.toLowerCase() || "";
            const t = targetStatus.toLowerCase();
            if (t === 'delivered') return s === 'delivered';
            if (t === 'read') return s === 'read';
            if (t === 'failed') return ['failed', 'undelivered'].includes(s);
            if (t === 'sent' || t === 'queued') return ['queued', 'accepted', 'scheduled', 'sending', 'sent'].includes(s);
            return s === t;
        };

        let delivered = 0, failed = 0, inbound = 0, outbound = 0, media = 0;

        let formattedMessages = [];
        
        messages.forEach(msg => {
            const msgStatus = msg.status?.toLowerCase() || "";

            // 1. Apply Server-Side Status Filter FIRST
            if (!filterByGroupedStatus(msgStatus, status)) {
                return;
            }

            const numMedia = Number(msg.numMedia || 0);
            const isOutbound = msg.direction.includes('outbound');

            // 2. Recalculate Analytics on Filtered Dataset
            if (['delivered', 'read'].includes(msgStatus)) delivered++;
            if (['failed', 'undelivered'].includes(msgStatus)) failed++;
            if (isOutbound) outbound++; else inbound++;
            if (numMedia > 0) media++;

            formattedMessages.push({
                id: msg.sid,
                dateSent: msg.dateSent,
                direction: msg.direction,
                from: msg.from,
                to: msg.to,
                body: msg.body || "",
                numMedia: numMedia,
                status: msg.status,
                errorMessage: msg.errorMessage || ""
            });
        });

        // ─── ENTERPRISE DIRECT CSV EXPORT MODE ───
        if (mode === "export") {
            const search = searchParams.get("search")?.toLowerCase() || "";
            const directionFilter = searchParams.get("direction") || "all";
            const mediaOnly = searchParams.get("mediaOnly") === "true";
            const failedOnly = searchParams.get("failedOnly") === "true";

            // Apply Client-Side equivalent filters on Server before exporting
            formattedMessages = formattedMessages.filter(msg => {
                if (search) {
                    const toMatch = msg.to?.toLowerCase().includes(search);
                    const fromMatch = msg.from?.toLowerCase().includes(search);
                    const bodyMatch = msg.body?.toLowerCase().includes(search);
                    const sidMatch = msg.id?.toLowerCase().includes(search);
                    if (!toMatch && !fromMatch && !bodyMatch && !sidMatch) return false;
                }
                if (directionFilter !== "all") {
                    const isOut = msg.direction?.includes('outbound');
                    if (directionFilter === "outbound" && !isOut) return false;
                    if (directionFilter === "inbound" && isOut) return false;
                }
                if (mediaOnly && msg.numMedia === 0) return false;
                if (failedOnly && !['failed', 'undelivered'].includes(msg.status?.toLowerCase())) return false;
                return true;
            });

            // NO PRICING FIELDS for this generic log interface
            const headers = ["SID", "Timestamp", "Direction", "From", "To", "Message Content", "Status", "Media Count", "Error Message"];
            const csvRows = formattedMessages.map(msg => {
                const body = `"${msg.body.replace(/"/g, '""')}"`;
                const errorMsg = `"${msg.errorMessage.replace(/"/g, '""')}"`;
                return `"${msg.id}","${msg.dateSent}","${msg.direction}","${msg.from}","${msg.to}",${body},"${msg.status}","${msg.numMedia}",${errorMsg}`;
            });

            const csvContent = [headers.join(","), ...csvRows].join("\n");
            
            return new NextResponse(csvContent, {
                headers: {
                    'Content-Type': 'text/csv',
                    'Content-Disposition': 'attachment; filename="enterprise_message_archive.csv"'
                }
            });
        }

        // ─── STANDARD JSON MODE ───
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