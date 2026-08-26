import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/shared/lib/auth";
import connectDB from "@/shared/lib/db/mongodb";
import Customer from "@/shared/models/Customer";
import Branch from "@/shared/models/Branch";
import Activity from "@/shared/models/Activity";
import Lead from "@/shared/models/Lead";
import { resolveCustomerDisplayName } from "@/shared/utils/customerResolver";
import { sanitizeCustomerOrLeadData } from "@/shared/utils/privacy";
import { serverCustomerService } from "@/server/services/serverCustomerService";
import { getActivityTitle, formatActorDisplayName } from "@/shared/utils/activityFormatter";
import { normalizePhone, getPhoneVariations } from "@/shared/utils/phoneUtils";

export const dynamic = "force-dynamic";

// --- GET: Fetch Single Customer Profile ---
export async function GET(req, { params }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        await connectDB();
        
        const resolvedParams = await params;
        const rawPhone = decodeURIComponent(resolvedParams.phone || "");
        const cleanPhone = normalizePhone(rawPhone);
        const variations = getPhoneVariations(cleanPhone);

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
            "NAME_UPDATED",
            "CITY_UPDATED",
            "SOURCE_UPDATED",
            "ENQUIRED_FOR_UPDATED",
            "LEAD_TYPE_UPDATED",
            "BRANCH_UPDATED",
            "OVERALL_REMARKS_UPDATED",
            "FOLLOWUP_REMARK_UPDATED",
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
                select: 'name preferredName role department branch'
            })
            .populate({
                path: 'metadata.targetUser',
                select: 'name preferredName role department branch'
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
                name: customer.createdBy.name || customer.createdBy.preferredName || "Unknown",
                role: customer.createdBy.role || "",
                department: customer.createdBy.department || "",
                branchName: branchName || "",
                userId: customer.createdBy._id ? customer.createdBy._id.toString() : ""
            };
        }

        const resolvedChatHistory = uniqueActivities.map(entry => {
            const isWebhookOrAuto = entry.source === "WEBHOOK" || entry.metadata?.source === "WEBHOOK" || entry.metadata?.isAutomatic === true || (!entry.actorId && (!entry.metadata?.performedByName || entry.metadata?.performedByName === "System Admin") && entry.eventType === "LEAD_CREATED");

            let performedByResolved = null;
            if (entry.actorId) {
                const branchVal = entry.actorId.branch?.toString() || "";
                const bObj = branchMap[branchVal];
                const branchName = bObj ? bObj.name : (entry.actorId.branch || "");
                performedByResolved = {
                    name: entry.actorId.name || entry.actorId.preferredName || "Unknown",
                    role: entry.actorId.role || "associate",
                    department: entry.actorId.department || "",
                    branchName: branchName
                };
            } else if (!isWebhookOrAuto) {
                performedByResolved = {
                    name: entry.metadata?.performedByName || "System Admin",
                    role: entry.metadata?.performedByRole || "superAdmin",
                    department: entry.metadata?.performedByDept || "admin"
                };
            }

            let targetUserResolved = null;
            if (entry.metadata?.targetUser) {
                const branchVal = entry.metadata.targetUser.branch?.toString() || "";
                const bObj = branchMap[branchVal];
                const branchName = bObj ? bObj.name : (entry.metadata.targetUser.branch || "");
                targetUserResolved = {
                    name: entry.metadata.targetUser.name || entry.metadata.targetUser.preferredName || "Unknown",
                    role: entry.metadata.targetUser.role || "",
                    department: entry.metadata.targetUser.department || "",
                    branchName: branchName
                };
            }

            const performedAtVal = entry.createdAt;
            const performedByIdVal = entry.actorId?._id?.toString() || entry.actorId || null;
            const actionName = (isWebhookOrAuto && entry.eventType === "LEAD_CREATED")
                ? "New Lead"
                : (entry.metadata?.action || getActivityTitle(entry.eventType, performedByResolved, entry.metadata || {}));

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
                performedBy: performedByResolved,
                performedByName: performedByResolved?.name || null,
                performedByRole: performedByResolved?.role || null,
                performedByDept: performedByResolved?.department || null,
                performedByLabel: performedByResolved ? formatActorDisplayName(performedByResolved) : null,
                performedById: performedByIdVal,
                targetUser: targetUserResolved,
                metadata: {
                    ...entry.metadata,
                    action: actionName,
                    performedByName: performedByResolved?.name || null,
                    performedByRole: performedByResolved?.role || null,
                    performedByDept: performedByResolved?.department || null
                },
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