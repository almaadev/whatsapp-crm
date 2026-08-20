import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/shared/lib/auth";
import connectDB from "@/shared/lib/db/mongodb";
import Customer from "@/shared/models/Customer";
import Branch from "@/shared/models/Branch";
import { resolveCustomerDisplayName } from "@/shared/utils/customerResolver";
import { serverCustomerService } from "@/server/services/serverCustomerService";

export const dynamic = "force-dynamic";

const formatCustomerForUI = (c, branchMap = {}) => {
  const bId = c.branchId ? (c.branchId._id ? c.branchId._id.toString() : c.branchId.toString()) : null;
  const bObj = bId && branchMap[bId] ? branchMap[bId] : null;
  const branchName = bObj ? (typeof bObj === "object" ? bObj.name : bObj) : "Unassigned Branch";
  const branchCode = bObj && typeof bObj === "object" ? bObj.code || "" : "";

  return {
    phone: c.phone,
    name: resolveCustomerDisplayName(c),
    city: c.currentAddressId?.city || c.city || "",
    address: c.currentAddressId?.address || c.address || "",
    source: c.source || "Manual Entry",
    enquiredFor: c.enquiredFor || "",
    status: c.status || "New",
    priority: c.priority || "Medium", 
    remarks: c.remarks || "",
    saleAmount: c.saleAmount || "0",
    associate: c.assignedTo || "Unassigned",
    branchId: bId,
    branchName: branchName,
    branchCode: branchCode,
    date: c.updatedAt ? new Date(c.updatedAt).toISOString() : new Date().toISOString(),
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