import { Worker } from "bullmq";
import { QUEUE_NAMES, getRedisConnectionOptions } from "../queueManager.js";
import { activityService } from "../../services/activityService.js";
import connectDB from "../../../shared/lib/db/mongodb.js";

export function createActivityWorker() {
  const connection = getRedisConnectionOptions();

  const worker = new Worker(
    QUEUE_NAMES.ACTIVITY,
    async (job) => {
      await connectDB();
      try {
        const activity = await activityService.log(job.data);
        return { success: true, activityId: activity?._id };
      } catch (error) {
        console.error(
          `❌ [ActivityWorker] Error logging activity | jobId=${job.id} | eventType=${job.data?.eventType}:`,
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
      `❌ [ActivityWorker] Job failed | jobId=${job?.id}:`,
      err?.message
    );
  });

  return worker;
}

export default createActivityWorker;
