import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import Customer from "@/models/Customer";
import Lead from "@/models/Lead"; 
import User from "@/models/User";
import redis from "@/lib/redis";

<<<<<<< HEAD
export async function GET(req) {
  try {
    await connectDB();
    const leads = await Lead.find({}).sort({ createdAt: -1 }).lean();
    const customers = await Customer.find({}).lean();

    // Mapping customers to merge data perfectly
=======
export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    await connectDB();
    
    const leads = await Lead.find({}).sort({ createdAt: -1 }).lean();
    const leadPhones = leads.map(l => l.phone || l.customerPhone).filter(Boolean);
    const customers = await Customer.find({ phone: { $in: leadPhones } }).lean();

>>>>>>> c1be5bc (Initial commit from new system)
    const customerMap = {};
    customers.forEach(c => { customerMap[c.phone] = c; });

    const formattedData = leads.map(lead => {
        const c = customerMap[lead.phone || lead.customerPhone] || {};
        return {
            phone: lead.phone || lead.customerPhone,
<<<<<<< HEAD
            name: lead.name || c.name || "Unknown",
            city: lead.city || c.city || "",
            address: lead.address || c.address || "",
            source: lead.source || c.source || "Manual Entry",
            enquiredFor: lead.enquiredFor || c.enquiredFor || "",
            status: lead.status || c.status || "New",
            priority: lead.priority || c.priority || "Medium", 
            remarks: lead.remarks || lead.day1Remarks || c.remarks || "",
            saleAmount: lead.saleAmount || "0",
            associate: lead.assignedTo || c.assignedTo || "Unassigned",
            visitCount: c.visitCount || 1,
            date: lead.createdAt ? new Date(lead.createdAt).toISOString() : new Date().toISOString(),
            followUpStart: lead.followUpStart ? new Date(lead.followUpStart).toISOString() : null,
            isClosed: lead.isClosed || c.isClosed || false
        };
    });

    // Add legacy customers who have no lead entries
    const leadsPhones = new Set(leads.map(l => l.phone || l.customerPhone));
    customers.forEach(c => {
        if (!leadsPhones.has(c.phone)) {
            formattedData.push({
                phone: c.phone, name: c.name || "Unknown", city: c.city || "", address: c.address || "",
                source: c.source || "Imported", enquiredFor: c.enquiredFor || "", status: c.status || "New",
                priority: c.priority || "Medium", remarks: c.remarks || "", saleAmount: "0",
                associate: c.assignedTo || "Unassigned", visitCount: c.visitCount || 1,
                date: c.createdAt ? new Date(c.createdAt).toISOString() : new Date().toISOString(),
                followUpStart: null,
                isClosed: c.isClosed || false
            });
        }
    });

=======
            name: (c.name && c.name !== "Unknown") ? c.name : (lead.name || "Unknown"),
            city: c.city || lead.city || "",
            address: c.address || lead.address || "",
            source: c.source || lead.source || "Manual Entry",
            enquiredFor: lead.enquiredFor || c.enquiredFor || "",
            status: lead.status || "New", 
            priority: lead.priority || c.priority || "Medium", 
            remarks: lead.remarks || "", 
            day1Remarks: lead.day1Remarks || "",
            day2Remarks: lead.day2Remarks || "",
            day3Remarks: lead.day3Remarks || "",
            saleAmount: lead.saleAmount || "0",
            associate: lead.assignedTo || "Unassigned", 
            visitCount: c.visitCount || 1, 
            date: lead.createdAt ? new Date(lead.createdAt).toISOString() : new Date().toISOString(),
            followUpStart: lead.followUpStart ? new Date(lead.followUpStart).toISOString() : null,
            isClosed: lead.isClosed || false 
        };
    });

>>>>>>> c1be5bc (Initial commit from new system)
    return NextResponse.json(formattedData);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch contacts" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await connectDB();
    const body = await req.json();
    
    const mobile = body.phone || body.mobile;
    if (!mobile) return NextResponse.json({ error: "Mobile number is required" }, { status: 400 });

    let cleanPhone = mobile.toString().trim();
    if (!cleanPhone.startsWith("whatsapp:")) cleanPhone = `whatsapp:${cleanPhone}`;

    const currentUser = body.associate || session.user.name;
    
    const userDoc = await User.findOne({ name: currentUser });
    const associateId = userDoc ? userDoc._id.toString() : "";

