import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import Customer from "@/models/Customer";
import Lead from "@/models/Lead";
import User from "@/models/User";
import redis from "@/lib/redis";
import { getUserNameById } from "@/utils/userUtils";

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
    await connectDB();

    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const month = searchParams.get("month");
    const year = searchParams.get("year");
    const today = searchParams.get("today");
    const associate = searchParams.get("associate");
    const isClosed = searchParams.get("isClosed");
    const view = searchParams.get("view"); 

    const match = {};

    let startDate, endDate;
    if (today === "true") {
      startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date();
      endDate.setHours(23, 59, 59, 999);
    } else if (month && year) {
      startDate = new Date(year, parseInt(month) - 1, 1);
      endDate = new Date(year, parseInt(month), 0, 23, 59, 59, 999);
    } else if (from || to) {
      if (from) startDate = new Date(from);
      if (to) {
        endDate = new Date(to);
        endDate.setHours(23, 59, 59, 999);
      }
    }

    if (startDate || endDate) {
      const dateMatch = {};
      if (startDate) dateMatch.$gte = startDate;
      if (endDate) dateMatch.$lte = endDate;

      if (view === "activities") {
        match["leads.date"] = dateMatch;
      } else {
        match.$or = [
          { createdAt: dateMatch },
          { "leads.date": dateMatch }
        ];
      }
    }

    if (associate) {
      if (isClosed === "true") {
        match.closedBy = associate;
      } else {
        match.$or = [
          { assignedTo: associate },
          { "handledByHistory.associateName": associate },
          { "leads.associateName": associate }
        ];
      }
    }

    if (isClosed === "true") match.isClosed = true;
    if (isClosed === "false") match.isClosed = false;

    let pipeline = [];

    if (view === "activities") {
      pipeline = [
        { $unwind: "$leads" },
        { $match: match },
        { $sort: { "leads.date": -1 } },
        {
          $project: {
            phone: 1,
            name: { $ifNull: ["$name", "Unknown"] },
            enquiredFor: { $ifNull: ["$leads.enquiredFor", ""] },
            status: { $ifNull: ["$leads.status", "New"] },
            priority: { $ifNull: ["$leads.priority", "Medium"] },
            remarks: { $ifNull: ["$leads.overAllRemarks", ""] },
            saleAmount: { $ifNull: ["$leads.saleAmount", "0"] },
            leadType: { $ifNull: ["$leads.leadType", "Direct Lead"] },
            associate: { $ifNull: ["$leads.associateName", "Unassigned"] },
            date: "$leads.date",
            isActivity: { $literal: true }
          }
        }
      ];
    } else {
      pipeline = [
        { $match: match },
        { $sort: { updatedAt: -1 } },
        {
          $addFields: {
            latest: { $arrayElemAt: ["$leads", -1] },
            followUpCount: { $size: { $ifNull: ["$leads", []] } }
          }
        },
        {
          $project: {
            phone: 1,
            name: { $ifNull: ["$name", "Unknown"] },
            city: { $ifNull: ["$city", ""] },
            address: { $ifNull: ["$address", ""] },
            source: { $ifNull: ["$source", "Whatsapp"] },
            enquiredFor: { $ifNull: ["$latest.enquiredFor", ""] },
            status: { $ifNull: ["$latest.status", "New"] },
            priority: { $ifNull: ["$latest.priority", "Medium"] },
            remarks: { $ifNull: ["$latest.overAllRemarks", ""] },
            day1Remarks: { $ifNull: ["$latest.day1Remarks", ""] },
            day2Remarks: { $ifNull: ["$latest.day2Remarks", ""] },
            day3Remarks: { $ifNull: ["$latest.day3Remarks", ""] },
            saleAmount: { $ifNull: ["$latest.saleAmount", "0"] },
            leadType: { $ifNull: ["$latest.leadType", "Direct Lead"] },
            associate: { $ifNull: ["$assignedTo", "Unassigned"] },
            isClosed: { $ifNull: ["$isClosed", false] },
            closedBy: 1,
            closedAt: 1,
            handledByHistory: 1,
            date: { $ifNull: ["$createdAt", new Date()] },
            followUpCount: 1,
            leads: 1
          }
        }
      ];
    }

    const formattedData = await Lead.aggregate(pipeline);
    return NextResponse.json(formattedData);
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

    const mobileRaw = body.phone || body.mobile;
    if (!mobileRaw) {
      return NextResponse.json({ error: "Validation Error: Mobile number is required" }, { status: 400 });
    }

    const validLeadTypes = ["Direct Lead", "MD Camp", "Product Lead", "Therapy"];
    if (body.leadType && !validLeadTypes.includes(body.leadType)) {
      return NextResponse.json({ 
        error: `Validation Error: Invalid leadType. Must be one of: ${validLeadTypes.join(", ")}` 
      }, { status: 400 });
    }

    const cleanPhone = normalisePhone(mobileRaw);
    const currentUser = session.user.id ? await getUserNameById(session.user.id, session.user.name) : "Unknown";
    const userDoc = await User.findOne({ name: currentUser }).lean();
    const associateId = userDoc ? userDoc._id.toString() : session.user.id;

    // Fetch existing customer to resolve missing fields
    const existingCustomer = await Customer.findOne({ phone: cleanPhone }).lean();
    
    const resolvedName = (body.name?.trim())
      || (existingCustomer?.name && existingCustomer.name !== "Unknown" ? existingCustomer.name : "")
      || "Unknown";
    const resolvedCity = body.city?.trim() || existingCustomer?.city || "";
    const resolvedAddress = body.address?.trim() || existingCustomer?.address || "";
    const resolvedStatus = body.status || "New";
    const resolvedPriority = body.priority || "Medium";
    
    // 1. Get or Create the Customer
    const updatedCustomer = await Customer.findOneAndUpdate(
      { phone: cleanPhone },
      { 
        $setOnInsert: { phone: cleanPhone }, 
        $set: { name: resolvedName, city: resolvedCity, address: resolvedAddress, status: resolvedStatus, priority: resolvedPriority } 
      },
      { upsert: true, new: true } 
    );

    const existingLead = await Lead.findOne({ phone: cleanPhone });
    const rootFields = rootLeadFields(body, resolvedName, resolvedCity, resolvedAddress, currentUser, associateId);

    const currentHandoff = {
      associateId: associateId || "system",
      associateName: currentUser,
      assignedAt: new Date()
    };

    // ─────────────────────────────────────────────────────────────────────────
    // IF LEAD DOES NOT EXIST - CREATE NEW
    // ─────────────────────────────────────────────────────────────────────────
    if (!existingLead) {
      const newFollowUp = await buildFollowUp(body, session);

      const newLead = await Lead.create({
        phone: cleanPhone,
        customerProfile: updatedCustomer._id,
        ...rootFields,
        handledByHistory: [currentHandoff],
        leads: [newFollowUp],
      });

      updatedCustomer.leadProfile = newLead._id;
      await updatedCustomer.save();

      await invalidateCache();
      return NextResponse.json({ success: true, lead: newLead, action: "created" });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // UPDATE HANDOFF HISTORY IF HANDLER CHANGED
    // ─────────────────────────────────────────────────────────────────────────
    if (!existingLead.handledByHistory) existingLead.handledByHistory = [];
    const lastHandler = existingLead.handledByHistory.length > 0 
        ? existingLead.handledByHistory[existingLead.handledByHistory.length - 1] 
        : null;
    
    if (!lastHandler || lastHandler.associateName !== currentUser) {
      existingLead.handledByHistory.push(currentHandoff);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 🚀 NEW TIMELINE LOGIC: "Should we Push or Merge?"
    // ─────────────────────────────────────────────────────────────────────────
    const latestIdx = existingLead.leads.length - 1;
    const latestStatus = existingLead.leads[latestIdx]?.status ?? "New";
    const incomingStatus = body.status ?? latestStatus;

    let shouldCreateNewEntry = false;

    // Rule 1: If it's already Closed/Not Interested, only create new if transitioning back to Follow Up.
    if (latestStatus === "Closed" || latestStatus === "Not Interested") {
        if (incomingStatus === "Follow Up") {
            shouldCreateNewEntry = true;
        } else {
            shouldCreateNewEntry = false; // Just update the closed note
        }
    } 
    // Rule 2: If it's in Follow Up, only create new if transitioning to Closed/Not Interested.
    else if (latestStatus === "Follow Up") {
        if (incomingStatus === "Closed" || incomingStatus === "Not Interested") {
            shouldCreateNewEntry = true;
        } else {
            shouldCreateNewEntry = false; // Just update priority or remarks
        }
    } 
    // Rule 3: For 'New', just update the initial entry as they start working on it.
    else {
        shouldCreateNewEntry = false;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // APPLY THE DECISION
    // ─────────────────────────────────────────────────────────────────────────
    if (!shouldCreateNewEntry) {
      // 👉 UPDATE EXISTING (MERGE)
      Object.assign(existingLead, rootFields);
      if (latestIdx >= 0) mergeFollowUp(existingLead.leads[latestIdx], body);

      await existingLead.save();
      await invalidateCache();
      return NextResponse.json({ success: true, lead: existingLead, action: "updated_existing_entry" });
    } else {
      // 👉 CREATE NEW (PUSH)
      Object.assign(existingLead, rootFields);

      const newFollowUp = await buildFollowUp(body, session);
      existingLead.leads.push(newFollowUp);

      await existingLead.save();
      await invalidateCache();
      return NextResponse.json({ success: true, lead: existingLead, action: "pushed_new_entry" });
    }

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