import { Worker } from "bullmq";
import { QUEUE_NAMES, getRedisConnectionOptions } from "../queueManager.js";
import { processKeywordAutoReply } from "../../../features/chat/services/keywordMatcher.js";
import connectDB from "../../../shared/lib/db/mongodb.js";

export function createAutomationWorker() {
  const connection = getRedisConnectionOptions();

  const worker = new Worker(
    QUEUE_NAMES.AUTOMATION,
    async (job) => {
      await connectDB();
      const { phone, messageText, profileName, receivedOnNumber, messageSid } = job.data;

      if (!phone || !messageText) {
        return { skipped: true, reason: "Missing phone or message text" };
      }

      try {
        const matched = await processKeywordAutoReply(
          phone,
          messageText,
          profileName,
          receivedOnNumber,
          { inboundMessageSid: messageSid }
        );

        return { success: true, matched: !!matched };
      } catch (error) {
        console.error(
          `❌ [AutomationWorker] Automation error | jobId=${job.id} | messageSid=${messageSid} | phone=${phone}:`,
          error.message
        );
        // Do not fail/crash parent pipeline; throw only if network/transient error that benefits from BullMQ retry
        if (error.code === "ECONNRESET" || error.code === "ETIMEDOUT") {
          throw error;
        }
        return { success: false, error: error.message };
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
      `❌ [AutomationWorker] Job failed | jobId=${job?.id} | messageSid=${job?.data?.messageSid}:`,
      err?.message
    );
  });

  return worker;
}

export default createAutomationWorker;
