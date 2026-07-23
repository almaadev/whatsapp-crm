import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/shared/lib/auth";
import connectDB from "@/shared/lib/db/mongodb";
import mongoose from "mongoose";
import twilio from "twilio";
import TwilioNumber from "@/shared/models/TwilioNumber";
import Branch from "@/shared/models/Branch";
import User from "@/shared/models/User";
import { getAvailableNumbers, formatPhoneNumber } from "@/features/admin/services/twilioService";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    await connectDB();
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isSuperAdmin = session.user.role === "superAdmin";
    const isAdmin = session.user.department === "admin";

    // Non-admin associates (e.g. sales/doctor telecallers) fetching active senders for chat/bulk messaging
    if (!isSuperAdmin && !isAdmin) {
      const numbers = await getAvailableNumbers(session.user);
      const branches = await Branch.find({ status: "active" }).select("name code address phone").lean();
      return NextResponse.json({
        success: true,
        numbers,
        branches,
      });
    }

    const { searchParams } = new URL(req.url);
    const limitParam = searchParams.get("limit") || "100";
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const status = searchParams.get("status");
    const mode = searchParams.get("mode");

    let fetchLimit = limitParam === "all" ? undefined : parseInt(limitParam, 10);

    let exchangeRate = 83.5;
    const rateDoc = await mongoose.connection.collection("settings").findOne({ key: "usd_to_inr" });
    if (rateDoc && rateDoc.value) exchangeRate = parseFloat(rateDoc.value);

    // Fetch Twilio Numbers & Branches from DB
    const numbers = await getAvailableNumbers(session.user);
    const branches = await Branch.find({ status: "active" }).select("name code address phone").lean();

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    let balanceData = { balance: "0.00", currency: "USD" };
    if (mode !== "export" && accountSid && authToken) {
      try {
        const authHeader = `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`;
        const balanceRes = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Balance.json`,
          { headers: { Authorization: authHeader } }
        );
        if (balanceRes.ok) balanceData = await balanceRes.json();
      } catch (err) {
        console.error("Twilio Balance Fetch Error:", err.message);
      }
    }

    let formattedMessages = [];
    let delivered = 0, failed = 0, inbound = 0, outbound = 0, media = 0;
    let totalCost = 0;

    if (accountSid && authToken) {
      try {
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

        messages.forEach((msg) => {
          const msgStatus = msg.status?.toLowerCase() || "";
          if (!filterByGroupedStatus(msgStatus, status)) return;

          const numMedia = Number(msg.numMedia || 0);
          const price = Math.abs(Number(msg.price || 0));
          const isOutbound = msg.direction.includes("outbound");

          if (["delivered", "read"].includes(msgStatus)) delivered++;
          if (["failed", "undelivered"].includes(msgStatus)) failed++;
          if (isOutbound) outbound++;
          else inbound++;
          if (numMedia > 0) media++;
          totalCost += price;

          formattedMessages.push({
            id: msg.sid,
            dateSent: msg.dateSent,
            direction: msg.direction,
            from: msg.from,
            to: msg.to,
            body: msg.body || "",
            numMedia: numMedia,
            status: msg.status,
            price: price.toFixed(4),
            errorMessage: msg.errorMessage || "",
          });
        });
      } catch (err) {
        console.error("Twilio message list error:", err.message);
      }
    }

    if (mode === "export") {
      const headers = ["SID", "Timestamp", "Direction", "From", "To", "Message Content", "Status", "Cost (USD)", "Cost (INR)", "Media Count", "Error Message"];
      const csvRows = formattedMessages.map((msg) => {
        const costUsd = Number(msg.price);
        const costInr = (costUsd * exchangeRate).toFixed(4);
        const body = `"${msg.body.replace(/"/g, '""')}"`;
        const errorMsg = `"${msg.errorMessage.replace(/"/g, '""')}"`;
        return `"${msg.id}","${msg.dateSent}","${msg.direction}","${msg.from}","${msg.to}",${body},"${msg.status}","${costUsd}","${costInr}","${msg.numMedia}",${errorMsg}`;
      });

      const csvContent = [headers.join(","), ...csvRows].join("\n");
      return new NextResponse(csvContent, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": 'attachment; filename="enterprise_twilio_logs.csv"',
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
      totalCostUsd: totalCost.toFixed(4),
      totalCostInr: (totalCost * exchangeRate).toFixed(2),
      deliveryRate: formattedMessages.length > 0 ? ((delivered / formattedMessages.length) * 100).toFixed(1) : 0,
    };

    return NextResponse.json({
      success: true,
      balance: balanceData.balance,
      currency: balanceData.currency,
      exchangeRate,
      analytics,
      messages: formattedMessages,
      numbers,
      branches,
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

    const isSuperAdmin = session?.user?.role === "superAdmin";
    const isAdmin = session?.user?.department === "admin";

    if (!session || (!isSuperAdmin && !isAdmin)) {
      return NextResponse.json({ error: "Forbidden: Admin access required." }, { status: 403 });
    }

    const body = await req.json();

    // 1. Update USD exchange rate
    if (body.rate !== undefined) {
      const rate = parseFloat(body.rate);
      if (isNaN(rate)) return NextResponse.json({ error: "Invalid rate" }, { status: 400 });

      await mongoose.connection.collection("settings").updateOne(
        { key: "usd_to_inr" },
        { $set: { value: rate } },
        { upsert: true }
      );
      return NextResponse.json({ success: true, rate });
    }

    // 2. Add New Twilio Number (Super Admin Only)
    if (body.action === "addNumber") {
      if (!isSuperAdmin) {
        return NextResponse.json({ error: "Only Super Admin can add new Twilio numbers." }, { status: 403 });
      }

      const { friendlyName, phoneNumber, twilioSenderSid, branchId } = body;
      if (!friendlyName || !phoneNumber) {
        return NextResponse.json({ error: "Friendly Name and Phone Number are required." }, { status: 400 });
      }

      const formattedNum = formatPhoneNumber(phoneNumber);

      const existing = await TwilioNumber.findOne({ phoneNumber: formattedNum });
      if (existing) {
        return NextResponse.json({ error: `Phone number ${formattedNum} already exists.` }, { status: 400 });
      }

      const newNumber = await TwilioNumber.create({
        friendlyName: friendlyName.trim(),
        phoneNumber: formattedNum,
        twilioSenderSid: twilioSenderSid || "",
        branchId: branchId || null,
        status: "active",
        isActive: true,
        createdBy: session.user.id,
      });

      if (branchId) {
        await Branch.findByIdAndUpdate(branchId, {
          $addToSet: { assignedTwilioNumbers: newNumber._id },
        });
      }

      return NextResponse.json({ success: true, number: newNumber });
    }

    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
  } catch (error) {
    console.error("Twilio Admin POST Error:", error);
    return NextResponse.json({ success: false, error: "Failed to process request." }, { status: 500 });
  }
}