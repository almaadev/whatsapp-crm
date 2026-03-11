import { createServer } from "http";
import next from "next";
import { Server } from "socket.io";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOST || "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

// Initialize Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    handle(req, res);
  });

  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  // Make 'io' globally accessible for API routes to emit events
  global.io = io;

  io.on("connection", (socket) => {
    console.log("🟢 Client Connected:", socket.id);

    socket.on("disconnect", () => {
      console.log("🔴 Client Disconnected");
    });
  });

  httpServer.listen(port, (err) => {
    if (err) throw err;
    console.log(`> 🚀 Ready on http://${hostname}:${port}`);
  });
});