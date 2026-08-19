import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/shared/lib/auth";
import connectDB from "@/shared/lib/db/mongodb";
import Customer from "@/shared/models/Customer";
import Lead from "@/shared/models/Lead";
import Branch from "@/shared/models/Branch";
import CustomerAddress from "@/shared/models/CustomerAddress";
import Message from "@/shared/models/Message";
import CRMTemplate from "@/shared/models/CRMTemplate";
import { resolveTemplate } from "@/shared/utils/templateResolver";
import { sendWhatsAppMessage } from "@/features/admin/services/twilioService";
import { serverCustomerService } from "@/server/services/serverCustomerService";
import { activityService } from "@/server/services/activityService";
import { ActivityEvents, ActivitySources } from "@/shared/constants/activityConstants";
import { normalizePhone, getPhoneVariations } from "@/shared/utils/phoneUtils";
import { emitNewMessage } from "@/shared/utils/socketPublisher";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { phone, templateId, senderNumber, chatType } = body || {};

    if (!phone || !templateId) {
      return NextResponse.json(
        { success: false, error: "Phone number and CRM Template ID are required." },
        { status: 400 }
      );
    }

    await connectDB();

    // 1. Fetch CRM Template from Database
    const template = await CRMTemplate.findById(templateId).lean();
    if (!template || template.isArchived) {
      return NextResponse.json(
        { success: false, error: "CRM Template not found or has been archived." },
        { status: 404 }
      );
    }

    if (!template.isActive) {
      return NextResponse.json(
        { success: false, error: "This CRM Template is currently deactivated." },
        { status: 400 }
      );
    }

    // 2. Fetch Customer & Associated Context
    const phoneVariations = getPhoneVariations(phone);
    let customerDoc = await Customer.findOne({ phone: { $in: phoneVariations } })
      .populate("currentAddressId")
      .lean();

    if (!customerDoc) {
      const { customer } = await serverCustomerService.updateCustomer(phone, { status: "New", source: "Whatsapp" }, session);
      customerDoc = customer;
    }

    if (customerDoc?.isOptedOut) {
      return NextResponse.json(
        { success: false, error: "Customer has opted out of WhatsApp messages." },
        { status: 400 }
      );
    }

    // 3. Fetch Lead, Address, and Branch Context
    let leadDoc = null;
    if (customerDoc?._id) {
      leadDoc = await Lead.findOne({ customerId: customerDoc._id }).lean();
    }

    let branchDoc = null;
    if (customerDoc?.branchId) {
      branchDoc = await Branch.findById(customerDoc.branchId).lean();
    }

    const customerAddress = customerDoc?.currentAddressId || {};

    // 4. Resolve Template Variables Server-Side
    const { resolvedText, resolvedVariables, missingVariables, isValid } = resolveTemplate({
      template,
      customer: customerDoc,
      lead: leadDoc,
      branch: branchDoc,
      customerAddress,
    });

    if (!isValid && missingVariables.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Missing required template variable(s): ${missingVariables.map((v) => `{{${v}}}`).join(", ")}. Please update customer details first.`,
          missingVariables,
        },
        { status: 400 }
      );
    }

    if (!resolvedText) {
      return NextResponse.json(
        { success: false, error: "Generated template message is empty." },
        { status: 400 }
      );
    }

    // 5. Check 24-Hour WhatsApp Customer-Service Window & Session State
    // Free-form/CRM text messages require an active session / recent customer interaction.
    const lastInteraction = customerDoc?.lastInteractionAt ? new Date(customerDoc.lastInteractionAt) : null;
    const now = new Date();
    const isOutside24Hours = !lastInteraction || (now - lastInteraction) > (24 * 60 * 60 * 1000);

    // If chat is explicitly closed and outside 24h, WhatsApp requires an approved template
    if (customerDoc?.isClosed && isOutside24Hours) {
      return NextResponse.json(
        {
          success: false,
          error: "Outside 24-hour WhatsApp customer-service window. An approved WhatsApp Template must be used to initiate or reopen contact.",
          requiresWhatsAppTemplate: true,
        },
        { status: 400 }
      );
    }

    // 6. Send via Existing Centralized Twilio Service
    let twilioSid = "sys_crm_msg_" + Date.now();
    let actualSenderNumber = senderNumber;

    try {
      const sent = await sendWhatsAppMessage(phone, resolvedText, {
        senderNumber,
        user: session.user,
      });
      twilioSid = sent.sid;
      actualSenderNumber = sent.senderNumber;
    } catch (twilioErr) {
      console.error("[POST /api/crm-templates/send] Twilio error:", twilioErr);
      return NextResponse.json(
        { success: false, error: twilioErr.message || "Failed to deliver WhatsApp message via Twilio." },
        { status: twilioErr.message?.includes("Forbidden") ? 403 : 400 }
      );
    }

    const isoTimestamp = new Date().toISOString();

    // 7. Persist Outbound Message with Consistent Template Metadata
    const savedMessage = await Message.create({
      phone,
      message: resolvedText,
      direction: "OUTBOUND",
      status: "SENT",
      twilioSid,
      senderName: session.user.name || "Associate",
      senderNumber: actualSenderNumber,
      role: session.user.role || "associate",
      sendBy: session.user.id,
      chatType: chatType || customerDoc?.activeRouteCategory || "Direct Lead",
      isTemplate: true,
      templateMetadata: {
        type: "crm",
        templateId: template._id,
        templateName: template.name,
        version: template.version || 1,
        source: "manual",
        variables: resolvedVariables,
      },
      timestamp: new Date(isoTimestamp),
    });

    // 8. Update Customer Last Interaction
    await Customer.updateOne(
      { _id: customerDoc._id },
      { $set: { lastInteractionAt: new Date() } }
    );

    // 9. Emit Realtime Socket Event
    try {
      const branchId = customerDoc?.branchId
        ? (customerDoc.branchId._id ? customerDoc.branchId._id.toString() : customerDoc.branchId.toString())
        : null;

      emitNewMessage(
        {
          _id: savedMessage._id.toString(),
          customerId: customerDoc?._id ? customerDoc._id.toString() : undefined,
          phone,
          canonicalPhone: normalizePhone(phone),
          customerName: customerDoc?.name,
          name: customerDoc?.name || session.user.name || phone,
          message: resolvedText,
          direction: "OUTBOUND",
          timestamp: isoTimestamp,
          status: "SENT",
          role: session.user.role || "sales",
          sendBy: { _id: session.user.id, name: session.user.name },
          twilioSid,
          branchId,
          isClosed: customerDoc?.isClosed || false,
          isChatClosed: customerDoc?.isClosed || false,
          isTemplate: true,
          templateMetadata: savedMessage.templateMetadata,
        },
        branchId
      );
    } catch (socketErr) {
      console.error("[POST /api/crm-templates/send] Socket emit error:", socketErr);
    }

    return NextResponse.json({
      success: true,
      message: "CRM template message sent successfully.",
      data: {
        messageId: savedMessage._id,
        twilioSid,
        resolvedText,
        templateName: template.name,
        version: template.version || 1,
      },
    });
  } catch (error) {
    console.error("[POST /api/crm-templates/send] Fatal error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "An unexpected server error occurred." },
      { status: 500 }
    );
  }
}
