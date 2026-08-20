import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/shared/lib/auth";
import connectDB from "@/shared/lib/db/mongodb";
import Customer from "@/shared/models/Customer";
import Message from "@/shared/models/Message";
import redis from "@/shared/lib/db/redis"; 
import User from "@/shared/models/User";
import { activityService } from "@/server/services/activityService";
import { ActivityEvents, ActivitySources } from "@/shared/constants/activityConstants";
import { sendWhatsAppMessage } from "@/features/admin/services/twilioService";

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { customerPhone, targetPhone, message, associateName } = await req.json();
    if (!customerPhone || !targetPhone) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

    // 1. Send WhatsApp to the Associate via Twilio
    try {
      await sendWhatsAppMessage(targetPhone, message);
    } catch (e) { console.error("Twilio Error", e); }

    // 2. Update MongoDB
    await connectDB();
    const forwardedBy = session.user.name;

    const targetUser = await User.findOne({ name: associateName }).lean();
    const targetUserId = targetUser?._id;

    const customerDoc = await Customer.findOne({ phone: customerPhone });
    if (customerDoc) {
      const oldAssignedTo = customerDoc.assignedTo;
      
      customerDoc.assignedTo = associateName;
      if (targetUserId) customerDoc.assignedUserId = targetUserId;
      await customerDoc.save();

      await activityService.log({
        eventType: ActivityEvents.LEAD_ASSIGNED,
        entityType: "Lead",
        customerId: customerDoc._id,
        actorId: session.user.id,
        source: ActivitySources.WEB,
        metadata: {
          oldOwner: oldAssignedTo,
          newOwner: associateName,
          notes: `Forwarded to ${associateName} by ${forwardedBy}`,
          targetUserName: associateName
        }
      });
    }

    // Add a system message to Chat History
    const sysMessage = `[System]: Lead forwarded to ${associateName} by ${forwardedBy}`;
    await Message.create({
      phone: customerPhone,
      message: sysMessage,
      direction: "OUTBOUND",
      status: "READ",
      twilioSid: "sys_" + Date.now(),
      senderName: "Auto Answer",
      senderType: "system",
      isAutomated: true,
      sendBy: null
    });

    // 3. Clear Cache
    try { await redis.del("chats:all_data"); } catch (e) {}

    // 4. Socket event for Real-time Dashboard Update
    if (global.io) {
        global.io.emit("new_message", {
            phone: customerPhone, 
            name: `Lead: ${customerPhone}`,
            message: sysMessage, 
            direction: "INBOUND", 
            timestamp: new Date().toISOString(),
            status: "RECEIVED",
            read: "FALSE",
            isForwarded: true,
            forwardedBy: forwardedBy,
            assignedTo: associateName
        });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Forward Lead Error:", error);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}