<<<<<<< HEAD
    const payload = {
        name: body.name || "Unknown",
        city: body.city || "",
        address: body.address || "",
        source: body.source || "Whatsapp",
=======
    let customer = await Customer.findOne({ phone: cleanPhone });
    let latestLead = await Lead.findOne({ phone: cleanPhone }).sort({ createdAt: -1 });

    let resolvedName = "Unknown";
    if (body.name && body.name.trim() !== "") {
        resolvedName = body.name.trim(); 
    } else if (customer && customer.name && customer.name !== "Unknown") {
        resolvedName = customer.name; 
    }

    let resolvedCity = "";
    if (body.city && body.city.trim() !== "") {
        resolvedCity = body.city.trim(); 
    } else if (customer && customer.city) {
        resolvedCity = customer.city; 
    }

    let resolvedAddress = "";
    if (body.address && body.address.trim() !== "") {
        resolvedAddress = body.address.trim(); 
    } else if (customer && customer.address) {
        resolvedAddress = customer.address; 
    }

    const customerData = {
        name: resolvedName,
        city: resolvedCity,
        address: resolvedAddress,
        source: body.source || (customer ? customer.source : "Whatsapp"),
        status: body.status || (customer ? customer.status : "New")
    };

    const leadData = {
        name: resolvedName,
        city: resolvedCity,
        address: resolvedAddress,
>>>>>>> c1be5bc (Initial commit from new system)
        enquiredFor: body.enquiredFor || "",
        priority: body.priority || "Medium",
        remarks: body.remarks || "",
        status: body.status || "New",
        saleAmount: body.saleAmount || "0",
        assignedTo: currentUser,
        associateId: associateId,
<<<<<<< HEAD
        isClosed: body.status === "Closed"
    };

    let customer = await Customer.findOne({ phone: cleanPhone });
    let latestLead = await Lead.findOne({ $or: [{ phone: cleanPhone }] }).sort({ createdAt: -1 });

    let currentVisitCount = customer ? (customer.visitCount || 1) : 1;

    if (!customer) {
        customer = await Customer.create({ phone: cleanPhone, ...payload, visitCount: 1 });
    } else {
        Object.assign(customer, payload);
        if (latestLead && latestLead.isClosed) {
            customer.visitCount += 1;
=======
        isClosed: body.status === "Closed",
        leadType: latestLead?.leadType || "Direct Lead"
    };

    let currentVisitCount = customer ? (customer.visitCount || 1) : 1;

    // Customer DB Update / Create
    if (!customer) {
        customer = await Customer.create({ 
            phone: cleanPhone, 
            ...customerData, 
            visitCount: 1 
        });
    } else {
        Object.assign(customer, customerData);
        if (latestLead && !latestLead.isClosed && body.status === "Closed") {
            customer.visitCount = (customer.visitCount || 1) + 1;
>>>>>>> c1be5bc (Initial commit from new system)
            currentVisitCount = customer.visitCount;
        }
        await customer.save();
    }

<<<<<<< HEAD
    if (!latestLead || latestLead.isClosed) {
        await Lead.create({
            phone: cleanPhone,
            ...payload,
            day1Remarks: body.day1Remarks || "", day2Remarks: body.day2Remarks || "", day3Remarks: body.day3Remarks || ""
        });
    } else {
        Object.assign(latestLead, payload);
        if (body.day1Remarks) latestLead.day1Remarks = body.day1Remarks;
        if (body.day2Remarks) latestLead.day2Remarks = body.day2Remarks;
        if (body.day3Remarks) latestLead.day3Remarks = body.day3Remarks;
        await latestLead.save();
    }

    if (redis && redis.status === 'ready') await redis.del("chats:all_data");

    return NextResponse.json({ success: true, visitCount: currentVisitCount });
  } catch (error) {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
=======
    // 👇 FIX: Follow Up Registration & Edit Logic
    let createNewLead = false;

    // Condition 1: No previous lead exists
    if (!latestLead) {
        createNewLead = true;
    } 
    // Condition 2: Previous lead was already closed
    else if (latestLead.isClosed && body.status !== "Closed") {
        createNewLead = true;
    }
    // Condition 3: Customer is being put into "Follow Up" AGAIN
    else if (body.status === "Follow Up") {
        // If they click follow up, we force close the old one to create a fresh tracking entry
        createNewLead = true;
        
        if (!latestLead.isClosed) {
            latestLead.isClosed = true;
            await latestLead.save();
        }
    }

    if (createNewLead) {
        // Creates a brand new record in Leads Collection
        await Lead.create({
            phone: cleanPhone,
            ...leadData,
            day1Remarks: body.day1Remarks || "", 
            day2Remarks: body.day2Remarks || "", 
            day3Remarks: body.day3Remarks || "",
            followUpStart: body.status === "Follow Up" ? new Date() : null
        });
    } else if (latestLead && !latestLead.isClosed) {
        // Edits the currently active lead if status is NOT "Follow Up" 
        // (e.g., just changing name, city, remarks, enquiredFor, etc.)
        Object.assign(latestLead, leadData);
        if (body.day1Remarks !== undefined) latestLead.day1Remarks = body.day1Remarks;
        if (body.day2Remarks !== undefined) latestLead.day2Remarks = body.day2Remarks;
        if (body.day3Remarks !== undefined) latestLead.day3Remarks = body.day3Remarks;
        await latestLead.save();
    }

    if (redis && redis.status === 'ready') {
        try { 
            await redis.del("chats:all_data"); 
            await redis.del("chats:main_inbox_data"); 
        } catch (e) { }
    }

    return NextResponse.json({ success: true, visitCount: currentVisitCount });
  } catch (error) {
    console.error("Save Contact Error:", error);
    return NextResponse.json({ error: "Failed to save data" }, { status: 500 });
>>>>>>> c1be5bc (Initial commit from new system)
  }
}