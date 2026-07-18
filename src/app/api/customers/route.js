import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/shared/lib/auth";
import connectDB from "@/shared/lib/db/mongodb";
import Customer from "@/shared/models/Customer";
import Branch from "@/shared/models/Branch";
import User from "@/shared/models/User";

export const dynamic = "force-dynamic";

// --- Formatter Helper to maintain UI consistency ---
const formatCustomerForUI = (c, branchMap = {}) => ({
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
    date: c.updatedAt ? new Date(c.updatedAt).toISOString() : new Date().toISOString(),
    isClosed: c.isClosed || false,
    creatorInfo: c.createdBy ? {
        name: c.createdBy.name || "Unknown",
        role: c.createdBy.role || "",
        department: c.createdBy.department || "",
        branchName: branchMap[c.createdBy.branch?.toString()] || c.createdBy.branch || ""
    } : null
});

export async function GET(req) {
    try {
        await connectDB();
        
        const branches = await Branch.find().lean();
        const branchMap = {};
        branches.forEach(b => {
          branchMap[b._id.toString()] = b.name;
        });

        // Fetch lean records sorted by latest updates
        const customers = await Customer.find({}).sort({ updatedAt: -1 })
            .populate({
                path: 'createdBy',
                select: 'name role department branch'
            })
            .lean();
        
        const formattedData = customers.map(c => formatCustomerForUI(c, branchMap));

        return NextResponse.json(formattedData);
    } catch (error) {
        console.error("Customers fetch error:", error);
        return NextResponse.json({ error: "Failed to fetch customers" }, { status: 500 });
    }
}

export async function POST(req) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        await connectDB();
        
        const body = await req.json();
        const { phone, name, city, address, source } = body;

        if (!phone || phone.trim() === "") {
            return NextResponse.json({ error: "Phone number is required." }, { status: 400 });
        }

        // Standardize Phone Formatting
        let cleanPhone = phone.replace(/\D/g, '');
        if (cleanPhone.length === 10) cleanPhone = `91${cleanPhone}`;
        const finalPhone = `whatsapp:${cleanPhone}`;

        // Upsert Customer logic to prevent duplicates
        const updatedCustomer = await Customer.findOneAndUpdate(
            { phone: finalPhone },
            {
                $set: {
                    name: name?.trim() || "Unknown",
                    city: city?.trim() || "",
                    address: address?.trim() || "",
                    source: source?.trim() || "Manual Entry",
                    status: "New" // Default state for manually added customers
                },
                $setOnInsert: {
                    createdBy: session.user.id
                }
            },
            { new: true, upsert: true }
        ).populate({
            path: 'createdBy',
            select: 'name role department branch'
        });

        const branches = await Branch.find().lean();
        const branchMap = {};
        branches.forEach(b => {
          branchMap[b._id.toString()] = b.name;
        });

        return NextResponse.json({ 
            success: true, 
            data: formatCustomerForUI(updatedCustomer, branchMap) 
        }, { status: 201 });

    } catch (error) {
        console.error("Customer POST error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}