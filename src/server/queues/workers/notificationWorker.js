import { Worker } from "bullmq";
import { QUEUE_NAMES, getRedisConnectionOptions } from "../queueManager.js";
import { notificationService } from "../../services/notificationService.js";
import connectDB from "../../../shared/lib/db/mongodb.js";

export function createNotificationWorker() {
  const connection = getRedisConnectionOptions();

  const worker = new Worker(
    QUEUE_NAMES.NOTIFICATION,
    async (job) => {
      await connectDB();
      const {
        phone,
        customerId,
        customerName,
        messageText,
        branchId,
        twilioSid,
        isNewChat,
      } = job.data;

      try {
        const notifications = await notificationService.processInboundNotification({
          phone,
          customerId,
          customerName,
          messageText,
          branchId,
          twilioSid,
          isNewChat: !!isNewChat,
        });

        return { success: true, count: notifications?.length || 0 };
      } catch (error) {
        console.error(
          `❌ [NotificationWorker] Error processing notifications | jobId=${job.id} | twilioSid=${twilioSid} | customerId=${customerId}:`,
          error.message
        );
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
      `❌ [NotificationWorker] Job failed | jobId=${job?.id} | twilioSid=${job?.data?.twilioSid}:`,
      err?.message
    );
  });

  return worker;
}

export default createNotificationWorker;
