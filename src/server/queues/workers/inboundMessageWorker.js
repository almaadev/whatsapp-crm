import { Worker, UnrecoverableError } from "bullmq";
import { QUEUE_NAMES, getRedisConnectionOptions } from "../queueManager.js";
import inboundMessageService from "../../services/inboundMessageService.js";
import WebhookEvent from "../../../shared/models/WebhookEvent.js";
import connectDB from "../../../shared/lib/db/mongodb.js";

// Per-customer serialization queue to guarantee chronological ordering per customer
const customerProcessingQueues = new Map();

export async function runSerializedPerCustomer(phoneKey, task) {
  if (!phoneKey) return task();

  const previousTask = customerProcessingQueues.get(phoneKey) || Promise.resolve();
  const currentTask = previousTask
    .catch(() => {})
    .then(() => task())
    .finally(() => {
      if (customerProcessingQueues.get(phoneKey) === currentTask) {
        customerProcessingQueues.delete(phoneKey);
      }
    });

  customerProcessingQueues.set(phoneKey, currentTask);
  return currentTask;
}

export function createInboundMessageWorker() {
  const connection = getRedisConnectionOptions();

  const worker = new Worker(
    QUEUE_NAMES.INBOUND_MESSAGE,
    async (job) => {
      await connectDB();
      const { twilioSid, fromPhone } = job.data;
      console.log(`[INBOUND-WORKER] job received | jobId=${job.id} | twilioSid=${twilioSid} | phone=${fromPhone}`);

      // Update WebhookEvent to processing
      if (twilioSid) {
        await WebhookEvent.updateOne(
          { provider: "twilio", eventId: twilioSid },
          { $set: { status: "processing" } }
        ).catch(() => {});
      }

      try {
        const result = await runSerializedPerCustomer(fromPhone, async () => {
          return await inboundMessageService.handleInboundMessage(job.data);
        });

        // Update WebhookEvent status
        if (twilioSid) {
          if (result && result.partial) {
            await WebhookEvent.updateOne(
              { provider: "twilio", eventId: twilioSid },
              { $set: { status: "partially_failed", error: result.leadError || "Lead enrichment failed", processedAt: new Date() } }
            ).catch(() => {});
          } else {
            await WebhookEvent.updateOne(
              { provider: "twilio", eventId: twilioSid },
              { $set: { status: "completed", processedAt: new Date() } }
            ).catch(() => {});
          }
        }

        console.log(`[INBOUND-WORKER] job completed | jobId=${job.id} | twilioSid=${twilioSid}`);
        return result;
      } catch (error) {
        console.error(
          `❌ [INBOUND-WORKER] job failed | jobId=${job.id} | twilioSid=${twilioSid} | attempt=${job.attemptsMade}:`,
          error.message
        );

        if (twilioSid) {
          await WebhookEvent.updateOne(
            { provider: "twilio", eventId: twilioSid },
            { $set: { status: "failed", error: error.message } }
          ).catch(() => {});
        }

        const isDeterministic =
          error.code === 11000 ||
          error.name === "ValidationError" ||
          error.name === "CastError" ||
          error.message?.includes("E11000") ||
          error.isDeterministic === true;

        if (isDeterministic) {
          console.error(
            `🛑 [INBOUND-WORKER] Deterministic error detected for jobId=${job.id} | twilioSid=${twilioSid}. Halting BullMQ retries:`,
            error.message
          );
          throw new UnrecoverableError(error.message);
        }

        throw error;
      }
    },
    {
      connection,
      concurrency: 5,
    }
  );

  worker.on("error", () => {
    // Suppress unhandled EventEmitter errors when Redis is offline in dev
  });

  worker.on("failed", (job, err) => {
    console.error(
      `❌ [InboundMessageWorker] Job permanently failed or queued for retry | jobId=${job?.id} | twilioSid=${job?.data?.twilioSid} | attempts=${job?.attemptsMade}:`,
      err?.message
    );
  });

  return worker;
}

export default createInboundMessageWorker;
