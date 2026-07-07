import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/shared/lib/auth";
import connectDB from "@/shared/lib/db/mongodb";
import Lead from "@/shared/models/Lead";
import User from "@/shared/models/User";
import Customer from "@/shared/models/Customer";
import { getUserNameById } from "@/shared/utils/userUtils";
export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await connectDB();

    const myEmail = session.user.email;
    const me = await User.findOne({ email: myEmail }).lean();

    const myId = session.user.id;
    const myName = await getUserNameById(myId, session.user.name);
    const accessModules = session.user.accessModules || [];
    const target = me && me.target ? parseInt(me.target) : 0;

    const { searchParams } = new URL(req.url);
    const now = new Date();
    const monthParam = searchParams.get("month");
    const yearParam = searchParams.get("year");

    const targetMonth = monthParam ? parseInt(monthParam) : now.getUTCMonth() + 1;
    const targetYear = yearParam ? parseInt(yearParam) : now.getUTCFullYear();

    const startDate = new Date(Date.UTC(targetYear, targetMonth - 1, 1, 0, 0, 0, 0));
    const endDate = new Date(Date.UTC(targetYear, targetMonth, 0, 23, 59, 59, 999));

    const isSuperAdmin = session.user.role === "superAdmin";
    const isAdminDepartment = session.user.department === "admin";

    let allowedTypes = [];
    if (!isSuperAdmin && !isAdminDepartment) {
      allowedTypes.push("Direct Lead");
      if (accessModules.includes("Product Lead")) allowedTypes.push("Product Lead");
      if (accessModules.includes("MD Camp")) allowedTypes.push("MD Camp");
      if (accessModules.includes("Therapy")) allowedTypes.push("Therapy");
    }

    const baseMatch = {
      $or: [
        { associateId: myId },
        { assignedTo: myName },
        { closedById: myId },
        { "handledByHistory.associateId": myId },
        { "leads.associateId": myId },
      ],
    };

    if (allowedTypes.length > 0) {
      baseMatch["leads.leadType"] = { $in: allowedTypes };
    }

    const pipeline = [
      { $match: baseMatch },

      {
        $addFields: {
          firstFollowUp: { $arrayElemAt: ["$leads", 0] },
          latestFollowUp: { $arrayElemAt: ["$leads", -1] },
          
          // 🚀 FIX: For the Dashboard Table column - ONLY COUNT CLOSED ITEMS!
          followUpCount: {
            $size: {
              $filter: {
                input: { $ifNull: ["$leads", []] },
                as: "item",
                cond: { $eq: ["$$item.status", "Closed"] }
              }
            }
          },
        },
      },

      {
        $unwind: {
          path: "$leads",
          preserveNullAndEmptyArrays: true,
        },
      },

      {
        $match: {
          $or: [
            { createdAt: { $gte: startDate, $lte: endDate } },
            { "leads.date": { $gte: startDate, $lte: endDate } },
            { "firstFollowUp.date": { $gte: startDate, $lte: endDate } },
            { closedAt: { $gte: startDate, $lte: endDate } },
          ],
        },
      },

      {
        $group: {
          _id: "$_id",
          phone: { $first: "$phone" },
          name: { $first: "$name" },
          city: { $first: "$city" },
          source: { $first: "$source" },
          isClosed: { $first: "$isClosed" },
          closedBy: { $first: "$closedBy" },
          closedById: { $first: "$closedById" },
          closedAt: { $first: "$closedAt" },
          createdAt: { $first: "$createdAt" },
          followUpCount: { $first: "$followUpCount" },
          firstFollowUp: { $first: "$firstFollowUp" },
          latestFollowUp: { $first: "$latestFollowUp" },
          assignedTo: { $first: "$assignedTo" },
          associateId: { $first: "$associateId" },

          monthFollowUps: {
            $push: {
              $cond: [
                {
                  $and: [
                    { $gte: ["$leads.date", startDate] },
                    { $lte: ["$leads.date", endDate] },
                  ],
                },
                "$leads",
                "$$REMOVE",
              ],
            },
          },
        },
      },
    ];

    const aggregatedLeads = await Lead.aggregate(pipeline);

    let pendingCount = 0;
    let activeFollowUpsTotal = 0; // 🚀 Top Card Metric (Decoupled from table data)
    let totalThisMonth = 0;
    let closedThisMonthCount = 0;

    const phoneList = aggregatedLeads.map((l) => l.phone);
    const customers = await Customer.find({ phone: { $in: phoneList } })
      .select("phone name")
      .lean();

    const formattedLeads = aggregatedLeads.map((lead) => {
      const custData = customers.find((c) => c.phone === lead.phone) || {};

      const finalName =
        custData.name && custData.name !== "Unknown"
          ? custData.name
          : lead.name && lead.name !== "Unknown"
            ? lead.name
            : lead.phone.replace("whatsapp:", "");

      const latest = lead.latestFollowUp || {};
      const isCurrentHandler =
        latest.associateId === myId ||
        latest.associateName === myName ||
        lead.assignedTo === myName;

      const firstDate = new Date(lead.firstFollowUp?.date || lead.createdAt);
      const firstHandlerId = lead.firstFollowUp?.associateId || lead.associateId;
      
      if (firstDate >= startDate && firstDate <= endDate && (firstHandlerId === myId || lead.firstFollowUp?.associateName === myName)) {
        totalThisMonth++;
      }

      if (lead.monthFollowUps && lead.monthFollowUps.length > 0) {
        lead.monthFollowUps.forEach((fu) => {
          if (fu.status === "Closed" && (fu.associateId === myId || fu.associateName === myName)) {
            closedThisMonthCount++;
          }
        });
      }

      // 🚀 Active Follow-ups Logic: LATEST status must be "Follow Up"
      if (!lead.isClosed && isCurrentHandler) {
        const currentStatus = latest.status || lead.status || "New";

        if (currentStatus === "Follow Up") {
          const followUpDate = new Date(latest.date || lead.createdAt);
          const hoursDiff = (Date.now() - followUpDate.getTime()) / (1000 * 60 * 60);

          if (hoursDiff > 48) {
            pendingCount++; 
          } else {
            activeFollowUpsTotal++; // Add +1 to Top Card Metric
          }
        } else if (currentStatus === "New" || currentStatus === "Not Interested") {
          pendingCount++; 
        }
      }

      let displayStatus = latest.status || "New";
      if (lead.isClosed) {
        displayStatus = lead.closedBy === myName ? "Closed" : `Closed by ${lead.closedBy}`;
      }

      let categoryParam = null;
      if (latest.leadType === "Product Lead") categoryParam = "product";
      else if (latest.leadType === "MD Camp") categoryParam = "mdcamp";
      else if (latest.leadType === "Therapy") categoryParam = "therapy";

      return {
        phone: lead.phone,
        name: finalName,
        status: displayStatus,
        isClosed: lead.isClosed || false,
        categoryParam,
        timeSort: new Date(latest.date || lead.createdAt).getTime(),

        firstFollowUp: lead.firstFollowUp || {},
        latestFollowUp: latest,

        firstFollowUpUser: lead.firstFollowUp?.associateName || "Unknown",
        currentHandler: latest.associateName || lead.assignedTo || "Unassigned",
        closedBy: lead.closedBy || null,
        followUpCount: lead.followUpCount || 0, // This is now strictly the "Closed" count
      };
    });

    formattedLeads.sort((a, b) => b.timeSort - a.timeSort);

    return NextResponse.json({
      stats: {
        target,
        achieved: closedThisMonthCount,
        pending: pendingCount,
        followUp: activeFollowUpsTotal, // Returns the active count for the top card
        total: totalThisMonth,
      },
      leads: formattedLeads,
    });
  } catch (error) {
    console.error("Dashboard API Error:", error);
    return NextResponse.json(
      { error: "Server Error", details: error.message },
      { status: 500 },
    );
  }
}