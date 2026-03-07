import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Customer from "@/models/Customer";
import redis from "@/lib/redis";

export async function POST(req) {
  try {
    await connectDB();
    const { phone, status, associateName, notes, priority } = await req.json();
    
    let cleanPhone = phone.toString().trim();
    if (!cleanPhone.startsWith("whatsapp:")) cleanPhone = `whatsapp:${cleanPhone}`;

    const customer = await Customer.findOne({ phone: cleanPhone });
    if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

    let updates = {
      status: status,
      assignedTo: associateName,
      isClosed: status === "Closed"
    };

    if (priority) updates.priority = priority;

    // Follow Up Date Logic
    if (status === "Follow Up") {
       let startDate = customer.followUpStart;
       if (!startDate) {
           startDate = new Date();
           updates.followUpStart = startDate;
       }

       const now = new Date();
       const dayDiff = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));

       if (notes) {
           if (dayDiff <= 1) updates.day1Remarks = notes;
           else if (dayDiff === 2) updates.day2Remarks = notes;
           else updates.day3Remarks = notes;
       }
    } else {
       // Reset follow up data if status is changed to something else
       updates.day1Remarks = "";
       updates.day2Remarks = "";
       updates.day3Remarks = "";
       updates.followUpStart = null;
    }

    if (notes && status !== "Follow Up") {
       updates.remarks = notes;
    }

    if (status === "Closed") {
       updates.lastClosedBy = associateName;
    }

    await Customer.findOneAndUpdate({ phone: cleanPhone }, { $set: updates });

    if (redis && redis.status === 'ready') await redis.del("chats:all_data");
    
    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("Status Update DB Error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}