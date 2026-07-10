import { NextResponse } from "next/server";
import connectDB from "@/shared/lib/db/mongodb";
import Customer from "@/shared/models/Customer";
import Lead from "@/shared/models/Lead";
import User from "@/shared/models/User";
import redis from "@/shared/lib/db/redis";
import { requireSession } from "@/shared/lib/session";

export async function POST(req) {
  try {
    const { session, error } = await requireSession();
    if (error) return error;

    await connectDB();
    const { phone, status, associateName, notes, priority } = await req.json();
    
    let cleanPhone = phone.toString().trim();
    if (!cleanPhone.startsWith("whatsapp:")) cleanPhone = `whatsapp:${cleanPhone}`;

    const isClosed = status === "Closed";
    
    // Get Associate ID
    const resolvedAssociateName = associateName || session.user.name;
    const userDoc = await User.findOne({ name: resolvedAssociateName });
    const associateId = userDoc ? userDoc._id.toString() : "";

    // 1. Update Customer Record (If exists)
    let customer = await Customer.findOne({ phone: cleanPhone });
    if (customer) {
        customer.status = status;
        customer.assignedTo = resolvedAssociateName;
        customer.isClosed = isClosed;
        if (priority) customer.priority = priority;
        if (notes) customer.remarks = notes;
        
        await customer.save();
    }

    // 2. Find the Lead document
    let lead = await Lead.findOne({ phone: cleanPhone });

    const now = new Date();
    const newFollowUpEntry = {
        date: now,
        year: now.getUTCFullYear(),
        month: now.getUTCMonth() + 1,
        day: now.getUTCDate(),
        enquiredFor: customer?.enquiredFor || "",
        associateId: associateId,
        associateName: resolvedAssociateName,
        priority: priority || "Medium",
        status: status,
        overAllRemarks: notes || "",
        leadType: "Direct Lead" // Default, will be overridden if lead exists
    };

    if (!lead) {
        // If the lead completely doesn't exist, create it with the first history entry
        lead = new Lead({
            phone: cleanPhone,
            name: customer?.name || "Unknown",
            city: customer?.city || "",
            address: customer?.address || "",
            source: customer?.source || "Whatsapp",
            assignedTo: resolvedAssociateName,
            associateId: associateId,
            isClosed: isClosed,
            leads: [newFollowUpEntry]
        });

        if (isClosed) {
            lead.closedBy = resolvedAssociateName;
            lead.closedById = associateId;
            lead.closedAt = now;
        }

        await lead.save();

    } else {
        // If lead exists, push the new status update into the leads array
        newFollowUpEntry.leadType = lead.leads && lead.leads.length > 0 
            ? lead.leads[lead.leads.length - 1].leadType 
            : "Direct Lead";

        lead.leads.push(newFollowUpEntry);

        // Update Top-Level Ownership & Closure tracking
        lead.assignedTo = resolvedAssociateName;
        lead.associateId = associateId;
        lead.isClosed = isClosed;

        if (isClosed) {
            // Only set closed data if it wasn't already closed, or update it to the current closer
            lead.closedBy = resolvedAssociateName;
            lead.closedById = associateId;
            lead.closedAt = now;
        } else {
            // If reopened (e.g. Follow Up on a closed lead)
            lead.closedBy = null;
            lead.closedById = null;
            lead.closedAt = null;
        }

        // Track ownership changes (Handoffs) if the assigned user changes
        const previousHandler = lead.assignedTo;
        if (previousHandler !== resolvedAssociateName) {
             lead.handledByHistory.push({
                 associateId: associateId,
                 associateName: resolvedAssociateName,
                 assignedAt: now
             });
        }

        await lead.save();
    }

    // Invalidate Redis cache
if (redis && redis.status === 'ready') {
        try { 
            await redis.del("chats:all_data"); 
            await redis.del("chats:main_inbox_data"); // <-- Add this line!
        } catch(e) {
            console.error("Redis Cache Clear Error:", e);
        }
    }
    
    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("Lead Status Update Error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}