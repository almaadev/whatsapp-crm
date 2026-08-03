import Customer from "@/shared/models/Customer";
import Branch from "@/shared/models/Branch";
import User from "@/shared/models/User";
import { 
  emitCustomerBranchUpdated,
  emitCustomerUpdated
} from "@/shared/utils/socketPublisher";

export const serverCustomerService = {
  async updateCustomer(phone, body, session) {
    const cleanPhone = phone.replace(/\D/g, "");
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
    } else if (cleanPhone.length === 10) {
      variations.push(`91${cleanPhone}`);
      variations.push(`whatsapp:91${cleanPhone}`);
      variations.push(`whatsapp:+91${cleanPhone}`);
      variations.push(`+91${cleanPhone}`);
    }

    const { getBranchFilterForUser } = await import("@/shared/utils/serverAuth");
    const { branchQuery } = await getBranchFilterForUser(session);

    const findQuery = { phone: { $in: variations } };
    if (session?.user?.role !== "superAdmin" && branchQuery?.branchId) {
      findQuery.$or = [
        branchQuery,
        { branchId: null },
        { branchId: { $exists: false } }
      ];
    }

    const setPayload = {
      updatedAt: new Date()
    };
    if (body.name?.trim() !== undefined) setPayload.name = body.name.trim();
    if (body.city?.trim() !== undefined) setPayload.city = body.city.trim();
    if (body.address?.trim() !== undefined) setPayload.address = body.address.trim();
    if (body.source?.trim() !== undefined) setPayload.source = body.source.trim();
    if (body.enquiredFor?.trim() !== undefined) setPayload.enquiredFor = body.enquiredFor.trim();
    if (body.status?.trim() !== undefined) setPayload.status = body.status.trim();
    if (body.saleAmount !== undefined) setPayload.saleAmount = body.saleAmount.toString();
    if (body.remarks?.trim() !== undefined) setPayload.remarks = body.remarks.trim();

    let resolvedBranchName = "Unassigned Branch";
    let resolvedBranchCode = "";

    if (body.branchId !== undefined) {
      if (body.branchId) {
        const branchDoc = await Branch.findOne({ _id: body.branchId, status: "active" }).lean();
        if (!branchDoc) {
          throw new Error("Invalid or inactive branch selected.");
        }
        setPayload.branchId = body.branchId;
        resolvedBranchName = branchDoc.name;
        resolvedBranchCode = branchDoc.code || "";
      } else {
        setPayload.branchId = null;
      }
    }
    if (body.assignedTwilioNumber !== undefined) {
      setPayload.assignedTwilioNumber = body.assignedTwilioNumber || null;
    }

    const existingCustomer = await Customer.findOne(findQuery).lean();
    const oldBranchId = existingCustomer?.branchId ? existingCustomer.branchId.toString() : null;
    const newBranchId = body.branchId ? body.branchId.toString() : null;

    const updateData = { 
      $set: setPayload,
      $setOnInsert: {
        phone: variations[0]?.startsWith("whatsapp:") ? variations[0] : `whatsapp:${cleanPhone}`,
        createdBy: session.user.id
      }
    };

    if (body.branchId !== undefined && oldBranchId !== newBranchId) {
      const now = new Date();
      updateData.$push = {
        chatHistory: {
          action: "Branch Reassigned",
          eventType: "Chat Branch Reassigned",
          performedBy: session.user.id,
          performedById: session.user.id,
          performedByName: session.user.name || "User",
          performedByRole: session.user.role || "associate",
          performedAt: now,
          timestamp: now,
          notes: `Branch updated to ${resolvedBranchName} by ${session.user.name}`
        }
      };
    }

    const updatedCustomer = await Customer.findOneAndUpdate(
      findQuery,
      updateData,
      { upsert: true, returnDocument: "after", runValidators: true }
    );

    if (!updatedCustomer) {
      throw new Error("Customer not found for update");
    }

    // Trigger branch reassignment telemetry + legacy events
    if (body.branchId !== undefined && oldBranchId !== newBranchId) {
      emitCustomerBranchUpdated({
        phone: updatedCustomer.phone,
        branchId: updatedCustomer.branchId ? updatedCustomer.branchId.toString() : null,
        branchName: resolvedBranchName,
        updatedBy: { id: session.user.id, name: session.user.name }
      }, updatedCustomer.branchId);
    }

    // Trigger general update / assign telemetry + legacy events
    emitCustomerUpdated({
      phone: updatedCustomer.phone,
      assignedTo: updatedCustomer.assignedTo || "Unassigned",
      status: updatedCustomer.status,
      name: updatedCustomer.name
    }, updatedCustomer.branchId);

    return {
      customer: updatedCustomer,
      branchName: resolvedBranchName,
      branchCode: resolvedBranchCode
    };
  }
};
