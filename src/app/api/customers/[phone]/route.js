import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/shared/lib/auth";
import connectDB from "@/shared/lib/db/mongodb";
import Customer from "@/shared/models/Customer";
import mongoose from "mongoose";
import Branch from "@/shared/models/Branch";
import User from "@/shared/models/User";
import CustomerAddress from "@/shared/models/CustomerAddress";
import Activity from "@/shared/models/Activity";
import Lead from "@/shared/models/Lead";
import { resolveCustomerDisplayName } from "@/shared/utils/customerResolver";
import { sanitizeCustomerOrLeadData } from "@/shared/utils/privacy";
import { serverCustomerService } from "@/server/services/serverCustomerService";

export const dynamic = "force-dynamic";

// --- GET: Fetch Single Customer Profile ---
export async function GET(req, { params }) {
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
            variations.push(`whatsapp:+91${tenDigit}`);
            variations.push(`+91${tenDigit}`);
        }

        const { getBranchFilterForUser } = await import("@/shared/utils/serverAuth");
        const { branchQuery } = await getBranchFilterForUser(session);

        const customer = await Customer.findOne({
            phone: { $in: variations },
            ...branchQuery
        }).populate("currentAddressId").populate({
            path: 'createdBy',
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

        // Fetch all leads for this customer to retrieve historical activities
        const leads = await Lead.find({ customerId: customer._id }).lean();
        const leadIds = leads.map(l => l._id);

        // Load timeline activities dynamically from Activity collection
        const TIMELINE_EVENTS = [
            "CUSTOMER_CREATED",
            "LEAD_CREATED",
            "CHAT_STARTED",
            "CHAT_CLOSED",
            "CHAT_REOPENED",
            "LEAD_ASSIGNED",
            "CUSTOMER_ASSIGNED",
            "FOLLOWUP_CREATED",
            "FOLLOWUP_COMPLETED",
            "LEAD_STATUS_CHANGED",
            "CUSTOMER_UPDATED",
            "PROFILE_UPDATED",
            "ADDRESS_UPDATED",
            "ADDRESS_CHANGED",
            "TEMPLATE_SENT"
        ];

        const query = {
            $or: [
                { customerId: customer._id },
                { leadId: { $in: leadIds } }
            ],
            eventType: { $in: TIMELINE_EVENTS }
        };

        const rawActivities = await Activity.find(query)
            .populate({
                path: 'actorId',
                select: 'name role department branch'
            })
            .populate({
                path: 'metadata.targetUser',
                select: 'name role department branch'
            })
            .sort({ createdAt: 1 })
            .lean();

        // Deduplicate activities by _id
        const uniqueActivities = Array.from(
            new Map(
                rawActivities.map(activity => [activity._id.toString(), activity])
            ).values()
        );

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

        const resolvedChatHistory = uniqueActivities.map(entry => {
            let performedByResolved = null;
            if (entry.actorId) {
                const branchVal = entry.actorId.branch?.toString() || "";
                const bObj = branchMap[branchVal];
                const branchName = bObj ? bObj.name : (entry.actorId.branch || "");
                performedByResolved = {
                    name: entry.actorId.name || "Unknown",
                    role: entry.actorId.role || "",
                    department: entry.actorId.department || "",
                    branchName: branchName
                };
            }
            let targetUserResolved = null;
            if (entry.metadata?.targetUser) {
                const branchVal = entry.metadata.targetUser.branch?.toString() || "";
                const bObj = branchMap[branchVal];
                const branchName = bObj ? bObj.name : (entry.metadata.targetUser.branch || "");
                targetUserResolved = {
                    name: entry.metadata.targetUser.name || "Unknown",
                    role: entry.metadata.targetUser.role || "",
                    department: entry.metadata.targetUser.department || "",
                    branchName: branchName
                };
            }

            const performedAtVal = entry.createdAt;
            const performedByIdVal = entry.actorId?._id?.toString() || entry.actorId || null;
            const performedByRoleVal = entry.metadata?.performedByRole || performedByResolved?.role || "";
            const actionName = entry.metadata?.action || (entry.eventType === "ADDRESS_CHANGED" ? "Address Changed" : entry.eventType === "ASSIGNED" ? "Assigned" : "System Action");

            return {
                ...entry,
                _id: entry._id?.toString(),
                action: actionName,
                eventType: entry.eventType,
                entityType: entry.entityType || "General",
                entityId: entry.entityId?.toString() || null,
                customerId: entry.customerId?.toString() || null,
                leadId: entry.leadId?.toString() || null,
                conversationId: entry.conversationId || entry.leadId?.toString() || null,
                actorId: performedByIdVal,
                performedBy: performedByResolved || entry.metadata?.performedByName || "System Admin",
                performedByRole: performedByRoleVal,
                performedById: performedByIdVal,
                targetUser: targetUserResolved,
                metadata: entry.metadata || {},
                timestamp: performedAtVal,
                performedAt: performedAtVal,
                createdAt: entry.createdAt
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
            city: customer.currentAddressId?.city || customer.city || "",
            address: customer.currentAddressId?.address || customer.address || "",
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

// --- PUT: Update Customer Profile ---
export async function PUT(req, { params }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        await connectDB();
        
        const resolvedParams = await params;
        const rawPhone = decodeURIComponent(resolvedParams.phone || "");
        const body = await req.json();

        const { customer, branchName, branchCode } = await serverCustomerService.updateCustomer(rawPhone, body, session);

        // Fetch back with current address populated
        const fullCustomer = await Customer.findById(customer._id).populate("currentAddressId").lean();

        const rawCustomer = {
            ...fullCustomer,
            branchId: fullCustomer.branchId ? fullCustomer.branchId.toString() : null,
            city: fullCustomer.currentAddressId?.city || "",
            address: fullCustomer.currentAddressId?.address || "",
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