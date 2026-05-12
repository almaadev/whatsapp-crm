import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Message from "@/models/Message";
import ProductMessage from "@/models/ProductMessage";
import MDCampMessage from "@/models/MDCampMessage";
import TherapyMessage from "@/models/TherapyMessage";
import Customer from "@/models/Customer";
import redis from "@/lib/redis";

// Map allowed chat types to their respective Mongoose models
const MODEL_MAP = {
    "Product Lead": ProductMessage,
    "MD Camp": MDCampMessage,
    "Therapy": TherapyMessage,
    "Direct Lead": Message // <-- FIX 1: Included Direct Lead to prevent API Crash/Revert
};

export async function POST(req) {
    try {
        await connectDB();
        const body = await req.json();
        
        const rawPhone = body.phone;
        const isChatClosed = body.isChatClosed; 
        const chatType = body.chatType || "Direct Lead"; 

        if (!rawPhone || typeof isChatClosed !== 'boolean') {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const TargetModel = MODEL_MAP[chatType] || Message;
        const phone = rawPhone.startsWith("whatsapp:") ? rawPhone : `whatsapp:${rawPhone}`;

        // 1. Efficiently Update the last message
        const updateData = { isChatClosed };
        if (!isChatClosed) {
            // If reopening the chat, refresh the timestamp to keep session active
            updateData.timestamp = new Date(); 
        }

        const latestMsgDoc = await TargetModel.findOneAndUpdate(
            { phone },
            { $set: updateData },
            { sort: { createdAt: -1 }, new: true } // Update only the absolute latest message
        );

        if (!latestMsgDoc) {
            return NextResponse.json({ error: "No messages found for this chat." }, { status: 404 });
        }

        // 2. Update Customer Active Route
        await Customer.findOneAndUpdate(
            { phone },
            { $set: { activeRouteCategory: chatType } },
            { upsert: true }
        );

        // 3. 🔥 FIX 2: Clear Redis Cache! (Prevents UI from reverting back to old state)
        if (redis && redis.status === 'ready') {
            try {
                await redis.del("chats:all_data");
                await redis.del("chats:main_inbox_data");
            } catch(e) {
                console.error("Redis Cache Clear Error:", e);
            }
        }

        return NextResponse.json({ 
            success: true, 
            message: `Chat closure status updated successfully in ${chatType}.`,
            isChatClosed
        });

    } catch (error) {
        console.error("Chat Status Update Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}