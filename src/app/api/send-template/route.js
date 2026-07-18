import { NextResponse } from "next/server";
import twilio from "twilio";
import connectDB from "@/shared/lib/db/mongodb";
import Message from "@/shared/models/Message";
import Customer from "@/shared/models/Customer";
import User from "@/shared/models/User";
import { getServerSession } from "next-auth";
import { authOptions } from "@/shared/lib/auth";

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN,
);
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

    const { phone, templateSid, chatType, associateName, contentVariables } =
      await req.json();

    if (!phone || !templateSid)
      return NextResponse.json(
        { error: "Phone and Template SID required" },
        { status: 400 },
      );

    const twilioPhoneNumber =
      process.env.NEXT_PUBLIC_TWILIO_PHONE_NUMBER || "whatsapp:+14155238886";
    const formattedTo = phone.startsWith("whatsapp:")
      ? phone
      : `whatsapp:${phone}`;
    const formattedFrom = twilioPhoneNumber.startsWith("whatsapp:")
      ? twilioPhoneNumber
      : `whatsapp:${twilioPhoneNumber}`;
    const callbackUrl = process.env.NEXT_PUBLIC_BASE_URL
      ? `${process.env.NEXT_PUBLIC_BASE_URL}/api/webhook/status`
      : "https://nonarsenic-nonparous-clotilde.ngrok-free.dev/api/webhook/status";
    const messagePayload = {
      contentSid: templateSid,
      from: formattedFrom,
      to: formattedTo,
      // 🚀 NOTE: Unngaluku thevaipattal Twilio Status Webhook URL-ai inge add seiyyalam
      statusCallback: callbackUrl,
    };

    // Inject Dynamic Variables into Twilio Payload
    if (contentVariables && Object.keys(contentVariables).length > 0) {
      messagePayload.contentVariables = JSON.stringify(contentVariables);
    }

    const message = await client.messages.create(messagePayload);
    console.log(message);
    
    // 🚀 THE FIX: Dynamically select the correct MongoDB Collection based on chatType
    let MsgModel = Message;
    
    if (chatType === "Product Lead")
      MsgModel = (await import("@/shared/models/ProductMessage")).default;
    else if (chatType === "MD Camp")
      MsgModel = (await import("@/shared/models/MDCampMessage")).default;
    else if (chatType === "Therapy")
      MsgModel = (await import("@/shared/models/TherapyMessage")).default;

    // Store in DB for UI history
    await MsgModel.create({
      phone: formattedTo,
      message: `Template Sent: ${message.body}`, // Formatted for frontend fallback check
      direction: "OUTBOUND",
      status: "SENT",
      twilioSid: message.sid,
      chatType: chatType || "Direct Lead",
      associateName: associateName || (await findUserNameById(session.user.id)) || "Unknown",
      senderName: associateName || (await findUserNameById(session.user.id)) || "Unknown",
      role: session.user.role || "associate",
      isTemplate: true,
      templateSid: templateSid,
      sendBy: session.user.id,
    });

    await Customer.findOneAndUpdate(
      { phone: formattedTo },
      { 
        lastMessageAt: new Date(), 
        $setOnInsert: { 
          status: "New", 
          createdBy: session.user.id,
          chatHistory: [{
              action: "Started",
              performedBy: session.user.id,
              timestamp: new Date(),
              notes: "First template sent"
          }]
        } 
      },
      { upsert: true },
    );

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
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
