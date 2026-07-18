import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/shared/lib/auth";
import connectDB from "@/shared/lib/db/mongodb";
import Customer from "@/shared/models/Customer";
import mongoose from "mongoose";
import Branch from "@/shared/models/Branch";
import User from "@/shared/models/User";

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
        }).populate({
            path: 'createdBy',
            select: 'name role department branch'
        }).populate({
            path: 'chatHistory.performedBy',
            select: 'name role department branch'
        }).populate({
            path: 'chatHistory.targetUser',
            select: 'name role department branch'
        }).lean();

        if (!customer) {
           console.warn(`Customer not found for phone variations: ${variations.join(", ")}`);
            return NextResponse.json({ error: "Customer not found" }, { status: 404 });
        }

        const branches = await Branch.find().lean();
        const branchMap = {};
        branches.forEach(b => {
            branchMap[b._id.toString()] = b.name;
        });

        let creatorInfo = null;
        if (customer.createdBy) {
            const branchVal = customer.createdBy.branch?.toString() || "";
            const branchName = branchMap[branchVal] || customer.createdBy.branch || "";
            creatorInfo = {
                name: customer.createdBy.name || "Unknown",
                role: customer.createdBy.role || "",
                department: customer.createdBy.department || "",
                branchName: branchName || ""
            };
        }

        const resolvedChatHistory = (customer.chatHistory || []).map(entry => {
            let performedByResolved = null;
            if (entry.performedBy) {
                const branchVal = entry.performedBy.branch?.toString() || "";
                const branchName = branchMap[branchVal] || entry.performedBy.branch || "";
                performedByResolved = {
                    name: entry.performedBy.name || "Unknown",
                    role: entry.performedBy.role || "",
                    department: entry.performedBy.department || "",
                    branchName: branchName
                };
            }
            let targetUserResolved = null;
            if (entry.targetUser) {
                const branchVal = entry.targetUser.branch?.toString() || "";
                const branchName = branchMap[branchVal] || entry.targetUser.branch || "";
                targetUserResolved = {
                    name: entry.targetUser.name || "Unknown",
                    role: entry.targetUser.role || "",
                    department: entry.targetUser.department || "",
                    branchName: branchName
                };
            }
            return {
                _id: entry._id?.toString(),
                action: entry.action,
                timestamp: entry.timestamp,
                notes: entry.notes || "",
                isInternal: entry.isInternal || false,
                performedBy: performedByResolved,
                targetUser: targetUserResolved
            };
        });

        const userRole = session.user.role || "associate";
        const filteredChatHistory = resolvedChatHistory.filter(entry => {
            if (entry.isInternal) {
                return userRole === "superAdmin";
            }
            return true;
        });

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
            
            date: customer.createdAt ? new Date(customer.createdAt).toISOString() : null,
            isClosed: customer.isClosed || false,
            followUpStartDate: customer.followUpStartDate || null,
            creatorInfo,
            chatHistory: filteredChatHistory
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