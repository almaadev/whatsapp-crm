import nextEnv from "@next/env";
const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

import { createServer } from "http";
import { parse } from "url"; 
import next from "next";
import { Server } from "socket.io";
import mongoose from "mongoose";
import { publishPerformanceEvent } from "./shared/utils/socketPublisher.js";
import connectDB from "./shared/lib/db/mongodb.js";
import ChatWorkspace from "./shared/models/ChatWorkspace.js";
import Customer from "./shared/models/Customer.js";

function validateEnvironmentVariables() {
  const isProd = process.env.NODE_ENV === "production";
  const required = [
    "MONGODB_URI",
    "TWILIO_ACCOUNT_SID",
    "TWILIO_AUTH_TOKEN",
  ];

  if (isProd) {
    required.push("REDIS_URL");
  }

  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error(`🚨 [STARTUP FATAL] Missing required environment variables: ${missing.join(", ")}`);
    if (isProd) {
      process.exit(1);
    }
  }

  if (isProd && process.env.TWILIO_VALIDATE_SIGNATURE === "false") {
    console.warn("⚠️ [SECURITY WARNING] TWILIO_VALIDATE_SIGNATURE is set to false in production mode!");
  }
}

validateEnvironmentVariables();

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOST || "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  
  const activeChatHandlers = new Map();
  global.activeChatHandlers = activeChatHandlers;
  const onlineUsers = new Map();
  global.onlineUsers = onlineUsers;

  // Cleanup inactive handlers every 30 seconds
  setInterval(() => {
    const now = Date.now();
    for (const [phone, handler] of activeChatHandlers.entries()) {
      // 1. If lockedUntil exists and has expired
      if (handler.lockedUntil && handler.lockedUntil < now) {
        activeChatHandlers.delete(phone);
        if (global.io) global.io.emit("chat_unhandled", { phone });
      } 
      // 2. Otherwise check for basic ping inactivity (60s timeout)
      else if (now - handler.timestamp > 60 * 1000) {
        activeChatHandlers.delete(phone);
        if (global.io) global.io.emit("chat_unhandled", { phone });
      }
    }
  }, 30000);

  // Presence cleanup interval for missed heartbeats (every 15 seconds)
  setInterval(() => {
    const now = Date.now();
    let changed = false;
    for (const [socketId, user] of onlineUsers.entries()) {
      // Offline if no heartbeat for 30 seconds
      if (now - user.timestamp > 30000) {
        console.log(`👤 User offline due to missed heartbeat: ${user.name}`);
        onlineUsers.delete(socketId);
        changed = true;
      }
    }
    if (changed && global.io) {
      global.io.emit("presence_change", Array.from(onlineUsers.values()));
    }
  }, 15000);

  const upgradeHandler = app.getUpgradeHandler(); 

  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("❌ Error occurred handling", req.url, err);
      res.statusCode = 500;
      res.end("Internal Server Error");
    }
  });

  const io = new Server(httpServer, {
    path: "/socket.io/",
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
      credentials: true
    },
    transports: ["websocket", "polling"],
    allowEIO3: true,
    destroyUpgrade: false, // Do not terminate non-Socket.IO upgrades (allows Next.js HMR WebSockets)
  });

  global.io = io;

  io.on("connection", (socket) => {
    if (process.env.NODE_ENV === "development") {
      console.log(`[SOCKET] connected socket=${socket.id}`);
    }

    // Sync current active handlers and online users on connection
    socket.emit("sync_active_handlers", Array.from(activeChatHandlers.entries()));
    socket.emit("presence_change", Array.from(onlineUsers.values()));

    socket.on("register_user", (userData) => {
      if (userData && (userData.userId || userData.id)) {
        const uId = (userData.userId || userData.id).toString();
        let branchId = null;
        if (userData.branchId) {
          branchId = typeof userData.branchId === "object" ? (userData.branchId._id || userData.branchId.id || "").toString() : userData.branchId.toString();
        } else if (userData.branch) {
          branchId = typeof userData.branch === "object" ? (userData.branch._id || userData.branch.id || "").toString() : userData.branch.toString();
        }
        if (branchId === "[object Object]" || !branchId) branchId = null;

        const role = userData.role || "associate";
        const department = userData.department || "";

        // Check if this socket is already registered with identical credentials
        const existing = onlineUsers.get(socket.id);
        const isIdentical = existing &&
          existing.userId === uId &&
          (existing.branchId || null) === branchId &&
          (existing.role || "") === role &&
          (existing.department || "") === department;

        if (isIdentical) {
          // Socket is already active and registered with identical information.
          // Refresh heartbeat timestamp without re-broadcasting redundant events or re-joining rooms.
          existing.timestamp = Date.now();
          return;
        }

        if (process.env.NODE_ENV === "development") {
          console.log(`[SOCKET] register_user | userId=${uId} | role=${role} | branchId=${branchId} | socketId=${socket.id}`);
        }

        socket.userData = { ...userData, userId: uId, branchId, role, department };
        onlineUsers.set(socket.id, {
          ...userData,
          userId: uId,
          branchId,
          role,
          department,
          socketId: socket.id,
          timestamp: Date.now()
        });

        // 🎯 Join Authoritative Scoped Rooms
        socket.join(`user:${uId}`);
        if (branchId) {
          socket.join(`branch:${branchId}`);
        }
        if (role) socket.join(`role:${role}`);
        if (department) socket.join(`dept:${department}`);

        io.emit("presence_change", Array.from(onlineUsers.values()));

        // Scope performance monitor events by role & branch
        if (role === "superAdmin") {
          socket.join("performance-monitor:all");
        } else if (role === "admin") {
          if (branchId) {
            socket.join(`performance-monitor:branch:${branchId}`);
          }
        }

        // Verification test event sent to authoritative user room
        io.to(`user:${uId}`).emit("crm_realtime_test", {
          timestamp: Date.now(),
          userId: uId
        });

        // Publish presence online event
        publishPerformanceEvent("associate_online", {
          associateId: uId,
          name: userData.name,
          branchId
        }, branchId);
      }
    });

    socket.on("join_room", (roomName) => {
      if (roomName) {
        socket.join(roomName);
        console.log(`🔌 Socket ${socket.id} joined room: ${roomName}`);
      }
    });

    socket.on("leave_room", (roomName) => {
      if (roomName) {
        socket.leave(roomName);
        console.log(`🔌 Socket ${socket.id} left room: ${roomName}`);
      }
    });

    socket.on("heartbeat", () => {
      if (onlineUsers.has(socket.id)) {
        const u = onlineUsers.get(socket.id);
        u.timestamp = Date.now();
        onlineUsers.set(socket.id, u);
      }
    });

    socket.on("request_active_handlers", () => {
      socket.emit("sync_active_handlers", Array.from(activeChatHandlers.entries()));
    });

    socket.on("request_presence", () => {
      socket.emit("presence_change", Array.from(onlineUsers.values()));
    });

    socket.on("join_chat", (data) => {
      // data: { phone, user: { name, email, id, role, department, branch, branchId } }
      const incomingUserId = data.user.id || data.user.email;
      const existingHandler = activeChatHandlers.get(data.phone);
      
      // Check if chat is locked by someone else
      if (existingHandler && existingHandler.userId !== incomingUserId) {
        if (!existingHandler.lockedUntil || existingHandler.lockedUntil > Date.now()) {
          socket.emit("join_chat_rejected", { phone: data.phone, handler: existingHandler });
          return;
        }
      }

      // Cleanup if this socket was handling another chat
      for (const [phone, handler] of activeChatHandlers.entries()) {
        if (handler.socketId === socket.id && phone !== data.phone) {
          activeChatHandlers.delete(phone);
          io.emit("chat_unhandled", { phone });

          const userBranch = handler.branchId || handler.branch || null;
          publishPerformanceEvent("active_chat_closed", {
            phone,
            branchId: userBranch
          }, userBranch);
        }
      }

      const userBranch = data.user.branchId || data.user.branch || null;

      activeChatHandlers.set(data.phone, {
        userId: incomingUserId,
        name: data.user.name,
        socketId: socket.id,
        timestamp: Date.now(),
        lockedUntil: null, // Infinite lock until inbound message
        role: data.user.role || "",
        department: data.user.department || "",
        branch: userBranch,
        branchId: userBranch
      });

      const handlerInfo = activeChatHandlers.get(data.phone);
      socket.join(data.phone);
      io.emit("chat_handled", { phone: data.phone, handler: handlerInfo });

      publishPerformanceEvent("active_chat_started", {
        phone: data.phone,
        handler: handlerInfo,
        branchId: userBranch
      }, userBranch);

      // Persist active chat state to MongoDB ChatWorkspace
      if (incomingUserId && mongoose.Types.ObjectId.isValid(incomingUserId.toString())) {
        connectDB().then(async () => {
          const { getPhoneVariations } = await import("./shared/utils/phoneUtils.js");
          const variations = getPhoneVariations(data.phone);
          const cust = await Customer.findOne({ phone: { $in: variations } }).select("_id").lean();
          await ChatWorkspace.findOneAndUpdate(
            { userId: incomingUserId },
            {
              $set: {
                activePhone: data.phone,
                activeCustomerId: cust?._id || null,
                ownerTabId: socket.id,
                lastActiveAt: new Date()
              }
            },
            { upsert: true }
          );
        }).catch(err => console.error("ChatWorkspace update error on join_chat:", err));
      }
    });

    socket.on("leave_chat", (data) => {
      const handler = activeChatHandlers.get(data.phone);
      if (handler && handler.socketId === socket.id) {
        activeChatHandlers.delete(data.phone);
        socket.leave(data.phone);
        io.emit("chat_unhandled", { phone: data.phone });

        const userBranch = handler.branchId || handler.branch || null;
        publishPerformanceEvent("active_chat_closed", {
          phone: data.phone,
          branchId: userBranch
        }, userBranch);
      }

      const uId = handler?.userId || socket.userData?.userId || socket.userData?.id;
      if (uId && mongoose.Types.ObjectId.isValid(uId.toString())) {
        connectDB().then(async () => {
          await ChatWorkspace.findOneAndUpdate(
            { userId: uId },
            { $set: { activePhone: null, activeCustomerId: null, ownerTabId: null } }
          );
        }).catch(err => console.error("ChatWorkspace update error on leave_chat:", err));
      }
    });

    socket.on("ping_chat", (data) => {
      const handler = activeChatHandlers.get(data.phone);
      if (handler && handler.socketId === socket.id) {
        handler.timestamp = Date.now();
      }
    });

    socket.on("disconnect", (reason) => {
      if (process.env.NODE_ENV === "development") {
        console.log(`[SOCKET] disconnected socket=${socket.id} reason=${reason}`);
      }
      if (onlineUsers.has(socket.id)) {
        const u = onlineUsers.get(socket.id);
        onlineUsers.delete(socket.id);
        io.emit("presence_change", Array.from(onlineUsers.values()));
        if (process.env.NODE_ENV === "development") {
          console.log(`👤 User deregistered: ${u?.name}`);
        }

        const branchId = u?.branchId || u?.branch;
        publishPerformanceEvent("associate_offline", {
          associateId: u?.userId,
          name: u?.name,
          branchId
        }, branchId);
      }
      for (const [phone, handler] of activeChatHandlers.entries()) {
        if (handler.socketId === socket.id) {
          activeChatHandlers.delete(phone);
          io.emit("chat_unhandled", { phone });

          const userBranch = handler.branchId || handler.branch || null;
          publishPerformanceEvent("active_chat_closed", {
            phone,
            branchId: userBranch
          }, userBranch);
        }
      }

      // Clean up ChatWorkspace if this socket owned an active chat
      connectDB().then(async () => {
        await ChatWorkspace.updateMany(
          { ownerTabId: socket.id },
          { $set: { activePhone: null, activeCustomerId: null, ownerTabId: null } }
        );
      }).catch(err => console.error("ChatWorkspace cleanup error on disconnect:", err));
    });
    
    socket.on("error", (err) => console.error("Socket Error:", err));
  });

  httpServer.on("error", (err) => console.error("Server Error:", err));

  
  httpServer.on('upgrade', (req, socket, head) => {
    try {
      const parsedUrl = parse(req.url || "", true);
      if (parsedUrl.pathname?.startsWith('/_next/')) {
        upgradeHandler(req, socket, head);
      }
    } catch (err) {
      console.error("Upgrade handler error:", err);
      socket.destroy();
    }
  });

  httpServer.listen(port, (err) => {
    if (err) throw err;
    console.log(`> 🚀 Ready on http://${hostname}:${port}`);

    // 🚀 Start BullMQ Background Workers
    import("./server/queues/workerRunner.js").then((m) => {
      m.startWorkerRunner().catch((wErr) => {
        console.warn("⚠️ [Server] WorkerRunner start notice:", wErr.message);
      });
    }).catch((impErr) => {
      console.warn("⚠️ [Server] WorkerRunner import notice:", impErr.message);
    });
  });
}).catch((ex) => {
  console.error("🚨 Next.js preparation failed:", ex.stack);
  process.exit(1);
});