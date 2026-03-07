import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import Customer from "@/models/Customer";
import redis from "@/lib/redis";

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

    if (body.checkDuplicates) {
      const exists = await Customer.findOne({ phone: cleanPhone }).lean();
      if (exists) return NextResponse.json({ error: "Lead already exists" }, { status: 409 });
    }

    const currentUser = body.associate || session.user.name;

    // PREPARE DATA TO UPSERT
    const updateData = {
      name: body.name || undefined,
      city: body.city || undefined,
      assignedTo: currentUser,
      source: body.source || "Whatsapp",
      enquiredFor: body.enquiredFor || undefined,
      status: body.status || "New",
      saleAmount: body.saleAmount || "0",
      remarks: body.remarks || undefined,
      priority: body.priority || "Low",
      day1Remarks: body.day1Remarks || undefined,
      day2Remarks: body.day2Remarks || undefined,
      day3Remarks: body.day3Remarks || undefined,
    };

    // Clean undefined values so it doesn't overwrite existing DB data with null
    Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

    await Customer.findOneAndUpdate(
      { phone: cleanPhone },
      { $set: updateData },
      { upsert: true, new: true }
    );

    if (redis && redis.status === 'ready') await redis.del("chats:all_data");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Contacts DB Error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await connectDB();
    
    // Fetch all customers, newest first
    const customers = await Customer.find({}).sort({ createdAt: -1 }).lean();

    // Map to Frontend format
    const leads = customers.map(c => ({
      date: new Date(c.createdAt).toLocaleDateString("en-IN"),
      name: c.name || "Unknown",
      phone: c.phone || "",
      city: c.city || "",
      handler: c.assignedTo || "",
      source: c.source || "",
      enquiredFor: c.enquiredFor || "",
      status: c.status || "New",
      saleAmount: c.saleAmount || "",
      remarks: c.remarks || "",
      day1Remarks: c.day1Remarks || "",
      day2Remarks: c.day2Remarks || "",
      day3Remarks: c.day3Remarks || "",
      priority: c.priority || "Medium",
      isClosed: c.isClosed ? "TRUE" : "FALSE"
    }));

    return NextResponse.json(leads);
  } catch (error) {
    console.error("Fetch Leads DB Error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}