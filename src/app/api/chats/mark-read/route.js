import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Customer from "@/models/Customer";
import redis from "@/lib/redis";
import { requireSession } from "@/lib/session";

const CHAT_CACHE_KEY = "chats:all_data";

export async function POST(req) {
  try {
    const { error } = await requireSession();
    if (error) return error;

    const { phone } = await req.json();
    if (!phone) return NextResponse.json({ error: "Phone required" }, { status: 400 });

    await connectDB();

    // Reset Unread Count in MongoDB (Super Fast)
    await Customer.findOneAndUpdate({ phone }, { unreadCount: 0 });

    // Update Redis Cache
    if (redis && redis.status === 'ready') {
        try {
            const cachedData = await redis.get(CHAT_CACHE_KEY);
            if (cachedData) {
                let chats = JSON.parse(cachedData);
                chats = chats.map(c => c.phone === phone ? { ...c, read: "TRUE", unreadCount: 0 } : c);
                await redis.set(CHAT_CACHE_KEY, JSON.stringify(chats), "EX", 600);
            }
        } catch (e) { console.error("Redis Mark-Read Error", e); }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Mark Read Error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}