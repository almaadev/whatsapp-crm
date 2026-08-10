import Customer from "@/shared/models/Customer";
import Branch from "@/shared/models/Branch";
import User from "@/shared/models/User";
import CustomerAddress from "@/shared/models/CustomerAddress";
import Lead from "@/shared/models/Lead";
import { activityService } from "@/server/services/activityService";
import { ActivityEvents, ActivitySources } from "@/shared/constants/activityConstants";
import { 
  emitCustomerBranchUpdated,
  emitCustomerUpdated
} from "@/shared/utils/socketPublisher";
import { normalizePhone } from "@/shared/utils/phoneUtils";

export const serverCustomerService = {
  async updateCustomer(phone, body, session) {
    const canonicalPhone = normalizePhone(phone);
    if (!canonicalPhone) {
      throw new Error("Phone number is required and must be valid.");
    }

    const { getBranchFilterForUser } = await import("@/shared/utils/serverAuth");
    const { branchQuery } = await getBranchFilterForUser(session);

    // Safe legacy phone lookup:
    // 1. Search canonical phone
    // 2. If not found, search legacy representations
    let existingCustomer = await Customer.findOne({ phone: canonicalPhone }).lean();
    if (!existingCustomer) {
      const cleanDigits = canonicalPhone.replace("whatsapp:", "").replace("+", "");
      const tenDigit = cleanDigits.substring(cleanDigits.length - 10);
      const variations = [
        `whatsapp:${cleanDigits}`,
        `whatsapp:+${cleanDigits}`,
        `+${cleanDigits}`,
        cleanDigits,
        `whatsapp:${tenDigit}`,
        `whatsapp:+${tenDigit}`,
        `+${tenDigit}`,
        tenDigit
      ];
      
      const findQuery = { phone: { $in: variations } };
      if (session?.user?.role !== "superAdmin" && branchQuery?.branchId) {
        findQuery.$or = [
          branchQuery,
          { branchId: null },
          { branchId: { $exists: false } }
        ];
      }
      existingCustomer = await Customer.findOne(findQuery).lean();
    } else {
      // Check branch permissions even if found by canonical
      if (session?.user?.role !== "superAdmin" && branchQuery?.branchId) {
        const hasAccess = !existingCustomer.branchId || 
                          existingCustomer.branchId.toString() === branchQuery.branchId.toString();
        if (!hasAccess) {
          throw new Error("Access Denied: Customer belongs to another branch.");
        }
      }
    }

    // Resolve branch details if branchId is provided
    let resolvedBranchName = "Unassigned Branch";
    let resolvedBranchCode = "";
    let resolvedBranchId = undefined;

    if (body.branchId !== undefined) {
      if (body.branchId) {
        const branchDoc = await Branch.findOne({ _id: body.branchId, status: "active" }).lean();
        if (!branchDoc) {
          throw new Error("Invalid or inactive branch selected.");
        }
        resolvedBranchId = body.branchId;
        resolvedBranchName = branchDoc.name;
        resolvedBranchCode = branchDoc.code || "";
      } else {
        resolvedBranchId = null;
      }
    }

    const oldBranchId = existingCustomer?.branchId ? existingCustomer.branchId.toString() : null;
    const newBranchId = body.branchId ? body.branchId.toString() : null;

    // Resolve Owner/Associate fields
    let assignedUserId = undefined;
    let assignedTo = undefined;
    if (body.associate !== undefined || body.assignedTo !== undefined) {
      const assignedName = body.associate || body.assignedTo;
      if (assignedName && assignedName !== "unassigned" && assignedName !== "Unassigned") {
        const userDoc = await User.findOne({ name: assignedName }).lean();
        if (userDoc) {
          assignedUserId = userDoc._id;
          assignedTo = userDoc.name;
        } else {
          assignedTo = assignedName;
        }
      } else {
        assignedUserId = null;
        assignedTo = "unassigned";
      }
    }

    // Construct customer set payload
    const setPayload = {
      updatedAt: new Date()
    };
    if (body.name?.trim() !== undefined) setPayload.name = body.name.trim();
    if (body.source?.trim() !== undefined) setPayload.source = body.source.trim();
    if (body.enquiredFor?.trim() !== undefined) setPayload.enquiredFor = body.enquiredFor.trim();
    if (body.status?.trim() !== undefined) setPayload.status = body.status.trim();
    if (body.saleAmount !== undefined) setPayload.saleAmount = body.saleAmount.toString();
    if (body.remarks?.trim() !== undefined) setPayload.remarks = body.remarks.trim();
    if (resolvedBranchId !== undefined) setPayload.branchId = resolvedBranchId;
    if (body.assignedTwilioNumber !== undefined) setPayload.assignedTwilioNumber = body.assignedTwilioNumber || null;
    if (assignedUserId !== undefined) setPayload.assignedUserId = assignedUserId;
    if (assignedTo !== undefined) setPayload.assignedTo = assignedTo;

    let customerDoc;
    let isNewCustomer = false;

    if (!existingCustomer) {
      isNewCustomer = true;
      customerDoc = new Customer({
        phone: canonicalPhone,
        createdBy: session.user.id,
        isClosed: true,
        ...setPayload
      });
      await customerDoc.save();
    } else {
      customerDoc = await Customer.findById(existingCustomer._id);
      Object.assign(customerDoc, setPayload);
      await customerDoc.save();
    }

    // Handle Address change checks and updates
    const incomingAddress = body.address?.trim() !== undefined ? body.address.trim() : null;
    const incomingCity = body.city?.trim() !== undefined ? body.city.trim() : null;

    const currentAddress = !isNewCustomer 
      ? await CustomerAddress.findOne({ customerId: customerDoc._id, isCurrent: true })
      : null;

    const addressChanged = isNewCustomer || 
      (incomingAddress !== null && incomingAddress !== (currentAddress?.address || "")) ||
      (incomingCity !== null && incomingCity !== (currentAddress?.city || ""));

    if (addressChanged) {
      // Create new address
      const newAddress = await CustomerAddress.create({
        customerId: customerDoc._id,
        city: incomingCity !== null ? incomingCity : (currentAddress?.city || ""),
        address: incomingAddress !== null ? incomingAddress : (currentAddress?.address || ""),
        isCurrent: true,
        validFrom: new Date(),
        createdBy: session.user.id
      });

      // Mark other addresses as not current
      if (!isNewCustomer) {
        await CustomerAddress.updateMany(
          { customerId: customerDoc._id, _id: { $ne: newAddress._id } },
          { $set: { isCurrent: false, validTo: new Date() } }
        );
      }

      // Link to Customer
      customerDoc.currentAddressId = newAddress._id;
      await customerDoc.save();
      
      // Log activity
      // await Activity.create({
      //   customerId: customerDoc._id,
      //   actorId: session.user.id,
      //   eventType: "ADDRESS_CHANGED",
      //   before: currentAddress ? { address: currentAddress.address, city: currentAddress.city } : {},
      //   after: { address: newAddress.address, city: newAddress.city },
      //   metadata: {
      //     action: "Address Changed",
      //     notes: isNewCustomer ? "Initial address recorded" : `Address updated to ${newAddress.address}, ${newAddress.city}`
      //   }
      // });
    }

    // Log Branch Reassignment Activity
    if (body.branchId !== undefined && oldBranchId !== newBranchId) {
      await activityService.log({
        eventType: ActivityEvents.CUSTOMER_UPDATED,
        entityType: "Customer",
        entityId: customerDoc._id,
        customerId: customerDoc._id,
        actorId: session.user.id,
        source: ActivitySources.WEB,
        metadata: {
          notes: `Branch updated to ${resolvedBranchName} by ${session.user.name}`
        }
      });

      emitCustomerBranchUpdated({
        phone: customerDoc.phone,
        branchId: customerDoc.branchId ? customerDoc.branchId.toString() : null,
        branchName: resolvedBranchName,
        updatedBy: { id: session.user.id, name: session.user.name }
      }, customerDoc.branchId);
    }

    // Log priority / status / owner change Activities
    if (!isNewCustomer && existingCustomer) {
      if (body.status !== undefined && existingCustomer.status !== body.status) {
        await activityService.log({
          eventType: ActivityEvents.LEAD_STATUS_CHANGED,
          entityType: "Customer",
          customerId: customerDoc._id,
          actorId: session.user.id,
          source: ActivitySources.WEB,
          metadata: {
            oldStatus: existingCustomer.status,
            newStatus: body.status,
            notes: body.remarks || `Status changed to ${body.status}`
          }
        });
      }

      if (body.priority !== undefined && existingCustomer.priority !== body.priority) {
        await activityService.log({
          eventType: ActivityEvents.CUSTOMER_UPDATED,
          entityType: "Customer",
          customerId: customerDoc._id,
          actorId: session.user.id,
          source: ActivitySources.WEB,
          metadata: {
            notes: `Priority changed from ${existingCustomer.priority || "Medium"} to ${body.priority}`
          }
        });
      }

      if (assignedTo !== undefined && existingCustomer.assignedTo !== assignedTo) {
        await activityService.log({
          eventType: ActivityEvents.LEAD_ASSIGNED,
          entityType: "Lead",
          customerId: customerDoc._id,
          actorId: session.user.id,
          source: ActivitySources.WEB,
          metadata: {
            oldOwner: existingCustomer.assignedTo,
            newOwner: assignedTo,
            notes: `Reassigned to ${assignedTo}`
          }
        });
      }
    } else if (isNewCustomer) {
      // Create corresponding Lead
      const lead = new Lead({
        customerId: customerDoc._id,
        assignedTo: customerDoc.assignedTo || "unassigned",
        associateId: customerDoc.assignedUserId || "",
        isClosed: false,
        leads: [{
          date: new Date(),
          enquiredFor: customerDoc.enquiredFor || "",
          associateId: customerDoc.assignedUserId || "",
          associateName: customerDoc.assignedTo || "unassigned",
          priority: customerDoc.priority || "Medium",
          status: customerDoc.status || "New",
          leadType: "Direct Lead",
          overAllRemarks: "Customer record manually created by associate"
        }]
      });
      await lead.save();

      customerDoc.activeLeadId = lead._id;
      await customerDoc.save();

      // Log CUSTOMER_CREATED
      await activityService.log({
        eventType: ActivityEvents.CUSTOMER_CREATED,
        entityType: "Customer",
        entityId: customerDoc._id,
        customerId: customerDoc._id,
        actorId: session.user.id,
        source: ActivitySources.WEB,
        metadata: {
          notes: `Customer record manually created by ${session.user.name}`
        }
      });

      // Log LEAD_CREATED
      await activityService.log({
        eventType: ActivityEvents.LEAD_CREATED,
        entityType: "Lead",
        entityId: lead._id,
        customerId: customerDoc._id,
        leadId: lead._id,
        actorId: session.user.id,
        source: ActivitySources.WEB,
        metadata: {
          notes: `Lead record manually created by ${session.user.name}`
        }
      });
    }

    // Trigger general update / assign telemetry + legacy events
    emitCustomerUpdated({
      phone: customerDoc.phone,
      assignedTo: customerDoc.assignedTo || "Unassigned",
      status: customerDoc.status,
      name: customerDoc.name
    }, customerDoc.branchId);

    // Fetch the updated document with address populated to return it fully
    const finalCustomer = await Customer.findById(customerDoc._id).populate("currentAddressId").lean();

    return {
      customer: finalCustomer,
      branchName: resolvedBranchName,
      branchCode: resolvedBranchCode
    };
  }
};
