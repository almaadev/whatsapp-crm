import { Queue } from "bullmq";
import Redis from "ioredis";

export const QUEUE_NAMES = {
  INBOUND_MESSAGE: "inbound-message",
  AUTOMATION: "automation",
  NOTIFICATION: "notification",
  ACTIVITY: "activity",
  CAMPAIGN: "campaign",
};

export const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 2000,
  },
  removeOnComplete: {
    age: 86400,
    count: 5000,
  },
  removeOnFail: {
    age: 604800,
    count: 5000,
  },
};

/**
 * Creates a resilient Redis client with error suppression for offline environments.
 */
export function createRedisClient() {
  const redisUrl = process.env.REDIS_URL;
  let client;

  const baseOptions = {
    maxRetriesPerRequest: null,
    enableOfflineQueue: false,
    retryStrategy: (times) => {
      if (times > 3) return null; // Stop reconnect spam if Redis is offline
      return Math.min(times * 100, 1000);
    },
    lazyConnect: true,
  };

  if (redisUrl) {
    client = new Redis(redisUrl, baseOptions);
  } else if (process.env.REDIS_HOST) {
    client = new Redis({
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT || "6379", 10),
      password: process.env.REDIS_PASSWORD || undefined,
      ...baseOptions,
    });
  } else {
    client = new Redis({
      host: "127.0.0.1",
      port: 6379,
      ...baseOptions,
      retryStrategy: () => null, // Do not retry if local redis is not running
    });
  }

  const attachErrorHandler = (c) => {
    c.on("error", (err) => {
      // Suppress unhandled ECONNREFUSED when Redis is offline in dev/test
      if (err.code !== "ECONNREFUSED" && !err.message?.includes("ECONNREFUSED") && !err.message?.includes("Connection is closed")) {
        console.warn("⚠️ [BullMQ Redis Error]:", err.message);
      }
    });
  };

  attachErrorHandler(client);

  // Override duplicate so BullMQ internal subscriber connections inherit error suppression
  const originalDuplicate = client.duplicate.bind(client);
  client.duplicate = (overrideOptions) => {
    const dup = originalDuplicate(overrideOptions);
    attachErrorHandler(dup);
    return dup;
  };

  return client;
}

export function getRedisConnectionOptions() {
  return createRedisClient();
}

let queues = null;

export function getQueues() {
  if (!queues) {
    const attachQueueErrorHandler = (q) => {
      q.on("error", () => {
        // Suppress unhandled EventEmitter errors when Redis is offline in dev
      });
      return q;
    };

    queues = {
      inboundMessageQueue: attachQueueErrorHandler(
        new Queue(QUEUE_NAMES.INBOUND_MESSAGE, {
          connection: createRedisClient(),
          defaultJobOptions: DEFAULT_JOB_OPTIONS,
        })
      ),
      automationQueue: attachQueueErrorHandler(
        new Queue(QUEUE_NAMES.AUTOMATION, {
          connection: createRedisClient(),
          defaultJobOptions: DEFAULT_JOB_OPTIONS,
        })
      ),
      notificationQueue: attachQueueErrorHandler(
        new Queue(QUEUE_NAMES.NOTIFICATION, {
          connection: createRedisClient(),
          defaultJobOptions: DEFAULT_JOB_OPTIONS,
        })
      ),
      activityQueue: attachQueueErrorHandler(
        new Queue(QUEUE_NAMES.ACTIVITY, {
          connection: createRedisClient(),
          defaultJobOptions: DEFAULT_JOB_OPTIONS,
        })
      ),
      campaignQueue: attachQueueErrorHandler(
        new Queue(QUEUE_NAMES.CAMPAIGN, {
          connection: createRedisClient(),
          defaultJobOptions: DEFAULT_JOB_OPTIONS,
        })
      ),
    };
  }
  return queues;
}

export async function closeQueues() {
  if (queues) {
    await Promise.all([
      queues.inboundMessageQueue.close().catch(() => {}),
      queues.automationQueue.close().catch(() => {}),
      queues.notificationQueue.close().catch(() => {}),
      queues.activityQueue.close().catch(() => {}),
      queues.campaignQueue.close().catch(() => {}),
    ]);
    queues = null;
  }
}

