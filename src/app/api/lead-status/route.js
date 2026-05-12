import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Customer from "@/models/Customer";
import Lead from "@/models/Lead";
<<<<<<< HEAD
import User from "@/models/User"; // <--- Added User model
=======
import User from "@/models/User";
>>>>>>> c1be5bc (Initial commit from new system)
import redis from "@/lib/redis";

export async function POST(req) {
  try {
    await connectDB();
    const { phone, status, associateName, notes, priority } = await req.json();
    
    let cleanPhone = phone.toString().trim();
    if (!cleanPhone.startsWith("whatsapp:")) cleanPhone = `whatsapp:${cleanPhone}`;

    const isClosed = status === "Closed";
    
    // Get Associate ID
    const userDoc = await User.findOne({ name: associateName });
    const associateId = userDoc ? userDoc._id.toString() : "";

<<<<<<< HEAD
=======
    // 1. Update Customer Record (If exists)
>>>>>>> c1be5bc (Initial commit from new system)
    let customer = await Customer.findOne({ phone: cleanPhone });
    if (customer) {
        customer.status = status;
        customer.assignedTo = associateName;
        customer.isClosed = isClosed;
        if (priority) customer.priority = priority;
        if (notes) customer.remarks = notes;
<<<<<<< HEAD
        await customer.save();
    }

    let latestLead = await Lead.findOne({ $or: [{ phone: cleanPhone }, { customerPhone: cleanPhone }] }).sort({ createdAt: -1 });
    
    if (latestLead && !latestLead.isClosed) {
        latestLead.status = status;
        latestLead.assignedTo = associateName;
        latestLead.associateId = associateId; // <--- Update relation ID
        latestLead.isClosed = isClosed;
        if (priority) latestLead.priority = priority;

        if (status === "Follow Up") {
            let startDate = latestLead.followUpStart;
            if (!startDate) {
                startDate = new Date();
                latestLead.followUpStart = startDate;
            }
            const now = new Date();
            const dayDiff = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));
            if (notes) {
                if (dayDiff <= 1) latestLead.day1Remarks = notes;
                else if (dayDiff === 2) latestLead.day2Remarks = notes;
                else latestLead.day3Remarks = notes;
            }
        } 
        if (notes) latestLead.remarks = notes; 
        await latestLead.save();

    } else if (latestLead && latestLead.isClosed && status !== "Closed") {
        if (customer) {
            customer.visitCount += 1;
            await customer.save();
        }
        await Lead.create({
            phone: cleanPhone,
            customerPhone: cleanPhone,
=======
        
        // Only increment visit count if it's not a closed status update
        if (!isClosed) {
           customer.visitCount = (customer.visitCount || 0) + 1;
        }
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
        associateName: associateName,
        priority: priority || "Medium",
        status: status,
        overAllRemarks: notes || "",
        leadType: "Direct Lead" // Default, will be overridden if lead exists
    };

    if (!lead) {
        // If the lead completely doesn't exist, create it with the first history entry
        lead = new Lead({
            phone: cleanPhone,
>>>>>>> c1be5bc (Initial commit from new system)
            name: customer?.name || "Unknown",
            city: customer?.city || "",
            address: customer?.address || "",
            source: customer?.source || "Whatsapp",
<<<<<<< HEAD
            enquiredFor: customer?.enquiredFor || "",
            priority: customer?.isClosed !== false ? customer.priority : null,
            status: status,
            assignedTo: associateName,
            associateId: associateId, // <--- New lead relation ID
            remarks: notes || "",
            isClosed: false,
            followUpStart: status === "Follow Up" ? new Date() : null
        });
    }

    if (redis && redis.status === 'ready') await redis.del("chats:all_data");
    return NextResponse.json({ success: true });
  } catch (error) {
=======
            assignedTo: associateName,
            associateId: associateId,
            isClosed: isClosed,
            leads: [newFollowUpEntry]
        });

        if (isClosed) {
            lead.closedBy = associateName;
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
        lead.assignedTo = associateName;
        lead.associateId = associateId;
        lead.isClosed = isClosed;

        if (isClosed) {
            // Only set closed data if it wasn't already closed, or update it to the current closer
            lead.closedBy = associateName;
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
        if (previousHandler !== associateName) {
             lead.handledByHistory.push({
                 associateId: associateId,
                 associateName: associateName,
                 assignedAt: now
             });
        }

        await lead.save();
    }

    // Invalidate Redis cache
    if (redis && redis.status === 'ready') {
        try { await redis.del("chats:all_data"); } catch(e) {}
    }
    
    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("Lead Status Update Error:", error);
>>>>>>> c1be5bc (Initial commit from new system)
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}