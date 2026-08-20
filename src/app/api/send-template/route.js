import { NextResponse } from "next/server";
import { sendTemplateMessage } from "@/features/admin/services/twilioService";
import connectDB from "@/shared/lib/db/mongodb";
import Message from "@/shared/models/Message";
import Customer from "@/shared/models/Customer";
import { serverCustomerService } from "@/server/services/serverCustomerService";
import { activityService } from "@/server/services/activityService";
import { ActivityEvents, ActivitySources } from "@/shared/constants/activityConstants";
import { getServerSession } from "next-auth";
import { authOptions } from "@/shared/lib/auth";
import { getUserNameById } from "@/shared/utils/userUtils";

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

    let MsgModel = Message;

    const resolvedAssociateName = associateName || (session.user.id ? await getUserNameById(session.user.id, session.user.name || "Unknown") : "Unknown");

    // Store in DB for UI history
    await MsgModel.create({
      phone: formattedTo,
      message: `Template Sent: ${message.body}`, // Formatted for frontend fallback check
      direction: "OUTBOUND",
      status: "SENT",
      twilioSid: message.sid,
      senderNumber: message.senderNumber,
      chatType: chatType || "Direct Lead",
      associateName: resolvedAssociateName,
      senderName: resolvedAssociateName,
      role: session.user.role || "associate",
      isTemplate: true,
      templateSid: templateSid,
      sendBy: session.user.id,
    });

    const { getPhoneVariations, normalizePhone } = await import("@/shared/utils/phoneUtils");
    const phoneVariations = getPhoneVariations(formattedTo);
    let custDoc = await Customer.findOne({ phone: { $in: phoneVariations } });
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

    try {
      const { emitNewMessage } = await import("@/shared/utils/socketPublisher");
      const resolvedName = resolvedAssociateName;
      const branchId = custDoc?.branchId ? (custDoc.branchId._id ? custDoc.branchId._id.toString() : custDoc.branchId.toString()) : null;

      emitNewMessage({
        customerId: custDoc?._id ? custDoc._id.toString() : undefined,
        phone: formattedTo,
        canonicalPhone: normalizePhone(formattedTo),
        name: custDoc?.name || resolvedName,
        customerName: custDoc?.name,
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
        branchId,
        isClosed: custDoc?.isClosed || false,
        isChatClosed: custDoc?.isClosed || false,
      }, branchId);
    } catch (socketErr) {
      console.error("[send-template] Socket emit error:", socketErr);
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
