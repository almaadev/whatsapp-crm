import nextEnv from "@next/env";
const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

import connectDB from "../src/shared/lib/db/mongodb.js";
import Customer from "../src/shared/models/Customer.js";
import Lead from "../src/shared/models/Lead.js";
import Message from "../src/shared/models/Message.js";
import WebhookEvent from "../src/shared/models/WebhookEvent.js";
import Notification from "../src/shared/models/Notification.js";
import Activity from "../src/shared/models/Activity.js";
import inboundMessageService from "../src/server/services/inboundMessageService.js";
import { POST as webhookPostHandler } from "../src/app/api/webhook/route.js";

function createMockTwilioRequest(body, headers = {}) {
  const urlEncoded = new URLSearchParams(body).toString();
  return new Request("http://localhost:3000/api/webhook", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-forwarded-proto": "https",
      "x-forwarded-host": "crm.almaaerp.in",
      ...headers,
    },
    body: urlEncoded,
  });
}

function calculateLatencyStats(latencies) {
  if (!latencies || latencies.length === 0) {
    return { min: 0, max: 0, average: 0, median: 0, p95: 0, p99: 0 };
  }
  const sorted = [...latencies].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  const average = sum / sorted.length;
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const median = sorted[Math.floor(sorted.length * 0.5)];
  const p95 = sorted[Math.min(Math.floor(sorted.length * 0.95), sorted.length - 1)];
  const p99 = sorted[Math.min(Math.floor(sorted.length * 0.99), sorted.length - 1)];

  return { min, max, average, median, p95, p99 };
}

async function runConcurrencyTest(concurrencyCount) {
  console.log(`\n--------------------------------------------------`);
  console.log(`🚀 RUNNING CONCURRENCY TEST: ${concurrencyCount} Concurrent Duplicate Requests`);
  console.log(`--------------------------------------------------`);

  const burstSid = `SM_burst_${concurrencyCount}_${Date.now()}`;
  const burstPhone = `whatsapp:+9198765${String(concurrencyCount).padStart(5, "0")}`;

  await WebhookEvent.deleteMany({ eventId: burstSid });
  await Customer.deleteMany({ phone: burstPhone });
  await Message.deleteMany({ twilioSid: burstSid });
  await Notification.deleteMany({ phone: burstPhone });
  await Activity.deleteMany({ "metadata.phone": burstPhone });

  const requests = Array.from({ length: concurrencyCount }, () =>
    createMockTwilioRequest({
      MessageSid: burstSid,
      From: burstPhone,
      To: "whatsapp:+917401403011",
      Body: `Concurrency Test ${concurrencyCount}`,
      NumMedia: "0",
      ProfileName: `Benchmark User ${concurrencyCount}`,
    })
  );

  const tBurstStart = performance.now();
  const responses = await Promise.all(
    requests.map(async (req) => {
      const tReqStart = performance.now();
      const res = await webhookPostHandler(req);
      const latency = performance.now() - tReqStart;
      return { status: res.status, latency };
    })
  );
  const totalBurstDuration = performance.now() - tBurstStart;

  const latencies = responses.map((r) => r.latency);
  const stats = calculateLatencyStats(latencies);
  const all200 = responses.every((r) => r.status === 200);

  if (!all200) {
    throw new Error(`[FAIL] Not all ${concurrencyCount} requests returned HTTP 200!`);
  }

  // Database verification
  const webhookEventCount = await WebhookEvent.countDocuments({ eventId: burstSid });
  if (webhookEventCount !== 1) {
    throw new Error(`[FAIL] Expected 1 WebhookEvent record, found ${webhookEventCount}`);
  }

  // Worker execution simulation
  const tWorkerStart = performance.now();
  const workerResult = await inboundMessageService.handleInboundMessage({
    twilioSid: burstSid,
    fromPhone: burstPhone,
    rawTo: "whatsapp:+917401403011",
    messageText: `Concurrency Test ${concurrencyCount}`,
    profileName: `Benchmark User ${concurrencyCount}`,
  });
  const workerDuration = performance.now() - tWorkerStart;

  // Verify service-level idempotency on duplicate worker execution
  const duplicateWorkerResult = await inboundMessageService.handleInboundMessage({
    twilioSid: burstSid,
    fromPhone: burstPhone,
    rawTo: "whatsapp:+917401403011",
    messageText: `Concurrency Test ${concurrencyCount}`,
    profileName: `Benchmark User ${concurrencyCount}`,
  });
  if (!duplicateWorkerResult.duplicate) {
    throw new Error(`[FAIL] Duplicate worker call was not caught as duplicate!`);
  }

  const customerCount = await Customer.countDocuments({ phone: burstPhone });
  if (customerCount !== 1) throw new Error(`[FAIL] Expected 1 Customer, found ${customerCount}`);

  const customer = await Customer.findOne({ phone: burstPhone });
  const leadCount = await Lead.countDocuments({ customerId: customer._id });
  if (leadCount !== 1) throw new Error(`[FAIL] Expected 1 Lead, found ${leadCount}`);

  const messageCount = await Message.countDocuments({ twilioSid: burstSid });
  if (messageCount !== 1) throw new Error(`[FAIL] Expected 1 Message, found ${messageCount}`);

  console.log(`⏱️ Total Burst Duration: ${totalBurstDuration.toFixed(2)} ms`);
  console.log(`📊 Ingestion Latency Stats across ${concurrencyCount} requests:`);
  console.log(`   - Target: < 20.00 ms`);
  console.log(`   - Observed Average: ${stats.average.toFixed(2)} ms`);
  console.log(`   - Observed Median:  ${stats.median.toFixed(2)} ms`);
  console.log(`   - Observed Min:     ${stats.min.toFixed(2)} ms`);
  console.log(`   - Observed Max:     ${stats.max.toFixed(2)} ms`);
  console.log(`   - Observed p95:     ${stats.p95.toFixed(2)} ms`);
  console.log(`   - Observed p99:     ${stats.p99.toFixed(2)} ms`);
  console.log(`⚙️ InboundMessageWorker Execution Time: ${workerDuration.toFixed(2)} ms`);
  console.log(`✅ State Verification: WebhookEvent=1, Customer=1, Lead=1, Message=1`);

  return { concurrencyCount, totalBurstDuration, stats, workerDuration };
}

