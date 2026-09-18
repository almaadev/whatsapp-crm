import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());

import connectDB from "../src/shared/lib/db/mongodb.js";
import Customer from "../src/shared/models/Customer.js";
import Lead from "../src/shared/models/Lead.js";
import Message from "../src/shared/models/Message.js";
import WebhookEvent from "../src/shared/models/WebhookEvent.js";
import { startWorkerRunner, stopWorkerRunner, recoverPendingWebhookEvents } from "../src/server/queues/workerRunner.js";
import { inboundMessageQueue } from "../src/server/queues/queueManager.js";

async function runProductionValidation() {
  console.log("==================================================");
  console.log("🚀 PRODUCTION RUNTIME VALIDATION SUITE");
  console.log("==================================================\n");

  await connectDB();
  console.log("✅ [1/6] MongoDB Connection Verified");

  const testPhone = "whatsapp:+919876543210";
  const testSid = `SM_prod_val_${Date.now()}`;

  // Clean any old test artifacts
  await Customer.deleteMany({ phone: testPhone });
  await Message.deleteMany({ phone: testPhone });
  await WebhookEvent.deleteMany({ eventId: testSid });

  // 1. Initialize WorkerRunner
  console.log("⏳ [2/6] Initializing WorkerRunner...");
  const workers = await startWorkerRunner();
  if (!workers) {
    throw new Error("WorkerRunner failed to initialize!");
  }
  console.log("✅ [2/6] WorkerRunner initialized with workers:", Object.keys(workers));

  // 2. Test WebhookEvent Queued state
  console.log("⏳ [3/6] Simulating Webhook Ingestion & WebhookEvent creation...");
  const webhookEv = await WebhookEvent.create({
    provider: "twilio",
    eventId: testSid,
    eventType: "inbound_whatsapp",
    payload: {
      MessageSid: testSid,
      From: testPhone,
      To: "whatsapp:+917401403011",
      Body: "Production Validation Test Message",
      ProfileName: "Production Test Customer",
    },
    status: "queued",
    receivedAt: new Date(),
  });
  console.log(`✅ [3/6] WebhookEvent created with status: ${webhookEv.status}`);

  // 3. Enqueue job into BullMQ
  console.log("⏳ [4/6] Enqueuing inbound job to BullMQ queue...");
  await inboundMessageQueue.add(
    "process-inbound",
    {
      twilioSid: testSid,
      fromPhone: testPhone,
      rawTo: "whatsapp:+917401403011",
      messageText: "Production Validation Test Message",
      profileName: "Production Test Customer",
      body: webhookEv.payload,
    },
    { jobId: `inbound-msg_${testSid}` }
  );
  console.log("✅ [4/6] Inbound job enqueued successfully");

  // 4. Wait for worker processing
  console.log("⏳ [5/6] Waiting for WorkerRunner to process the job...");
  let attempts = 0;
  let processed = false;
  while (attempts < 20) {
    await new Promise((r) => setTimeout(r, 500));
    const msg = await Message.findOne({ twilioSid: testSid }).lean();
    const ev = await WebhookEvent.findOne({ eventId: testSid }).lean();
    if (msg && ev && ev.status === "completed") {
      processed = true;
      console.log(`✅ [5/6] Job consumed & processed! Message ID: ${msg._id}, Event Status: ${ev.status}`);
      break;
    }
    attempts++;
  }

  if (!processed) {
    // Check if recovery worker can drain
    console.log("⏳ Draining via recoverPendingWebhookEvents...");
    await recoverPendingWebhookEvents();
    const msg = await Message.findOne({ twilioSid: testSid }).lean();
    if (msg) {
      processed = true;
      console.log(`✅ [5/6] Recovered & processed! Message ID: ${msg._id}`);
    }
  }

  if (!processed) {
    throw new Error("Worker processing timed out!");
  }

  // 5. Verify Persistence & State
  console.log("⏳ [6/6] Verifying MongoDB persistence & relations...");
  const savedCustomer = await Customer.findOne({ phone: testPhone }).lean();
  const savedLead = await Lead.findOne({ customerId: savedCustomer?._id }).lean();
  const savedMsg = await Message.findOne({ twilioSid: testSid }).lean();

  if (!savedCustomer) throw new Error("Customer was not persisted!");
  if (!savedLead) throw new Error("Lead was not persisted!");
  if (!savedMsg || savedMsg.direction !== "INBOUND") throw new Error("Inbound Message was not persisted!");

  console.log(`✅ [6/6] Verified Customer (${savedCustomer._id}), Lead (${savedLead._id}), Message (${savedMsg._id})`);

  // Cleanup
  await Customer.deleteMany({ phone: testPhone });
  await Message.deleteMany({ phone: testPhone });
  await WebhookEvent.deleteMany({ eventId: testSid });

  // Graceful shutdown
  await stopWorkerRunner();
  console.log("✅ WorkerRunner gracefully stopped.");

  console.log("\n==================================================");
  console.log("🎉 PRODUCTION RUNTIME VALIDATION PASSED (100%)");
  console.log("==================================================");
  process.exit(0);
}

runProductionValidation().catch((err) => {
  console.error("❌ Validation Failed:", err);
  process.exit(1);
});
