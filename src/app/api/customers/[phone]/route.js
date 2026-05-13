import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import Customer from "@/models/Customer";

export const dynamic = "force-dynamic";

// --- GET: Fetch Single Customer Profile ---
export async function GET(req, { params }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        await connectDB();
        
        const resolvedParams = await params;
        const rawPhone = decodeURIComponent(resolvedParams.phone || "");
        
        // 1. Strip everything except digits
        const cleanPhone = rawPhone.replace(/\D/g, '');
        
        // 2. Create variations to ensure we catch the customer regardless of how it's stored in DB
        const variations = [
            cleanPhone, // e.g. "919900010003"
            `whatsapp:${cleanPhone}`, // e.g. "whatsapp:919900010003"
            `whatsapp:+${cleanPhone}`, // e.g. "whatsapp:+919900010003"
            `+${cleanPhone}` // e.g. "+919900010003"
        ];

        // If the number starts with 91 and is 12 digits, also try searching without the 91
        if (cleanPhone.startsWith('91') && cleanPhone.length === 12) {
            const tenDigit = cleanPhone.substring(2);
            variations.push(tenDigit);
            variations.push(`whatsapp:${tenDigit}`);
            variations.push(`whatsapp:+91${tenDigit}`);
            variations.push(`+91${tenDigit}`);
        }

        // Use $in to search across all possible variations
        const customer = await Customer.findOne({
            phone: { $in: variations }
        }).lean();

        if (!customer) {
            console.log(`[Customer API] 404 Not Found for phone query: ${rawPhone}. Tried variations:`, variations);
            return NextResponse.json({ error: "Customer not found" }, { status: 404 });
        }

        const formattedData = {
            phone: customer.phone,
            name: customer.name || "Unknown",
            city: customer.city || "",
            address: customer.address || "",
            source: customer.source || "Manual Entry",
            enquiredFor: customer.enquiredFor || "",
            status: customer.status || "New",
            priority: customer.priority || "Medium", 
            remarks: customer.remarks || "",
            saleAmount: customer.saleAmount || "0",
            associate: customer.assignedTo || "Unassigned",
            visitCount: customer.visitCount || 1,
            date: customer.updatedAt ? new Date(customer.updatedAt).toISOString() : new Date().toISOString(),
            isClosed: customer.isClosed || false,
            followUpStartDate: customer.followUpStartDate || null
        };

        return NextResponse.json(formattedData, { status: 200 });

    } catch (error) {
        console.error("Fetch Single Customer Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

// --- PUT: Update Single Customer Profile ---
export async function PUT(req, { params }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        await connectDB();
        
        const resolvedParams = await params;
        const rawPhone = decodeURIComponent(resolvedParams.phone || "");
        const cleanPhone = rawPhone.replace(/\D/g, '');
        
        const variations = [
            cleanPhone, 
            `whatsapp:${cleanPhone}`, 
            `whatsapp:+${cleanPhone}`,
            `+${cleanPhone}`
        ];

        if (cleanPhone.startsWith('91') && cleanPhone.length === 12) {
            const tenDigit = cleanPhone.substring(2);
            variations.push(tenDigit);
            variations.push(`whatsapp:${tenDigit}`);
        }

        const body = await req.json();

        // Dynamically build the update payload safely
        const updateData = {
            $set: {
                name: body.name?.trim(),
                city: body.city?.trim(),
                address: body.address?.trim(),
                source: body.source?.trim(),
                enquiredFor: body.enquiredFor?.trim(),
                status: body.status?.trim(),
                saleAmount: body.saleAmount?.toString(),
                remarks: body.remarks?.trim(),
                updatedAt: new Date()
            }
        };

        // Remove undefined/null keys to avoid breaking DB
        Object.keys(updateData.$set).forEach(key => {
            if (updateData.$set[key] === undefined) {
                delete updateData.$set[key];
            }
        });

        const updatedCustomer = await Customer.findOneAndUpdate(
            { phone: { $in: variations } },
            updateData,
            { new: true, runValidators: true }
        );

        if (!updatedCustomer) {
            return NextResponse.json({ error: "Customer not found for update" }, { status: 404 });
        }

        return NextResponse.json({ success: true, message: "Profile updated securely." }, { status: 200 });

    } catch (error) {
        console.error("Update Customer Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}