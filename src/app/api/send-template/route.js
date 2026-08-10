import { NextResponse } from "next/server";
import { sendTemplateMessage } from "@/features/admin/services/twilioService";
import connectDB from "@/shared/lib/db/mongodb";
import Message from "@/shared/models/Message";
import Customer from "@/shared/models/Customer";
import User from "@/shared/models/User";
import { serverCustomerService } from "@/server/services/serverCustomerService";
import { activityService } from "@/server/services/activityService";
import { ActivityEvents, ActivitySources } from "@/shared/constants/activityConstants";
import { getServerSession } from "next-auth";
import { authOptions } from "@/shared/lib/auth";
const findUserNameById = async (id) => {
  const user = await User.findById(id).lean();
  return user ? user.name : "Unknown";
};
export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await connectDB();

    const { phone, templateSid, chatType, associateName, contentVariables, senderNumber } =
      await req.json();

    if (!phone || !templateSid)
      return NextResponse.json(
        { error: "Phone and Template SID required" },
        { status: 400 },
      );

    const formattedTo = phone.startsWith("whatsapp:")
      ? phone
      : `whatsapp:${phone}`;

    const message = await sendTemplateMessage(formattedTo, templateSid, contentVariables, {
      senderNumber,
      user: session.user,
    });
    console.log(message);

    let MsgModel = Message;

    // Store in DB for UI history
    await MsgModel.create({
      phone: formattedTo,
      message: `Template Sent: ${message.body}`, // Formatted for frontend fallback check
      direction: "OUTBOUND",
      status: "SENT",
      twilioSid: message.sid,
      senderNumber: message.senderNumber,
      chatType: chatType || "Direct Lead",
      associateName: associateName || (await findUserNameById(session.user.id)) || "Unknown",
      senderName: associateName || (await findUserNameById(session.user.id)) || "Unknown",
      role: session.user.role || "associate",
      isTemplate: true,
      templateSid: templateSid,
      sendBy: session.user.id,
    });

    let custDoc = await Customer.findOne({ phone: formattedTo });
    if (!custDoc) {
      const { customer } = await serverCustomerService.updateCustomer(formattedTo, { status: "New" }, session);
      custDoc = customer;
    } else {
      await Customer.updateOne(
        { _id: custDoc._id },
        { $set: { lastInteractionAt: new Date() } }
      );
    }

    await activityService.log({
      eventType: ActivityEvents.TEMPLATE_SENT,
      entityType: "Message",
      customerId: custDoc._id,
      actorId: session.user.id,
      source: ActivitySources.WEB,
      metadata: {
        templateName: templateSid,
        notes: `Template Sent: ${templateSid}`
      }
    });

    if (global.io) {
      const resolvedName = associateName || (await findUserNameById(session.user.id)) || "Unknown";
      global.io.emit("new_message", {
        phone: formattedTo,
        message: `Template Sent: ${message.body}`,
        direction: "OUTBOUND",
        status: "SENT",
        twilioSid: message.sid,
        chatType: chatType || "Direct Lead",
        timestamp: new Date().toISOString(),
        sendBy: {
          _id: session.user.id,
          name: session.user.name,
        },
        senderName: resolvedName,
        senderRole: session.user.role || "associate",
      });
    }

    return NextResponse.json(
      { success: true, messageSid: message.sid },
      { status: 200 },
    );
  } catch (error) {
    console.error("Send Template Error:", error);
    const isForbidden = error.message && (error.message.includes("Forbidden") || error.message.includes("permission") || error.message.includes("assigned"));
    const isValidationError = error.message && error.message.includes("Validation Failed");
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: isForbidden ? 403 : isValidationError ? 400 : 500 },
    );
  }
}
