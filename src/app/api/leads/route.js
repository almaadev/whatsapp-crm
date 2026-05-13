import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import Customer from "@/models/Customer";
import Lead from "@/models/Lead";
import User from "@/models/User";
import redis from "@/lib/redis";

export const dynamic = "force-dynamic";


function normalisePhone(raw = "") {
  let p = raw.toString().trim();
  if (!p.startsWith("whatsapp:")) p = `whatsapp:${p}`;
  return p;
}

function rootLeadFields(body, resolvedName, resolvedCity, resolvedAddress, currentUser, associateId) {
  const isClosed = body.status === "Closed";
  
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

function buildFollowUp(body, session) {
  // Explicitly calculate dates here instead of Mongoose middleware to avoid "next is not a function" crashes
  const d = body.date ? new Date(body.date) : new Date();
  
  return {
    date: d,
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    day: d.getDate(),
    enquiredFor: body.enquiredFor || "",
    associateId: session.user.id || "",
    associateName: session.user.name || "", 
    priority: body.priority || "Medium",
    status: body.status || "New",
    overAllRemarks: body.overAllRemarks || "", // Mapped correctly
    day1Remarks: body.day1Remarks || "",
    day2Remarks: body.day2Remarks || "",
    day3Remarks: body.day3Remarks || "",
    saleAmount: body.saleAmount || "0",
    leadType: body.leadType || "Direct Lead",
    note: body.note || "",
    nextFollowUp: body.nextFollowUp ? new Date(body.nextFollowUp) : undefined,
  };
}

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
    const currentUser = session.user.name;
    const userDoc = await User.findOne({ name: currentUser }).lean();
    const associateId = userDoc ? userDoc._id.toString() : session.user.id;

    const customer = await Customer.findOne({ phone: cleanPhone }).lean();
    const resolvedName = (body.name?.trim())
      || (customer?.name && customer.name !== "Unknown" ? customer.name : "")
      || "Unknown";
    const resolvedCity = body.city?.trim() || customer?.city || "";
    const resolvedAddress = body.address?.trim() || customer?.address || "";
    const resolvedStatus = body.status || "New";
    
    Customer.findOneAndUpdate(
      { phone: cleanPhone },
      { $setOnInsert: { phone: cleanPhone }, $set: { name: resolvedName, city: resolvedCity, address: resolvedAddress, status: resolvedStatus } },
      { upsert: true }
    ).catch((e) => console.error("[Customer sync error]", e));

    const existingLead = await Lead.findOne({ phone: cleanPhone });
    const rootFields = rootLeadFields(
      body, resolvedName, resolvedCity, resolvedAddress, currentUser, associateId
    );

    const currentHandoff = {
      associateId: associateId || "system",
      associateName: currentUser,
      assignedAt: new Date()
    };

    if (!existingLead) {
      const newLead = await Lead.create({
        phone: cleanPhone,
        ...rootFields,
        handledByHistory: [currentHandoff],
        leads: [buildFollowUp(body, session)],
      });

      await invalidateCache();
      return NextResponse.json({ success: true, lead: newLead, action: "created" });
    }

    if (!existingLead.handledByHistory) existingLead.handledByHistory = [];
    const lastHandler = existingLead.handledByHistory.length > 0 
        ? existingLead.handledByHistory[existingLead.handledByHistory.length - 1] 
        : null;
    
    if (!lastHandler || lastHandler.associateName !== currentUser) {
      existingLead.handledByHistory.push(currentHandoff);
    }

    const latestIdx = existingLead.leads.length - 1;
    const latestStatus = existingLead.leads[latestIdx]?.status ?? "New";
    const incomingStatus = body.status ?? latestStatus;

    if (latestStatus === "Follow Up") {
      Object.assign(existingLead, rootFields);
      mergeFollowUp(existingLead.leads[latestIdx], body);
      await customer && Customer.findOneAndUpdate({ phone: cleanPhone }, { name: resolvedName, city: resolvedCity, address: resolvedAddress, status: resolvedStatus });
      await existingLead.save();
      await invalidateCache();
      return NextResponse.json({ success: true, lead: existingLead, action: "updated_followup" });
    }

    const isMetadataOnlyChange = incomingStatus === latestStatus && ["Closed", "Not Interested", "New"].includes(latestStatus);

    if (isMetadataOnlyChange) {
      Object.assign(existingLead, rootFields);
      if (latestIdx >= 0) mergeFollowUp(existingLead.leads[latestIdx], body);

      await existingLead.save();
      await invalidateCache();
      return NextResponse.json({ success: true, lead: existingLead, action: "updated_metadata" });
    } else {
      Object.assign(existingLead, rootFields);
      existingLead.leads.push(buildFollowUp(body, session));

      await existingLead.save();
      await invalidateCache();
      return NextResponse.json({ success: true, lead: existingLead, action: "new_cycle" });
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