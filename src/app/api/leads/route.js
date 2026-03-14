import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import Customer from "@/models/Customer";
import Lead from "@/models/Lead"; 
import User from "@/models/User";
import redis from "@/lib/redis";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    await connectDB();
    
    const leads = await Lead.find({}).sort({ createdAt: -1 }).lean();
    const leadPhones = leads.map(l => l.phone || l.customerPhone).filter(Boolean);
    const customers = await Customer.find({ phone: { $in: leadPhones } }).lean();

    const customerMap = {};
    customers.forEach(c => { customerMap[c.phone] = c; });

    const formattedData = leads.map(lead => {
        const c = customerMap[lead.phone || lead.customerPhone] || {};
        return {
            phone: lead.phone || lead.customerPhone,
            // FIX 1: Customer DB-la irukka peruku 1st Priority
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

    let customer = await Customer.findOne({ phone: cleanPhone });
    let latestLead = await Lead.findOne({ phone: cleanPhone }).sort({ createdAt: -1 });

    // NAME RESOLUTION
    let resolvedName = "Unknown";
    if (body.name && body.name.trim() !== "") {
        resolvedName = body.name.trim(); 
    } else if (customer && customer.name && customer.name !== "Unknown") {
        resolvedName = customer.name; 
    }

    // CITY RESOLUTION
    let resolvedCity = "";
    if (body.city && body.city.trim() !== "") {
        resolvedCity = body.city.trim(); 
    } else if (customer && customer.city) {
        resolvedCity = customer.city; 
    }

    // ADDRESS RESOLUTION
    let resolvedAddress = "";
    if (body.address && body.address.trim() !== "") {
        resolvedAddress = body.address.trim(); 
    } else if (customer && customer.address) {
        resolvedAddress = customer.address; 
    }

    // CUSTOMER DATA
    const customerData = {
        name: resolvedName,
        city: resolvedCity,
        address: resolvedAddress,
        source: body.source || (customer ? customer.source : "Whatsapp"),
    };

    // FIX 2: LEAD DATA-laiyum Name, City, Address add panniyachu!
    const leadData = {
        name: resolvedName,
        city: resolvedCity,
        address: resolvedAddress,
        enquiredFor: body.enquiredFor || "",
        priority: body.priority || "Medium",
        remarks: body.remarks || "",
        status: body.status || "New",
        saleAmount: body.saleAmount || "0",
        assignedTo: currentUser,
        associateId: associateId,
        isClosed: body.status === "Closed"
    };

    // CUSTOMER LOGIC
    let currentVisitCount = customer ? (customer.visitCount || 1) : 1;

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
            currentVisitCount = customer.visitCount;
        }
        await customer.save();
    }

    // LEADS LOGIC
    const isExistingActiveLead = latestLead && !latestLead.isClosed;

    if (body.status !== "New" || isExistingActiveLead) {
        if (!latestLead || latestLead.isClosed) {
            await Lead.create({
                phone: cleanPhone,
                ...leadData,
                day1Remarks: body.day1Remarks || "", 
                day2Remarks: body.day2Remarks || "", 
                day3Remarks: body.day3Remarks || ""
            });
        } else {
            Object.assign(latestLead, leadData);
            if (body.day1Remarks !== undefined) latestLead.day1Remarks = body.day1Remarks;
            if (body.day2Remarks !== undefined) latestLead.day2Remarks = body.day2Remarks;
            if (body.day3Remarks !== undefined) latestLead.day3Remarks = body.day3Remarks;
            await latestLead.save();
        }
    }

    if (redis && redis.status === 'ready') {
        try { await redis.del("chats:all_data"); } catch (e) { }
    }

    return NextResponse.json({ success: true, visitCount: currentVisitCount });
  } catch (error) {
    console.error("Save Contact Error:", error);
    return NextResponse.json({ error: "Failed to save data" }, { status: 500 });
  }
}