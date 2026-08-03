import { NextResponse } from "next/server";
import connectDB from "@/shared/lib/db/mongodb";
import { getServerSession } from "next-auth";
import { authOptions } from "@/shared/lib/auth";
import { serverChatService } from "@/server/services/serverChatService";

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

        const result = await serverChatService.updateChatControlStatus(phone, isChatClosed, chatType, session);

        return NextResponse.json({
            success: true,
            modifiedCount: result.modifiedCount,
            message: isChatClosed ? "Chat marked as closed and routing reset." : "Chat reopened."
        });

    } catch (error) {
        console.error("Status Update Error:", error);
        return NextResponse.json({ error: error.message || "Failed to update status" }, { status: 500 });
    }
}