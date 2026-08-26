import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/shared/lib/auth";
import connectDB from "@/shared/lib/db/mongodb";
import Customer from "@/shared/models/Customer";
import CustomerAddress from "@/shared/models/CustomerAddress";
import Branch from "@/shared/models/Branch";
import Lead from "@/shared/models/Lead";
import { resolveCustomerDisplayName } from "@/shared/utils/customerResolver";
import { serverCustomerService } from "@/server/services/serverCustomerService";

export const dynamic = "force-dynamic";

const formatCustomerForUI = (c, branchMap = {}, lead = null) => {
  const bId = c.branchId ? (c.branchId._id ? c.branchId._id.toString() : c.branchId.toString()) : null;
  const bObj = bId && branchMap[bId] ? branchMap[bId] : null;
  const branchName = bObj ? (typeof bObj === "object" ? bObj.name : bObj) : "Unassigned Branch";
  const branchCode = bObj && typeof bObj === "object" ? bObj.code || "" : "";

  const leadFollowups = lead?.leads || [];
  const latestFollowup = leadFollowups.length > 0 ? leadFollowups[leadFollowups.length - 1] : null;
  const leadType = latestFollowup?.leadType || c.activeRouteCategory || "Direct Lead";

  return {
    _id: c._id ? c._id.toString() : null,
    phone: c.phone,
    name: resolveCustomerDisplayName(c),
    city: c.currentAddressId?.city || c.city || "",
    address: c.currentAddressId?.address || c.address || "",
    source: c.source || "Manual Entry",
    enquiredFor: latestFollowup?.enquiredFor || c.enquiredFor || "",
    status: latestFollowup?.status || c.status || "New",
    priority: latestFollowup?.priority || c.priority || "Medium", 
    remarks: latestFollowup?.overAllRemarks || c.remarks || "",
    saleAmount: latestFollowup?.saleAmount || c.saleAmount || "0",
    associate: c.assignedTo || "Unassigned",
    assignedTo: (lead?.assignedTo && lead.assignedTo.toLowerCase() !== "unassigned")
      ? lead.assignedTo
      : (c.assignedTo && c.assignedTo.toLowerCase() !== "unassigned" ? c.assignedTo : "unassigned"),
    leadType: leadType,
    leads: leadFollowups,
    handledByHistory: lead?.handledByHistory || [],
    activeLeadId: lead?._id?.toString() || (c.activeLeadId ? c.activeLeadId.toString() : null),
    branchId: bId,
    branchName: branchName,
    branchCode: branchCode,
    date: c.updatedAt ? new Date(c.updatedAt).toISOString() : new Date().toISOString(),
    createdAt: c.createdAt ? new Date(c.createdAt).toISOString() : new Date().toISOString(),
    updatedAt: c.updatedAt ? new Date(c.updatedAt).toISOString() : new Date().toISOString(),
    lastActivityDate: c.lastInteractionAt || c.updatedAt || c.createdAt || new Date().toISOString(),
    isClosed: c.isClosed || false,
    creatorInfo: c.createdBy ? {
        name: c.createdBy.name || "Unknown",
        role: c.createdBy.role || "",
        department: c.createdBy.department || "",
        branchName: (branchMap[c.createdBy.branch?.toString()] ? (typeof branchMap[c.createdBy.branch?.toString()] === "object" ? branchMap[c.createdBy.branch?.toString()].name : branchMap[c.createdBy.branch?.toString()]) : "") || c.createdBy.branch || ""
    } : null
  };
};

export async function GET(req) {
    try {
        await connectDB();
        const session = await getServerSession(authOptions);
        const { getBranchFilterForUser } = await import("@/shared/utils/serverAuth");
        const { branchQuery } = await getBranchFilterForUser(session);

        const branches = await Branch.find().select("name code").lean();
        const branchMap = {};
        branches.forEach(b => {
          branchMap[b._id.toString()] = { name: b.name, code: b.code || "" };
        });

        // Fetch lean records sorted by latest updates, populating currentAddressId
        const customers = await Customer.find(branchQuery).sort({ updatedAt: -1 })
            .populate("currentAddressId")
            .populate({
                path: 'createdBy',
                select: 'name role department branch'
            })
            .lean();
        
        // Batch fetch associated leads for all customers without N+1 queries
        const customerIds = customers.map(c => c._id);
        const leads = await Lead.find({ customerId: { $in: customerIds } }).lean();
        const leadByCustId = new Map(leads.map(l => [l.customerId.toString(), l]));

        const formattedData = customers.map(c => {
          const lead = c._id ? leadByCustId.get(c._id.toString()) : null;
          return formatCustomerForUI(c, branchMap, lead);
        });

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
        const { phone } = body;

        if (!phone || phone.trim() === "") {
            return NextResponse.json({ error: "Phone number is required." }, { status: 400 });
        }

        // Delegate to customer service to ensure normalized creation (address, logs, etc.)
        const { customer } = await serverCustomerService.updateCustomer(phone, body, session);

        const branches = await Branch.find().lean();
        const branchMap = {};
        branches.forEach(b => {
          branchMap[b._id.toString()] = b.name;
        });

        // Re-populate creator info for response mapping
        const populatedCustomer = await Customer.findById(customer._id)
          .populate("currentAddressId")
          .populate({
            path: 'createdBy',
            select: 'name role department branch'
          })
          .lean();

        return NextResponse.json({ 
            success: true, 
            data: formatCustomerForUI(populatedCustomer, branchMap) 
        }, { status: 201 });

    } catch (error) {
        console.error("Customer POST error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}