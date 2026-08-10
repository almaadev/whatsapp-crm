import fs from "fs";
import path from "path";
import mongoose from "mongoose";

// Helper to load env files manually
function loadEnv() {
  const envPaths = [path.resolve(".env"), path.resolve(".env.local")];
  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf-8");
      content.split("\n").forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
          const firstEqual = trimmed.indexOf("=");
          const key = trimmed.substring(0, firstEqual).trim();
          let val = trimmed.substring(firstEqual + 1).trim();
          if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
          if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
          process.env[key] = val;
        }
      });
    }
  }
}

// Execute environment loading BEFORE any database imports
loadEnv();

// Now dynamically import connectDB after process.env.MONGODB_URI is populated
const { default: connectDB } = await import("../src/shared/lib/db/mongodb.js");

const backupDir = "C:\\Users\\PC\\.gemini\\antigravity-ide\\brain\\c68b7247-95ce-4065-a15f-b7d1b9a9c071\\scratch";
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

async function run() {
  console.log("Connecting to database...");
  await connectDB();
  const db = mongoose.connection.db;

  console.log("Backing up existing Customer and Lead data...");
  const rawCustomers = await db.collection("customers").find({}).toArray();
  const rawLeads = await db.collection("leads").find({}).toArray();

  fs.writeFileSync(path.join(backupDir, "customers_backup.json"), JSON.stringify(rawCustomers, null, 2));
  fs.writeFileSync(path.join(backupDir, "leads_backup.json"), JSON.stringify(rawLeads, null, 2));
  console.log(`Backups saved to JSON files under scratch dir. Customer count: ${rawCustomers.length}, Lead count: ${rawLeads.length}`);

  // Create database backup collections just in case
  await db.collection("customers_backup_refactor").drop().catch(() => {});
  await db.collection("leads_backup_refactor").drop().catch(() => {});
  if (rawCustomers.length > 0) {
    await db.collection("customers_backup_refactor").insertMany(rawCustomers);
  }
  if (rawLeads.length > 0) {
    await db.collection("leads_backup_refactor").insertMany(rawLeads);
  }
  console.log("Database backup collections created: customers_backup_refactor, leads_backup_refactor.");

  // Clear new collections if they existed (fresh start)
  await db.collection("customeraddresses").deleteMany({});
  await db.collection("activities").deleteMany({});

  console.log("Starting normalization migration...");

  // 1. Migrate Customers & create CustomerAddress / Activities
  for (const cust of rawCustomers) {
    const customerId = cust._id;

    // Create CustomerAddress
    const addressId = new mongoose.Types.ObjectId();
    await db.collection("customeraddresses").insertOne({
      _id: addressId,
      customerId,
      city: cust.city || "",
      district: "",
      state: "",
      pincode: "",
      address: cust.address || "",
      landmark: "",
      isCurrent: true,
      validFrom: cust.createdAt || new Date(),
      createdBy: cust.createdBy ? new mongoose.Types.ObjectId(cust.createdBy) : null,
      createdAt: cust.createdAt || new Date(),
      updatedAt: cust.updatedAt || new Date()
    });

    // Migrate chatHistory to Activities
    const activities = [];
    if (cust.chatHistory && Array.isArray(cust.chatHistory)) {
      for (const hist of cust.chatHistory) {
        let actorId = null;
        if (hist.performedBy && mongoose.Types.ObjectId.isValid(hist.performedBy)) {
          actorId = new mongoose.Types.ObjectId(hist.performedBy);
        } else if (hist.performedById && mongoose.Types.ObjectId.isValid(hist.performedById)) {
          actorId = new mongoose.Types.ObjectId(hist.performedById);
        }

        // Map eventType
        let mappedType = "PROFILE_UPDATED";
        const actionText = (hist.action || "").toLowerCase();
        if (actionText.includes("started") || actionText.includes("created")) mappedType = "LEAD_CREATED";
        else if (actionText.includes("follow up") || actionText.includes("followup")) mappedType = "FOLLOWUP_ADDED";
        else if (actionText.includes("closed")) mappedType = "LEAD_CLOSED";
        else if (actionText.includes("reopened")) mappedType = "LEAD_REOPENED";
        else if (actionText.includes("assigned")) mappedType = "ASSIGNED";
        else if (actionText.includes("branch")) mappedType = "PROFILE_UPDATED";
        else if (actionText.includes("address") || actionText.includes("location")) mappedType = "ADDRESS_CHANGED";

        activities.push({
          customerId,
          actorId,
          eventType: mappedType,
          before: {},
          after: {},
          metadata: {
            action: hist.action,
            notes: hist.notes,
            performedByName: hist.performedByName,
            performedByRole: hist.performedByRole,
            isInternal: !!hist.isInternal,
            targetUser: hist.targetUser ? new mongoose.Types.ObjectId(hist.targetUser) : null
          },
          createdAt: hist.performedAt || hist.timestamp || new Date(),
          updatedAt: hist.performedAt || hist.timestamp || new Date()
        });
      }
    }

    if (activities.length > 0) {
      await db.collection("activities").insertMany(activities);
    }

    // Update customer reference
    await db.collection("customers").updateOne(
      { _id: customerId },
      { $set: { currentAddressId: addressId } }
    );
  }
  console.log("Customer addresses and activities populated.");

  // Helper function to standardise phone string
  const cleanNumber = (num) => num.replace(/\D/g, "");

  // 2. Migrate Leads & link with Customers
  for (const lead of rawLeads) {
    const leadPhone = lead.phone || "";
    const cleanLeadPhone = cleanNumber(leadPhone);

    // Find customer by phone variations
    let customerDoc = await db.collection("customers").findOne({
      phone: { $regex: cleanLeadPhone }
    });

    if (!customerDoc) {
      // Try finding by prefix variations
      const variations = [cleanLeadPhone, `whatsapp:${cleanLeadPhone}`, `+${cleanLeadPhone}`];
      if (cleanLeadPhone.length === 10) {
        variations.push(`91${cleanLeadPhone}`);
        variations.push(`whatsapp:91${cleanLeadPhone}`);
      } else if (cleanLeadPhone.startsWith("91") && cleanLeadPhone.length === 12) {
        variations.push(cleanLeadPhone.substring(2));
      }
      customerDoc = await db.collection("customers").findOne({
        phone: { $in: variations }
      });
    }

    let customerId;
    if (customerDoc) {
      customerId = customerDoc._id;
    } else {
      // Create new customer for orphaned lead to prevent data loss
      const newCustId = new mongoose.Types.ObjectId();
      const addressId = new mongoose.Types.ObjectId();
      await db.collection("customers").insertOne({
        _id: newCustId,
        phone: leadPhone.startsWith("whatsapp:") ? leadPhone : `whatsapp:${cleanLeadPhone}`,
        name: lead.name || "Unknown",
        currentAddressId: addressId,
        createdBy: lead.associateId ? new mongoose.Types.ObjectId(lead.associateId) : null,
        createdAt: lead.createdAt || new Date(),
        updatedAt: lead.updatedAt || new Date()
      });
      await db.collection("customeraddresses").insertOne({
        _id: addressId,
        customerId: newCustId,
        city: lead.city || "",
        address: lead.address || "",
        isCurrent: true,
        createdAt: lead.createdAt || new Date(),
        updatedAt: lead.updatedAt || new Date()
      });
      customerId = newCustId;
      console.log(`Created orphaned customer link for lead phone: ${leadPhone}`);
    }

    // Update Lead to point to Customer
    await db.collection("leads").updateOne(
      { _id: lead._id },
      { 
        $set: { customerId },
        $unset: { phone: "", name: "", city: "", address: "", source: "" }
      }
    );

    // Update Customer with activeLeadId
    await db.collection("customers").updateOne(
      { _id: customerId },
      { $set: { activeLeadId: lead._id } }
    );
  }
  console.log("Leads linked to customers and duplicated fields removed.");

  console.log("Migration complete! Validating...");
  const migratedAddressCount = await db.collection("customeraddresses").countDocuments();
  const migratedActivityCount = await db.collection("activities").countDocuments();
  const totalLeadsWithCustomerId = await db.collection("leads").countDocuments({ customerId: { $exists: true } });

  console.log(`Validation results:`);
  console.log(`- Total Addresses Created: ${migratedAddressCount}`);
  console.log(`- Total Activities Created: ${migratedActivityCount}`);
  console.log(`- Leads with Customer Links: ${totalLeadsWithCustomerId}`);

  await mongoose.disconnect();
  console.log("Database disconnected successfully.");
}

run().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});
