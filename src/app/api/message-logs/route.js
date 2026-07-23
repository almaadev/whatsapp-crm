import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/shared/lib/auth";
import connectDB from "@/shared/lib/db/mongodb";
import twilio from "twilio";
import TwilioNumber from "@/shared/models/TwilioNumber";
import Branch from "@/shared/models/Branch";
import { formatPhoneNumber } from "@/features/admin/services/twilioService";

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
    const mode = searchParams.get("mode");
    const branchFilter = searchParams.get("branchId");
    const numberFilter = searchParams.get("businessNumber");

    let fetchLimit = limitParam === "all" ? undefined : parseInt(limitParam, 10);

    // Fetch all Twilio numbers and branches to map metadata
    const twilioNumbers = await TwilioNumber.find().populate("branchId").lean();
    const numberMap = {};
    twilioNumbers.forEach((tn) => {
      const cleanNum = formatPhoneNumber(tn.phoneNumber);
      numberMap[cleanNum] = {
        friendlyName: tn.friendlyName || cleanNum,
        branchId: tn.branchId?._id?.toString() || null,
        branchName: tn.branchId?.name || "Unassigned",
      };
    });

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
      if (!targetStatus || targetStatus === "all") return true;
      const s = msgStatus?.toLowerCase() || "";
      const t = targetStatus.toLowerCase();
      if (t === "delivered") return s === "delivered";
      if (t === "read") return s === "read";
      if (t === "failed") return ["failed", "undelivered"].includes(s);
      if (t === "sent" || t === "queued") return ["queued", "accepted", "scheduled", "sending", "sent"].includes(s);
      return s === t;
    };

    let delivered = 0, failed = 0, inbound = 0, outbound = 0, media = 0;
    let formattedMessages = [];

    messages.forEach((msg) => {
      const msgStatus = msg.status?.toLowerCase() || "";
      if (!filterByGroupedStatus(msgStatus, status)) return;

      const isOutbound = msg.direction?.includes("outbound");
      const bizNumRaw = isOutbound ? msg.from : msg.to;
      const cleanBizNum = formatPhoneNumber(bizNumRaw);
      const numberMeta = numberMap[cleanBizNum] || {
        friendlyName: cleanBizNum || "Default Sender",
        branchId: null,
        branchName: "Unassigned",
      };

      // Filter by Business Number or Branch if specified
      if (numberFilter && numberFilter !== "all" && cleanBizNum !== formatPhoneNumber(numberFilter)) {
        return;
      }
      if (branchFilter && branchFilter !== "all" && numberMeta.branchId !== branchFilter) {
        return;
      }

      const numMedia = Number(msg.numMedia || 0);

      if (["delivered", "read"].includes(msgStatus)) delivered++;
      if (["failed", "undelivered"].includes(msgStatus)) failed++;
      if (isOutbound) outbound++;
      else inbound++;
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
        errorMessage: msg.errorMessage || "",
        businessNumber: cleanBizNum,
        friendlyName: numberMeta.friendlyName,
        branchName: numberMeta.branchName,
        branchId: numberMeta.branchId,
      });
    });

    if (mode === "export") {
      const headers = ["SID", "Timestamp", "Direction", "Business Number", "Friendly Name", "Branch", "From", "To", "Message Content", "Status", "Media Count", "Error Message"];
      const csvRows = formattedMessages.map((msg) => {
        const body = `"${msg.body.replace(/"/g, '""')}"`;
        const errorMsg = `"${msg.errorMessage.replace(/"/g, '""')}"`;
        return `"${msg.id}","${msg.dateSent}","${msg.direction}","${msg.businessNumber}","${msg.friendlyName}","${msg.branchName}","${msg.from}","${msg.to}",${body},"${msg.status}","${msg.numMedia}",${errorMsg}`;
      });

      const csvContent = [headers.join(","), ...csvRows].join("\n");

      return new NextResponse(csvContent, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": 'attachment; filename="enterprise_message_archive.csv"',
        },
      });
    }

    const analytics = {
      total: formattedMessages.length,
      delivered,
      failed,
      inbound,
      outbound,
      media,
    };

    return NextResponse.json({
      success: true,
      analytics,
      messages: formattedMessages,
      configuredNumbers: twilioNumbers,
    });
  } catch (error) {
    console.error("Message Logs API Error:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch logs" }, { status: 500 });
  }
}