// src/app/api/customers/route.js
import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Customer from "@/models/Customer";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    await connectDB();
    
    // Customer collection-la irunthu mattum fetch pandrom
    const customers = await Customer.find({}).sort({ updatedAt: -1 }).lean();

    const formattedData = customers.map(c => ({
        phone: c.phone,
        name: c.name || "Unknown",
        city: c.city || "",
        address: c.address || "",
        source: c.source || "Manual Entry",
        enquiredFor: c.enquiredFor || "",
        status: c.status || "New",
        priority: c.priority || "Medium", 
        remarks: c.remarks || "",
        saleAmount: c.saleAmount || "0",
        associate: c.assignedTo || "Unassigned",
        visitCount: c.visitCount || 1,
        date: c.updatedAt ? new Date(c.updatedAt).toISOString() : new Date().toISOString(),
        isClosed: c.isClosed || false
    }));

    return NextResponse.json(formattedData);
  } catch (error) {
    console.error("Customers fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch customers" }, { status: 500 });
  }
}