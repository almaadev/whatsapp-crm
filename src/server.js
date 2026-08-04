import { createServer } from "http";
import { parse } from "url"; 
import next from "next";
import { Server } from "socket.io";
import { publishPerformanceEvent } from "./shared/utils/socketPublisher.js";

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
  });

  global.io = io;

  io.on("connection", (socket) => {
    console.log("🟢 Client Connected:", socket.id);

    // Sync current active handlers and online users on connection
    socket.emit("sync_active_handlers", Array.from(activeChatHandlers.entries()));
    socket.emit("presence_change", Array.from(onlineUsers.values()));

    socket.on("register_user", (userData) => {
      if (userData && (userData.userId || userData.id)) {
        const uId = userData.userId || userData.id;
        const branchId = userData.branchId || userData.branch || null;
        
        socket.userData = { ...userData, userId: uId, branchId };
        onlineUsers.set(socket.id, {
          ...userData,
          userId: uId,
          branchId,
          socketId: socket.id,
          timestamp: Date.now()
        });

        // 🎯 Join Authoritative Scoped Rooms
        socket.join(`user:${uId}`);
        if (branchId) socket.join(`branch:${branchId.toString()}`);
        if (userData.role) socket.join(`role:${userData.role}`);
        if (userData.department) socket.join(`dept:${userData.department}`);

        io.emit("presence_change", Array.from(onlineUsers.values()));
        console.log(`👤 User registered: ${userData.name} (${userData.role}) | Joined rooms: user:${uId}, branch:${branchId}, role:${userData.role}`);

        // Scope performance monitor events by role & branch
        if (userData.role === "superAdmin") {
          socket.join("performance-monitor:all");
          console.log(`🔌 Super Admin socket ${socket.id} joined performance-monitor:all`);
        } else if (userData.role === "admin") {
          if (branchId) {
            socket.join(`performance-monitor:branch:${branchId}`);
            console.log(`🔌 Admin socket ${socket.id} joined performance-monitor:branch:${branchId}`);
          }
        }

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
    });

    socket.on("ping_chat", (data) => {
      const handler = activeChatHandlers.get(data.phone);
      if (handler && handler.socketId === socket.id) {
        handler.timestamp = Date.now();
      }
    });

    socket.on("disconnect", () => {
      console.log("🔴 Client Disconnected", socket.id);
      if (onlineUsers.has(socket.id)) {
        const u = onlineUsers.get(socket.id);
        onlineUsers.delete(socket.id);
        io.emit("presence_change", Array.from(onlineUsers.values()));
        console.log(`👤 User deregistered: ${u?.name}`);

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
    });
    
    socket.on("error", (err) => console.error("Socket Error:", err));
  });

  httpServer.on("error", (err) => console.error("Server Error:", err));

  
  httpServer.on('upgrade', (req, socket, head) => {
    if (req.url.startsWith('/_next/')) {
      upgradeHandler(req, socket, head);
    }
  });

  httpServer.listen(port, (err) => {
    if (err) throw err;
    console.log(`> 🚀 Ready on http://${hostname}:${port}`);
  });
}).catch((ex) => {
  console.error("🚨 Next.js preparation failed:", ex.stack);
  process.exit(1);
});