import { createServer } from "http";
import { parse } from "url"; 
import next from "next";
import { Server } from "socket.io";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOST || "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  
  const activeChatHandlers = new Map();
  global.activeChatHandlers = activeChatHandlers;

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

    // Sync current active handlers on connection
    socket.emit("sync_active_handlers", Array.from(activeChatHandlers.entries()));

    socket.on("request_active_handlers", () => {
      socket.emit("sync_active_handlers", Array.from(activeChatHandlers.entries()));
    });

    socket.on("join_chat", (data) => {
      // data: { phone, user: { name, email, id } }
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
        }
      }

      activeChatHandlers.set(data.phone, {
        userId: incomingUserId,
        name: data.user.name,
        socketId: socket.id,
        timestamp: Date.now(),
        lockedUntil: null, // Infinite lock until inbound message
      });

      io.emit("chat_handled", { phone: data.phone, handler: activeChatHandlers.get(data.phone) });
    });

    socket.on("leave_chat", (data) => {
      const handler = activeChatHandlers.get(data.phone);
      if (handler && handler.socketId === socket.id) {
        activeChatHandlers.delete(data.phone);
        io.emit("chat_unhandled", { phone: data.phone });
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
      for (const [phone, handler] of activeChatHandlers.entries()) {
        if (handler.socketId === socket.id) {
          activeChatHandlers.delete(phone);
          io.emit("chat_unhandled", { phone });
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