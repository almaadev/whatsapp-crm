import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/shared/lib/auth";
import connectDB from "@/shared/lib/db/mongodb";
import { serverLeadService } from "@/server/services/serverLeadService";
import redis from "@/shared/lib/db/redis";
import { revalidatePath } from "next/cache";

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { mobile, currentState } = await req.json();
    if (!mobile)
      return NextResponse.json({ error: "Mobile required" }, { status: 400 });

    await connectDB();
    const newStateBoolean = currentState !== "TRUE"; // Toggle Action
    const targetStatus = newStateBoolean ? "Closed" : "Follow Up";

    const result = await serverLeadService.createOrUpdateLead({
      phone: mobile,
      status: targetStatus,
      overAllRemarks: newStateBoolean ? "Lead marked as closed" : "Lead reopened"
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

    revalidatePath("/crm/leads");
    revalidatePath("/crm/chat");
    revalidatePath(`/crm/leads/${encodeURIComponent(mobile)}`);

    return NextResponse.json({
      success: true,
      newState: newStateBoolean ? "TRUE" : "FALSE",
    });
  } catch (error) {
    console.error("Update Close Error:", error);
    return NextResponse.json({ error: error.message || "Failed to update close status" }, { status: 400 });
  }
}
