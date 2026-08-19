import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());

import connectDB from "../src/shared/lib/db/mongodb.js";
import Customer from "../src/shared/models/Customer.js";

async function main() {
  await connectDB();

  console.log("=== CHECKING CUSTOMERS IN MONGO ===");
  const allCustomers = await Customer.find().select("name phone createdAt isClosed").lean();
  console.log(`Total customers in DB: ${allCustomers.length}`);
  
  const testCustomers = [];
  const realCustomers = [];

  for (const c of allCustomers) {
    if (
      c.phone?.startsWith("whatsapp:+919876") ||
      c.name?.includes("User") ||
      c.name?.includes("Test") ||
      c.name?.includes("Burst") ||
      c.name?.includes("Hardening")
    ) {
      testCustomers.push(c);
    } else {
      realCustomers.push(c);
    }
  }

  console.log(`\nReal Customer count: ${realCustomers.length}`);
  for (const r of realCustomers) {
    console.log(`- [REAL] ID: ${r._id} | Name: "${r.name}" | Phone: ${r.phone}`);
  }

  console.log(`\nTest Customer count: ${testCustomers.length}`);
  for (const t of testCustomers) {
    console.log(`- [TEST] ID: ${t._id} | Name: "${t.name}" | Phone: ${t.phone}`);
  }

  process.exit(0);
}

main().catch(err => {
  console.error("Diagnosis error:", err);
  process.exit(1);
});
