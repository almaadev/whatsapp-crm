import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Customer from "@/models/Customer";
import Lead from "@/models/Lead";
import User from "@/models/User"; // <--- Added User model
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

    let customer = await Customer.findOne({ phone: cleanPhone });
    if (customer) {
        customer.status = status;
        customer.assignedTo = associateName;
        customer.isClosed = isClosed;
        if (priority) customer.priority = priority;
        if (notes) customer.remarks = notes;
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
            name: customer?.name || "Unknown",
            city: customer?.city || "",
            address: customer?.address || "",
            source: customer?.source || "Whatsapp",
            enquiredFor: customer?.enquiredFor || "",
            priority: priority || customer?.priority || "Medium",
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
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}