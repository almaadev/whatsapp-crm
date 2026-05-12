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
<<<<<<< HEAD
  const httpServer = createServer(async (req, res) => {
    try {

=======
  // 👇 FIX: Moved inside prepare()
  const upgradeHandler = app.getUpgradeHandler(); 

  const httpServer = createServer(async (req, res) => {
    try {
>>>>>>> c1be5bc (Initial commit from new system)
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

    socket.on("disconnect", () => {
      console.log("🔴 Client Disconnected");
    });
    
    socket.on("error", (err) => console.error("Socket Error:", err));
  });

<<<<<<< HEAD

  httpServer.on("error", (err) => console.error("Server Error:", err));

  httpServer.listen(port, (err) => {
    if (err) throw err;
    console.log(`> 🚀 Ready on http://${hostname}:${port} (NODE_ENV: ${process.env.NODE_ENV})`);
=======
  httpServer.on("error", (err) => console.error("Server Error:", err));

  // HMR WebSockets-ai Next.js-kku pass pannanum
  httpServer.on('upgrade', (req, socket, head) => {
    if (req.url.startsWith('/_next/')) {
      upgradeHandler(req, socket, head);
    }
  });

  httpServer.listen(port, (err) => {
    if (err) throw err;
    console.log(`> 🚀 Ready on http://${hostname}:${port}`);
>>>>>>> c1be5bc (Initial commit from new system)
  });
}).catch((ex) => {
  console.error("🚨 Next.js preparation failed:", ex.stack);
  process.exit(1);
});