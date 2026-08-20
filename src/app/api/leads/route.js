import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/shared/lib/auth";
import connectDB from "@/shared/lib/db/mongodb";
import redis from "@/shared/lib/db/redis";
import { sanitizeCustomerOrLeadData } from "@/shared/utils/privacy";
import { serverLeadService } from "@/server/services/serverLeadService";

export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/leads
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const params = Object.fromEntries(new URL(req.url).searchParams);
    
    // Lazy load the service to prevent import cycles if any
    const { leadQueryService } = await import("@/features/leads/services/leadQueryService");
    const result = await leadQueryService.getLeads(params, session);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error("[GET /api/leads]", error);
    return NextResponse.json({ error: "Failed to fetch leads" }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/leads  
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized: Missing session" }, { status: 401 });
    }

    await connectDB();
    const body = await req.json();

    const { lead, action } = await serverLeadService.createOrUpdateLead(body, session);
    await invalidateCache();

    const sanitizedLead = sanitizeCustomerOrLeadData(lead?.toObject ? lead.toObject() : lead, session.user);
    return NextResponse.json({ success: true, lead: sanitizedLead, action });

  } catch (error) {
    console.error("[POST /api/leads] Internal Error:", error);
    return NextResponse.json({ error: error.message || "Failed to save lead" }, { status: 500 });
  }
}

async function invalidateCache() {
  if (redis && redis.status === "ready") {
    try {
      await redis.del("chats:all_data");
    } catch (e) {
      console.error("[Redis invalidation error]", e);
    }
  }
}