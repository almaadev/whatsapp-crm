import { NextResponse } from "next/server";
import connectDB from "@/shared/lib/db/mongodb";
import { requireSession } from "@/shared/lib/session";
import { serverLeadService } from "@/server/services/serverLeadService";
import redis from "@/shared/lib/db/redis";

export async function POST(req) {
  try {
    const { session, error } = await requireSession();
    if (error) return error;

    await connectDB();
    const body = await req.json();
    
    // Delegate entirely to serverLeadService
    const result = await serverLeadService.createOrUpdateLead({
      phone: body.phone,
      status: body.status,
      priority: body.priority,
      overAllRemarks: body.notes || body.remarks || "",
      associateId: body.associateId,
      name: body.name
    }, session);

    // Invalidate Redis cache
    if (redis && redis.status === 'ready') {
      try { 
        await redis.del("chats:all_data"); 
        await redis.del("chats:main_inbox_data");
      } catch(e) {
        console.error("Redis Cache Clear Error:", e);
      }
    }

    return NextResponse.json({ success: true, lead: result.lead });
  } catch (error) {
    console.error("Lead status update error:", error);
    return NextResponse.json({ error: error.message || "Failed to update lead status" }, { status: 400 });
  }
}