async function runBenchmark() {
  console.log("\n==================================================");
  console.log("⚡ PRODUCTION-READINESS PERFORMANCE & IDEMPOTENCY AUDIT");
  console.log("==================================================");

  await connectDB();
  process.env.TWILIO_VALIDATE_SIGNATURE = "false";

  const results = [];
  results.push(await runConcurrencyTest(10));
  results.push(await runConcurrencyTest(50));
  results.push(await runConcurrencyTest(100));

  console.log("\n==================================================");
  console.log("🏆 SUMMARY OF ALL IDEMPOTENCY & LATENCY AUDITS");
  console.log("==================================================");
  results.forEach((r) => {
    console.log(`\n🔹 ${r.concurrencyCount} Concurrent Requests:`);
    console.log(`   - Total Burst Time: ${r.totalBurstDuration.toFixed(2)} ms`);
    console.log(`   - Average Latency:  ${r.stats.average.toFixed(2)} ms`);
    console.log(`   - Median Latency:   ${r.stats.median.toFixed(2)} ms`);
    console.log(`   - p95 Latency:      ${r.stats.p95.toFixed(2)} ms`);
    console.log(`   - Max Latency:      ${r.stats.max.toFixed(2)} ms`);
  });

  // Test data isolation cleanup
  const testPhones = [10, 50, 100].map((c) => `whatsapp:+9198765${String(c).padStart(5, "0")}`);
  await Customer.deleteMany({ phone: { $in: testPhones } });
  await Message.deleteMany({ phone: { $in: testPhones } });
  await WebhookEvent.deleteMany({ eventId: { $regex: "^SM_burst_" } });
  console.log("\n🧹 Test data cleaned up successfully.");

  console.log("\n==================================================\n");
  process.exit(0);
}

runBenchmark().catch((err) => {
  console.error("Benchmark Error:", err);
  process.exit(1);
});
