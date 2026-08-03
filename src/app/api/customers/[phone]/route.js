import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/shared/lib/auth";
import connectDB from "@/shared/lib/db/mongodb";
import Customer from "@/shared/models/Customer";
import mongoose from "mongoose";
import Branch from "@/shared/models/Branch";
import User from "@/shared/models/User";
import { resolveCustomerDisplayName } from "@/shared/utils/customerResolver";
import { sanitizeCustomerOrLeadData } from "@/shared/utils/privacy";

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

        const { getBranchFilterForUser } = await import("@/shared/utils/serverAuth");
        const { branchQuery } = await getBranchFilterForUser(session);

        // Use $in to search across all possible variations
        const customer = await Customer.findOne({
            phone: { $in: variations },
            ...branchQuery
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

        const branches = await Branch.find().select("name code").lean();
        const branchMap = {};
        branches.forEach(b => {
            branchMap[b._id.toString()] = { name: b.name, code: b.code || "" };
        });

        let creatorInfo = null;
        if (customer.createdBy) {
            const branchVal = customer.createdBy.branch?.toString() || "";
            const bObj = branchMap[branchVal];
            const branchName = bObj ? bObj.name : (customer.createdBy.branch || "");
            creatorInfo = {
                name: customer.createdBy.name || "Unknown",
                role: customer.createdBy.role || "",
                department: customer.createdBy.department || "",
                branchName: branchName || "",
                userId: customer.createdBy._id ? customer.createdBy._id.toString() : ""
            };
        }

        const resolvedChatHistory = (customer.chatHistory || []).map(entry => {
            let performedByResolved = null;
            if (entry.performedBy) {
                const branchVal = entry.performedBy.branch?.toString() || "";
                const bObj = branchMap[branchVal];
                const branchName = bObj ? bObj.name : (entry.performedBy.branch || "");
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
                const bObj = branchMap[branchVal];
                const branchName = bObj ? bObj.name : (entry.targetUser.branch || "");
                targetUserResolved = {
                    name: entry.targetUser.name || "Unknown",
                    role: entry.targetUser.role || "",
                    department: entry.targetUser.department || "",
                    branchName: branchName
                };
            }
            const performedAtVal = entry.performedAt || entry.timestamp || new Date();
            const performedByIdVal = entry.performedById || (entry.performedBy?._id ? entry.performedBy._id.toString() : (typeof entry.performedBy === "string" ? entry.performedBy : null));
            const performedByRoleVal = entry.performedByRole || performedByResolved?.role || "";

            return {
                _id: entry._id?.toString(),
                action: entry.action || "System Action",
                eventType: entry.eventType || (entry.action === "Branch Reassigned" ? "Chat Branch Reassigned" : entry.action) || "System Action",
                timestamp: performedAtVal,
                performedAt: performedAtVal,
                notes: entry.notes || "",
                isInternal: entry.isInternal || false,
                performedBy: performedByResolved || entry.performedByName || (typeof entry.performedBy === "string" ? entry.performedBy : "System Admin"),
                performedByRole: performedByRoleVal,
                performedById: performedByIdVal,
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

        const custBranchIdStr = customer.branchId ? customer.branchId.toString() : null;
        const custBranchObj = custBranchIdStr ? branchMap[custBranchIdStr] : null;

        const formattedData = {
            phone: customer.phone,
            name: resolveCustomerDisplayName(customer),
            city: customer.city || "",
            address: customer.address || "",
            source: customer.source || "Manual Entry",
            enquiredFor: customer.enquiredFor || "",
            status: customer.status || "New",
            priority: customer.priority || "Medium", 
            remarks: customer.remarks || "",
            saleAmount: customer.saleAmount || "0",
            associate: customer.assignedTo || "Unassigned",
            branchId: custBranchIdStr,
            branchName: custBranchObj ? custBranchObj.name : "Unassigned Branch",
            branchCode: custBranchObj ? custBranchObj.code : "",
            lastIncomingNumber: customer.lastIncomingNumber || "",
            assignedTwilioNumber: customer.assignedTwilioNumber || "",
            date: customer.createdAt ? new Date(customer.createdAt).toISOString() : null,
            isClosed: customer.isClosed || false,
            followUpStartDate: customer.followUpStartDate || null,
            creatorInfo,
            chatHistory: filteredChatHistory
        };

        const sanitizedData = sanitizeCustomerOrLeadData(formattedData, session.user);
        return NextResponse.json(sanitizedData, { status: 200 });

    } catch (error) {
        console.error("Fetch Single Customer Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

import { serverCustomerService } from "@/server/services/serverCustomerService";

export async function PUT(req, { params }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        await connectDB();
        
        const resolvedParams = await params;
        const rawPhone = decodeURIComponent(resolvedParams.phone || "");
        const body = await req.json();

        const { customer, branchName, branchCode } = await serverCustomerService.updateCustomer(rawPhone, body, session);

        const rawCustomer = {
            ...customer.toObject(),
            branchId: customer.branchId ? customer.branchId.toString() : null,
            branchName,
            branchCode
        };
        const sanitizedCustomer = sanitizeCustomerOrLeadData(rawCustomer, session.user);
 
        return NextResponse.json({
            success: true,
            message: "Profile updated securely.",
            customer: sanitizedCustomer
        }, { status: 200 });

    } catch (error) {
        console.error("Update Customer Error:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}