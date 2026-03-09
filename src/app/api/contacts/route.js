import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import Customer from "@/models/Customer";
import Lead from "@/models/Lead"; 
import redis from "@/lib/redis";

export async function GET(req) {
  try {
    await connectDB();
    
    const leads = await Lead.find({}).sort({ createdAt: -1 }).lean();
    const customers = await Customer.find({}).lean();

    const formattedData = leads.map(lead => {
        return {
            phone: lead.phone || lead.customerPhone,
            name: lead.name || "Unknown",
            city: lead.city || "",
            address: lead.address || "",
            source: lead.source || "Manual Entry",
            enquiredFor: lead.enquiredFor || "",
            status: lead.status || "New",
            priority: lead.priority || "Medium", 
            remarks: lead.remarks || lead.day1Remarks || "",
            date: lead.createdAt ? new Date(lead.createdAt).toISOString() : new Date().toISOString()
        };
    });

    const leadsPhones = new Set(leads.map(l => l.phone || l.customerPhone));
    customers.forEach(c => {
        if (!leadsPhones.has(c.phone)) {
            formattedData.push({
                phone: c.phone,
                name: c.name || "Unknown",
                city: c.city || "",
                address: c.address || "",
                source: c.source || "Imported",
                enquiredFor: c.enquiredFor || "",
                status: c.status || "New",
                priority: c.priority || "Medium",
                remarks: c.remarks || "",
                date: c.createdAt ? new Date(c.createdAt).toISOString() : new Date().toISOString()
            });
        }
    });

    return NextResponse.json(formattedData);
  } catch (error) {
    console.error("Fetch Contacts Error:", error);
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

    const payload = {
        name: body.name || cleanPhone,
        city: body.city || "",
        address: body.address || "",
        source: body.source || "Whatsapp",
        enquiredFor: body.enquiredFor || "",
        priority: body.priority || "Medium",
        remarks: body.remarks || "",
        status: body.status || "New",
        saleAmount: body.saleAmount || "0",
        assignedTo: currentUser,
        isClosed: body.status === "Closed"
    };

    let customer = await Customer.findOne({ phone: cleanPhone });
    let latestLead = await Lead.findOne({ $or: [{ phone: cleanPhone }, { customerPhone: cleanPhone }] }).sort({ createdAt: -1 });

    let currentVisitCount = customer ? (customer.visitCount || 1) : 1;

    if (!customer) {
        customer = await Customer.create({
            phone: cleanPhone,
            ...payload,
            visitCount: 1
        });
    } else {
        Object.assign(customer, payload);
        if (latestLead && latestLead.isClosed) {
            customer.visitCount += 1;
            currentVisitCount = customer.visitCount;
        }
        await customer.save();
    }

    if (!latestLead || latestLead.isClosed) {
        await Lead.create({
            phone: cleanPhone,
            customerPhone: cleanPhone, // <--- Safety fix
            ...payload,
            day1Remarks: body.day1Remarks || "",
            day2Remarks: body.day2Remarks || "",
            day3Remarks: body.day3Remarks || ""
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
    console.error("Contacts DB Error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}