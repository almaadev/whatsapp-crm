import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());

import connectDB from "../src/shared/lib/db/mongodb.js";
import WebhookEvent from "../src/shared/models/WebhookEvent.js";
import Message from "../src/shared/models/Message.js";
import { recoverPendingWebhookEvents } from "../src/server/queues/workerRunner.js";

async function main() {
  await connectDB();
  
  const realSids = [
    "SMb9d5af790846decb4fbe36df2ab8036a",
    "SM0e0319eb7b0e1cd518ea4b22ecd0aad7",
    "SMd96557cada473b43cde3d7372f6bbffc",
  ];

  await WebhookEvent.updateMany(
    { eventId: { $in: realSids } },
    { $set: { status: "queued" } }
  );

  console.log("Reset real events to queued. Running recoverPendingWebhookEvents()...");
  await recoverPendingWebhookEvents();

  console.log("\nChecking saved Messages in MongoDB:");
  const msgs = await Message.find({ twilioSid: { $in: realSids } }).lean();
  for (const m of msgs) {
    console.log(`- Saved Message: Sid=${m.twilioSid} | Phone=${m.phone} | Text="${m.message}" | Dir=${m.direction}`);
  }

  process.exit(0);
}

main().catch(err => {
  console.error("Drain script error:", err);
  process.exit(1);
});
