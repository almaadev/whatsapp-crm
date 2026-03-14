import { createServer } from "http";
import { parse } from "url"; // 👈 URL parsing add panniyachu
import next from "next";
import { Server } from "socket.io";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOST || "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

// Initialize Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
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
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  global.io = io;

  io.on("connection", (socket) => {
    console.log("🟢 Client Connected:", socket.id);

    socket.on("disconnect", () => {
      console.log("🔴 Client Disconnected");
    });
    
    // Socket errors naala server stop aagama irukka
    socket.on("error", (err) => console.error("Socket Error:", err));
  });

  // HTTP server errors naala server stop aagama irukka
  httpServer.on("error", (err) => console.error("Server Error:", err));

  httpServer.listen(port, (err) => {
    if (err) throw err;
    console.log(`> 🚀 Ready on http://${hostname}:${port} (NODE_ENV: ${process.env.NODE_ENV})`);
  });
}).catch((ex) => {
  console.error("🚨 Next.js preparation failed:", ex.stack);
  process.exit(1);
});