import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/shared/lib/auth";
import connectDB from "@/shared/lib/db/mongodb";
import Customer from "@/shared/models/Customer";
import Lead from "@/shared/models/Lead";
import User from "@/shared/models/User";
import redis from "@/shared/lib/db/redis";
import { getUserNameById } from "@/shared/utils/userUtils";
import { sanitizeCustomerOrLeadData } from "@/shared/utils/privacy";

export const dynamic = "force-dynamic";

function normalisePhone(raw = "") {
  let p = raw.toString().trim();
  if (!p.startsWith("whatsapp:")) p = `whatsapp:${p}`;
  return p;
}

function rootLeadFields(body, resolvedName, resolvedCity, resolvedAddress, currentUser, associateId) {
  const isClosed = body.status === "Closed" || body.status === "Not Interested";
  
  const fields = {
    name: resolvedName,
    city: resolvedCity,
    address: resolvedAddress,
    source: body.source || "Whatsapp",
    assignedTo: currentUser,
    associateId,
    isClosed
  };

  if (isClosed) {
    fields.closedBy = currentUser;
    fields.closedById = associateId;
    fields.closedAt = new Date();
  } else {
    fields.closedBy = null;
    fields.closedById = null;
    fields.closedAt = null;
  }

  return fields;
}

const buildFollowUp = async (body, session) => {
    const associateId = body.associateId || session.user.id;
    const resolvedAssociateName = await getUserNameById(associateId, session.user.name);

    return {
        date: body.date ? new Date(body.date) : new Date(),
        leadType: body.leadType || "Direct Lead",
        status: body.status || "New",
        priority: body.priority || "Medium",
        source: body.source || "Manual Entry",
        enquiredFor: body.enquiredFor || "",
        overAllRemarks: body.overAllRemarks || "",
        saleAmount: body.saleAmount || 0,
        associateId: associateId,
        associateName: resolvedAssociateName, 
    };
};

function mergeFollowUp(existing, body) {
  if (body.enquiredFor !== undefined) existing.enquiredFor = body.enquiredFor;
  if (body.priority !== undefined) existing.priority = body.priority;
  if (body.status !== undefined) existing.status = body.status;
  if (body.overAllRemarks !== undefined) existing.overAllRemarks = body.overAllRemarks;
  if (body.day1Remarks !== undefined) existing.day1Remarks = body.day1Remarks;
  if (body.day2Remarks !== undefined) existing.day2Remarks = body.day2Remarks;
  if (body.day3Remarks !== undefined) existing.day3Remarks = body.day3Remarks;
  if (body.saleAmount !== undefined) existing.saleAmount = body.saleAmount;
  if (body.leadType !== undefined) existing.leadType = body.leadType;
  if (body.note !== undefined) existing.note = body.note;
  if (body.nextFollowUp !== undefined) existing.nextFollowUp = new Date(body.nextFollowUp);
}

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

import { serverLeadService } from "@/server/services/serverLeadService";

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized: Missing session" }, { status: 401 });
    }

    await connectDB();
    const body = await req.json();

    const { customer, lead, action } = await serverLeadService.createOrUpdateLead(body, session);
    await invalidateCache();

    const sanitizedLead = sanitizeCustomerOrLeadData(lead.toObject ? lead.toObject() : lead, session.user);
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