async function fallbackDispatch(queueKey, name, data, opts) {
  const sanitizedId = opts?.jobId || `fallback_${Date.now()}`;

  setImmediate(async () => {
    try {
      if (queueKey === "inboundMessageQueue") {
        const { default: inboundMessageService } = await import("../services/inboundMessageService.js");
        const { default: WebhookEvent } = await import("../../shared/models/WebhookEvent.js");
        const { default: connectDB } = await import("../../shared/lib/db/mongodb.js");
        const { runSerializedPerCustomer } = await import("./workers/inboundMessageWorker.js");

        await connectDB();
        const { twilioSid, fromPhone } = data;

        if (twilioSid) {
          await WebhookEvent.updateOne(
            { provider: "twilio", eventId: twilioSid },
            { $set: { status: "processing" } }
          ).catch(() => {});
        }

        await runSerializedPerCustomer(fromPhone, async () => {
          return await inboundMessageService.handleInboundMessage(data);
        });

        if (twilioSid) {
          await WebhookEvent.updateOne(
            { provider: "twilio", eventId: twilioSid },
            { $set: { status: "completed", processedAt: new Date() } }
          ).catch(() => {});
        }
      } else if (queueKey === "automationQueue") {
        const { processKeywordAutoReply } = await import("../../features/chat/services/keywordMatcher.js");
        const { phone, messageText, profileName, receivedOnNumber, messageSid } = data;
        await processKeywordAutoReply(phone, messageText, profileName, receivedOnNumber, { inboundMessageSid: messageSid });
      } else if (queueKey === "notificationQueue") {
        const { notificationService } = await import("../services/notificationService.js");
        await notificationService.processInboundNotification(data);
      } else if (queueKey === "activityQueue") {
        const { activityService } = await import("../services/activityService.js");
        await activityService.log(data);
      } else if (queueKey === "campaignQueue") {
        const { processCampaignBatch } = await import("./workers/campaignWorker.js");
        await processCampaignBatch(data);
      }
    } catch (err) {
      console.error(`❌ [Queue Fallback Dispatch] Error processing ${queueKey}:`, err.message);
      if (data?.twilioSid && queueKey === "inboundMessageQueue") {
        const { default: WebhookEvent } = await import("../../shared/models/WebhookEvent.js");
        await WebhookEvent.updateOne(
          { provider: "twilio", eventId: data.twilioSid },
          { $set: { status: "failed" } }
        ).catch(() => {});
      }
    }
  });

  return { id: sanitizedId, name, data, opts };
}

async function safeQueueAdd(queueKey, name, data, opts) {
  try {
    const q = getQueues()[queueKey];
    return await q.add(name, data, opts);
  } catch (err) {
    if (
      err.code === "ECONNREFUSED" ||
      err.message?.includes("ECONNREFUSED") ||
      err.message?.includes("Connection is closed") ||
      err.message?.includes("connection") ||
      err.message?.includes("connect")
    ) {
      return await fallbackDispatch(queueKey, name, data, opts);
    }
    throw err;
  }
}

export const inboundMessageQueue = {
  add: async (name, data, opts) => safeQueueAdd("inboundMessageQueue", name, data, opts),
};
export const automationQueue = {
  add: async (name, data, opts) => safeQueueAdd("automationQueue", name, data, opts),
};
export const notificationQueue = {
  add: async (name, data, opts) => safeQueueAdd("notificationQueue", name, data, opts),
};
export const activityQueue = {
  add: async (name, data, opts) => safeQueueAdd("activityQueue", name, data, opts),
};
export const campaignQueue = {
  add: async (name, data, opts) => safeQueueAdd("campaignQueue", name, data, opts),
};

export async function getQueueMetrics() {
  const qList = getQueues();
  const metrics = {};
  for (const [key, q] of Object.entries(qList)) {
    try {
      const counts = await q.getJobCounts("waiting", "active", "completed", "failed", "delayed");
      metrics[key] = counts;
    } catch {
      metrics[key] = { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0, status: "offline" };
    }
  }
  return metrics;
}
