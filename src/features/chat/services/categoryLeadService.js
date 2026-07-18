import connectDB from "@/shared/lib/db/mongodb";
import Lead from "@/shared/models/Lead";
import Customer from "@/shared/models/Customer";
import Branch from "@/shared/models/Branch";
import User from "@/shared/models/User";
import { normalizePhone } from "@/shared/utils/phoneUtils";
import mongoose from "mongoose";

export const categoryLeadService = {
  /**
   * Fetches and builds detailed customer details for a category lead (Product Lead, MD Camp, Therapy).
   * 
   * @param {string} category - The lead category type (e.g., 'Product Lead', 'MD Camp', 'Therapy')
   * @param {string} phone - The phone number of the customer
   */
  async getCategoryLeadByPhone(category, phone) {
    await connectDB();
    const cleanPhone = normalizePhone(decodeURIComponent(phone));
    console.log(`[categoryLeadService] Fetching details for category: "${category}", phone: "${cleanPhone}"`);

    // 1. Fetch the category lead document from the Lead collection
    const lead = await Lead.findOne({
      phone: cleanPhone,
    }).lean();
    console.log(`[categoryLeadService] Found MongoDB Lead document:`, lead);

    // 2. Fetch/Populate the linked Customer document
    // If lead document specifies a customerId or customer reference, query using that; otherwise query by phone.
    let customerQuery = { phone: cleanPhone };
    if (lead?.customer && mongoose.Types.ObjectId.isValid(lead.customer)) {
      customerQuery = { _id: lead.customer };
    } else if (lead?.customerId && mongoose.Types.ObjectId.isValid(lead.customerId)) {
      customerQuery = { _id: lead.customerId };
    }
    
    console.log(`[categoryLeadService] Querying Customer collection with:`, customerQuery);
    const customer = await Customer.findOne(customerQuery)
      .populate({
        path: "createdBy",
        select: "name role department branch"
      })
      .lean();
    console.log(`[categoryLeadService] Found MongoDB Customer document:`, customer);

    if (!lead && !customer) {
      console.log(`[categoryLeadService] No Lead or Customer document found for: ${cleanPhone}`);
      return null;
    }

    // 3. Resolve Branch
    let branchName = "";
    const branchVal = lead?.branchId || customer?.branchId || customer?.createdBy?.branch;
    if (branchVal) {
      const branchStr = branchVal.toString();
      if (mongoose.Types.ObjectId.isValid(branchStr)) {
        const branchObj = await Branch.findById(branchStr).lean();
        if (branchObj) {
          branchName = branchObj.name;
        }
      } else {
        branchName = branchStr;
      }
    }
    console.log(`[categoryLeadService] Resolved Branch name:`, branchName);

    // 4. Resolve Creator Info / Customer Owner details
    let creatorInfo = null;
    if (customer?.createdBy) {
      let creatorBranch = customer.createdBy.branch || "";
      if (mongoose.Types.ObjectId.isValid(creatorBranch.toString())) {
        const cBranch = await Branch.findById(creatorBranch).lean();
        if (cBranch) {
          creatorBranch = cBranch.name;
        }
      }
      creatorInfo = {
        name: customer.createdBy.name || "Unknown",
        role: customer.createdBy.role || "",
        department: customer.createdBy.department || "",
        branchName: creatorBranch || ""
      };
    } else if (lead?.associateId) {
      const assoc = await User.findById(lead.associateId).lean();
      if (assoc) {
        let assocBranch = assoc.branch || "";
        if (mongoose.Types.ObjectId.isValid(assocBranch.toString())) {
          const aBranch = await Branch.findById(assocBranch).lean();
          if (aBranch) assocBranch = aBranch.name;
        }
        creatorInfo = {
          name: assoc.name || "Unknown",
          role: assoc.role || "",
          department: assoc.department || "",
          branchName: assocBranch || ""
        };
      }
    }
    console.log(`[categoryLeadService] Resolved Customer Owner/Creator details:`, creatorInfo);

    const history = lead?.leads || [];
    const latest = history.length > 0 ? history[history.length - 1] : null;

    // 5. Construct mapped response matching requirements
    const result = {
      phone: lead?.phone || customer?.phone || cleanPhone,
      name: lead?.name || customer?.name || "Unknown",
      city: lead?.city || customer?.city || "",
      state: lead?.state || customer?.state || "",
      address: lead?.address || customer?.address || "",
      branch: branchName || "",
      assignedAssociate: lead?.assignedTo || customer?.assignedTo || "Unassigned",
      createdBy: creatorInfo?.name || "System",
      customerOwner: creatorInfo,
      leadStatus: latest?.status || customer?.status || "New",
      finalGoal: lead?.finalGoal || customer?.finalGoal || lead?.goal || customer?.goal || "",
      history: history,
      latestFollowUp: latest || {},
    };

    console.log(`[categoryLeadService] Final merged customer details payload:`, result);
    return result;
  }
};
