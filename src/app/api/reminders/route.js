import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/db/mongodb";
import Reminder from "@/models/Reminder";
import Message from "@/models/Message";
import User from "@/models/User";
import twilio from "twilio";
import redis from "@/lib/db/redis";

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await connectDB();
    const body = await req.json();
    const findUserNameById = async (id) => {
      const user = await User.findById(id).lean();
      return user ? user.name : "Unknown";
    };
    // --- 1. SET NEW REMINDER ---
    if (body.action === "SET") {
      const { phone, message, date, time } = body;
      const scheduledTime = new Date(`${date}T${time}`);

      await Reminder.updateMany(
        { phone, status: "PENDING" },
        { status: "CANCELLED" },
      );

      await Reminder.create({
        associate: session.user.id && await findUserNameById(session.user.id) || "Unknown",
        phone: phone,
        message: message,
        scheduledTime: scheduledTime,
        status: "PENDING",
      });

      return NextResponse.json({ success: true, message: "Reminder Set" });
    }

    // --- 2. GET ACTIVE REMINDER ---
    if (body.action === "GET") {
      const { phone } = body;
      const activeReminder = await Reminder.findOne({
        phone,
        status: "PENDING",
      })
        .sort({ createdAt: -1 })
        .lean();

      if (activeReminder) {
        return NextResponse.json({
          success: true,
          reminder: {
            date: activeReminder.scheduledTime,
            message: activeReminder.message,
            associate: activeReminder.associate,
          },
        });
      }
      return NextResponse.json({ success: true, reminder: null });
    }

    // --- 3. CANCEL REMINDER ---
    if (body.action === "CANCEL") {
      const { phone } = body;
      await Reminder.updateMany(
        { phone, status: "PENDING" },
        { status: "CANCELLED" },
      );
      return NextResponse.json({
        success: true,
        message: "Reminder Cancelled",
      });
    }

    // --- 4. CHECK & PROCESS DUE ---
    if (body.action === "CHECK") {
      const now = new Date();
      // Time ஆகிவிட்ட Reminders-ஐ மட்டும் கண்டுபிடி
      const dueReminders = await Reminder.find({
        status: "PENDING",
        scheduledTime: { $lte: now },
      });

      if (dueReminders.length === 0)
        return NextResponse.json({ success: true, processed: [] });

      const client = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN,
      );
      const myTwilioNumber = process.env.NEXT_PUBLIC_TWILIO_PHONE_NUMBER;
      const processed = [];

      for (const reminder of dueReminders) {
        try {
          const formattedPhone = reminder.phone.startsWith("whatsapp:")
            ? reminder.phone
            : `whatsapp:${reminder.phone}`;

          const sent = await client.messages.create({
            body: `[Reminder]: ${reminder.message}`,
            from: myTwilioNumber,
            to: formattedPhone,
          });

          // Message DB-ல் சேவ் செய்
          await Message.create({
            phone: reminder.phone,
            message: `[Reminder]: ${reminder.message}`,
            direction: "OUTBOUND",
            status: "SENT",
            twilioSid: sent.sid,
            senderName: reminder.associate,
          });

          // UI-க்கு லைவ்வாக அனுப்பு
          if (global.io) {
            global.io.emit("new_message", {
              phone: reminder.phone,
              message: `[Reminder]: ${reminder.message}`,
              direction: "OUTBOUND",
              timestamp: new Date().toISOString(),
              status: "SENT",
              role: "sales",
              name: reminder.associate,
            });
          }

          reminder.status = "DONE";
          await reminder.save();

          processed.push({
            phone: reminder.phone,
            message: reminder.message,
            associate: reminder.associate,
          });
        } catch (e) {
          console.error(`Reminder Send Failed for ${reminder.phone}`, e);
        }
      }

      if (redis && redis.status === "ready") await redis.del("chats:all_data");

      return NextResponse.json({ success: true, processed });
    }

    return NextResponse.json({ error: "Invalid Action" }, { status: 400 });
  } catch (error) {
    console.error("Reminder API Error:", error);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}
