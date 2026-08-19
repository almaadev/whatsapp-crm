import { io } from "socket.io-client";

let socket = null;

/**
 * Enterprise Singleton Socket Manager
 * Guarantees exactly ONE persistent socket connection for the entire CRM app session.
 */
export const connectSocket = () => {
  if (socket) {
    if (!socket.connected && !socket.connecting) {
      socket.connect();
    }
    return socket;
  }

  const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");

  console.log(`[SOCKET DEBUG] connecting to ${socketUrl}...`);

  socket = io(socketUrl, {
    path: "/socket.io/",
    transports: ["polling", "websocket"],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
    autoConnect: true,
  });

  socket.on("connect", () => {
    const transport = socket.io?.engine?.transport?.name || "unknown";
    console.log(`[SOCKET DEBUG] connected | socketId=${socket.id} | transport=${transport}`);
  });

  socket.on("disconnect", (reason) => {
    console.warn(`[SOCKET DEBUG] disconnected | reason=${reason}`);
  });

  socket.on("connect_error", (err) => {
    console.error(`[SOCKET DEBUG] connection error:`, err.message);
  });

  socket.on("reconnect", (attemptNumber) => {
    const transport = socket.io?.engine?.transport?.name || "unknown";
    console.log(`[SOCKET DEBUG] reconnected on attempt #${attemptNumber} | transport=${transport}`);
  });

  return socket;
};

export const getSocket = () => {
  if (!socket) {
    return connectSocket();
  }
  return socket;
};

export const disconnectSocket = (force = false) => {
  if (socket && force) {
    console.log(`[SocketService] Force disconnecting socket: ${socket.id}`);
    socket.disconnect();
    socket = null;
  }
};