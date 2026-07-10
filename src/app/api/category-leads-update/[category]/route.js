import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/shared/lib/auth";
import connectDB from "@/shared/lib/db/mongodb";
import Lead from "@/shared/models/Lead"; // 👈 ONLY unified Lead Model
import User from "@/shared/models/User";
import Customer from "@/shared/models/Customer"; // Main Customer DB

// Match category from URL to the unified leadType
const getCategoryConfig = (category) => {
    if (category === "product") return "Product Lead";
    if (category === "mdcamp") return "MD Camp";
    if (category === "therapy") return "Therapy";
    return "Direct Lead";
};

export async function POST(req, { params }) {
    try {
        await connectDB();
        const session = await getServerSession(authOptions);
        const { category } = await params;
        
        const targetType = getCategoryConfig(category);
        const body = await req.json();
        const { mobile, ...updateData } = body;

        if (!mobile) return NextResponse.json({ error: "Mobile number is required" }, { status: 400 });

        // Update timestamps & boolean flags based on status
        if (updateData.status === "Follow Up" && !updateData.followUpStart) updateData.followUpStart = new Date();
        if (updateData.status) {
            updateData.isClosed = updateData.status === "Closed";
        }
          const findUserNameById = async (id) => {
            const user = await User.findById(id).lean();
            return user ? user.name : "Unknown";
          };
        // Attach associate info from session
        if (session?.user) {
            updateData.assignedTo = await findUserNameById(session.user.id);
            updateData.associate = await findUserNameById(session.user.id); // Keep both synced for unified UI
            updateData.associateId = session.user.id;
        }

        // 👇 1. Update Single Unified Lead Collection
        // If it's a completely new manual lead, we set the leadType based on the URL category
        const updatedLead = await Lead.findOneAndUpdate(
            { phone: mobile },
            { 
                $set: updateData,
                $setOnInsert: { leadType: targetType } 
            },
            { returnDocument: 'after', upsert: true }
        );

        // 👇 2. Upsert into Main Customer Collection without conflicts
        const customerUpdate = {};
        const customerInsert = {}; 

        if (updateData.name) {
            customerUpdate.name = updateData.name;
        } else {
            customerInsert.name = "Unknown"; // Prevents "ConflictingUpdateOperators" error
        }

        if (updateData.city) customerUpdate.city = updateData.city;
        if (updateData.address) customerUpdate.address = updateData.address;
        if (updateData.source) customerUpdate.source = updateData.source;

        const customerUpdateOperation = { $set: customerUpdate };
        if (Object.keys(customerInsert).length > 0) {
            customerUpdateOperation.$setOnInsert = customerInsert;
        }

        await Customer.findOneAndUpdate(
            { phone: mobile },
            customerUpdateOperation,
            { returnDocument: 'after', upsert: true } 
        );

        return NextResponse.json({ success: true, lead: updatedLead });
    } catch (error) {
        console.error("Category Lead Update Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}