import { NextResponse } from "next/server";
import connectDB from "@/shared/lib/db/mongodb";
import { getServerSession } from "next-auth";
import { authOptions } from "@/shared/lib/auth";
import Message from "@/shared/models/Message";
import ProductMessage from "@/shared/models/ProductMessage";
import MDCampMessage from "@/shared/models/MDCampMessage";
import TherapyMessage from "@/shared/models/TherapyMessage";
import Customer from "@/shared/models/Customer";

export async function POST(req) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        await connectDB();
        const { phone, isChatClosed, chatType } = await req.json();

        if (!phone || typeof isChatClosed !== 'boolean') {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // Determine which model to update based on chatType
        let ModelToUpdate;
        switch (chatType) {
            case "Product Lead": ModelToUpdate = ProductMessage; break;
            case "MD Camp": ModelToUpdate = MDCampMessage; break;
            case "Therapy": ModelToUpdate = TherapyMessage; break;
            default: ModelToUpdate = Message; break;
        }

        // 1. Update the specific category message history
        const result = await ModelToUpdate.updateMany(
            { phone: phone },
            { $set: { isChatClosed: isChatClosed } }
        );

        // 2. Also keep the central Message collection in sync
        if (ModelToUpdate !== Message) {
             await Message.updateMany(
                { phone: phone },
                { $set: { isChatClosed: isChatClosed } }
            );
        }

        const now = new Date();
        const chatHistoryEntry = {
            action: isChatClosed ? "Closed" : "Reopened",
            eventType: isChatClosed ? "Chat Closed" : "Chat Reopened",
            performedBy: session.user.id,
            performedById: session.user.id,
            performedByName: session.user.name || "User",
            performedByRole: session.user.role || "associate",
            performedAt: now,
            timestamp: now,
            notes: isChatClosed ? "Chat marked as closed" : "Chat reopened"
        };

        const customerUpdate = {
            $push: { chatHistory: chatHistoryEntry },
            $set: { isClosed: isChatClosed }
        };

        if (isChatClosed === true) {
            customerUpdate.$set.activeRouteCategory = "Direct Lead";
        }

        await Customer.findOneAndUpdate(
            { phone: phone },
            customerUpdate
        );

        if (global.io) {
            global.io.emit("chat_status_updated", { phone, isChatClosed, isClosed: isChatClosed, chatType });
            global.io.emit("customer_updated", { phone, isClosed: isChatClosed });
        }

        return NextResponse.json({
            success: true,
            modifiedCount: result.modifiedCount,
            message: isChatClosed ? "Chat marked as closed and routing reset." : "Chat reopened."
        });

    } catch (error) {
        console.error("Status Update Error:", error);
        return NextResponse.json({ error: "Failed to update status" }, { status: 500 });
    }
}