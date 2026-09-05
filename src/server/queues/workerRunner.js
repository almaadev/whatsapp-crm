import connectDB from "../../shared/lib/db/mongodb.js";
import { createInboundMessageWorker } from "./workers/inboundMessageWorker.js";
import { createAutomationWorker } from "./workers/automationWorker.js";
import { createNotificationWorker } from "./workers/notificationWorker.js";
import { createActivityWorker } from "./workers/activityWorker.js";
import { createCampaignWorker } from "./workers/campaignWorker.js";
import { closeQueues } from "./queueManager.js";

let workers = null;
let isShuttingDown = false;

export async function recoverPendingWebhookEvents() {
  try {
    const { default: WebhookEvent } = await import("../../shared/models/WebhookEvent.js");
    const { default: inboundMessageService } = await import("../services/inboundMessageService.js");
    const { runSerializedPerCustomer } = await import("./workers/inboundMessageWorker.js");

    const pendingEvents = await WebhookEvent.find({
      provider: "twilio",
      status: "queued",
    }).sort({ receivedAt: 1 }).limit(50);

    if (pendingEvents.length > 0) {
      console.log(`[WORKER-BOOT] Found ${pendingEvents.length} pending queued webhook events to drain...`);
      for (const ev of pendingEvents) {
        try {
          ev.status = "processing";
          await ev.save();

          const body = ev.payload || {};
          const twilioSid = ev.eventId || body.MessageSid || body.sid || "";
          const fromPhone = body.From || body.from || "";
          const rawTo = body.To || body.to || "";
          const messageText = (body.Body || body.body || "").replace(/\\n/g, "\n");
          let numMedia = parseInt(body.NumMedia || body.numMedia || "0", 10);
          if (isNaN(numMedia)) numMedia = 0;
          const profileName = body.ProfileName || body.profileName || "";

          if (fromPhone) {
            await runSerializedPerCustomer(fromPhone, async () => {
              return await inboundMessageService.handleInboundMessage({
                twilioSid,
                fromPhone,
                rawTo,
                messageText,
                numMedia,
                profileName,
                body,
              });
            });
          }

          ev.status = "completed";
          ev.processedAt = new Date();
          await ev.save();
          console.log(`[WORKER-BOOT] Drained pending event | eventId=${ev.eventId}`);
        } catch (drainErr) {
          console.error(`[WORKER-BOOT] Error draining event ${ev.eventId}:`, drainErr.message);
          ev.status = "failed";
          await ev.save().catch(() => {});
        }
      }
    }
  } catch (err) {
    console.warn("[WORKER-BOOT] Notice checking pending webhook events:", err.message);
  }
}

export async function startWorkerRunner() {
  if (workers) {
    return workers;
  }

  try {
    await connectDB();
  } catch (dbErr) {
    console.error("❌ [WORKER-BOOT] MongoDB connection failed:", dbErr.message);
  }

  console.log("[WORKER-BOOT] Initializing BullMQ workers (inbound-message, automation, notification, activity, campaign)...");

  try {
    workers = {
      inboundMessageWorker: createInboundMessageWorker(),
      automationWorker: createAutomationWorker(),
      notificationWorker: createNotificationWorker(),
      activityWorker: createActivityWorker(),
      campaignWorker: createCampaignWorker(),
    };

    console.log("[WORKER-BOOT] inbound-message worker started");
    console.log("[WORKER-BOOT] automation worker started");
    console.log("[WORKER-BOOT] notification worker started");
    console.log("[WORKER-BOOT] activity worker started");
    console.log("[WORKER-BOOT] campaign worker started");
    console.log("✅ [WORKER-BOOT] All BullMQ workers are active.");

    // Drain any pending unhandled webhook events in the background
    recoverPendingWebhookEvents().catch(() => {});

    // Schedule periodic 60-day media expiration cleanup
    import("../services/mediaCleanupService.js").then((m) => {
      m.mediaCleanupService.runCleanup().catch(() => {});
      // Run every 12 hours
      setInterval(() => {
        m.mediaCleanupService.runCleanup().catch(() => {});
      }, 12 * 60 * 60 * 1000);
    }).catch(() => {});

    return workers;
  } catch (err) {
    console.error("❌ [WORKER-BOOT] Failed to initialize BullMQ workers:", err.message);
    return null;
  }
}

export async function stopWorkerRunner() {
  if (isShuttingDown || !workers) return;
  isShuttingDown = true;
  console.log("🛑 [WorkerRunner] Gracefully shutting down BullMQ workers...");

  try {
    await Promise.all([
      workers.inboundMessageWorker?.close(),
      workers.automationWorker?.close(),
      workers.notificationWorker?.close(),
      workers.activityWorker?.close(),
      workers.campaignWorker?.close(),
      closeQueues(),
    ]);
    workers = null;
    console.log("✅ [WorkerRunner] All BullMQ workers closed.");
  } catch (err) {
    console.error("❌ [WorkerRunner] Error during worker shutdown:", err.message);
  }
}

process.on("SIGTERM", async () => {
  await stopWorkerRunner();
});

process.on("SIGINT", async () => {
  await stopWorkerRunner();
});
