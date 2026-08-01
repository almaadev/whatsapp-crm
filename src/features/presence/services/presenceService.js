import { connectSocket, disconnectSocket } from "@/features/chat/services/socketService";
import { usePresenceStore } from "../stores/presenceStore";

let heartbeatInterval = null;
let currentSocket = null;

export const presenceService = {
  init(user) {
    if (!user || !user.id) {
      this.destroy();
      return;
    }

    const socket = connectSocket();
    currentSocket = socket;

    // Listen to presence updates
    socket.off("presence_change");
    socket.on("presence_change", (onlineUsers) => {
      usePresenceStore.getState().setOnlineUsers(onlineUsers);
    });

    // Register user details on connect or reconnect
    const register = () => {
      const userData = {
        userId: user.id.toString(),
        name: user.name,
        role: user.role,
        department: user.department,
        branch: user.branch?.toString() || ""
      };
      socket.emit("register_user", userData);
      console.log("⚡ Registered presence for user:", user.name);
    };

    socket.on("connect", register);
    socket.on("reconnect", register);

    // If socket is already connected, register immediately
    if (socket.connected) {
      register();
    }

    // Start sending heartbeat signals every 10 seconds
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    heartbeatInterval = setInterval(() => {
      if (socket.connected) {
        socket.emit("heartbeat");
      }
    }, 10000);

    // Trigger instant re-register when tab visibility returns (e.g. suspension wakeup)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        if (!socket.connected) {
          socket.connect();
        } else {
          register();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    this._visibilityHandler = handleVisibilityChange;
  },

  destroy() {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
    if (currentSocket) {
      currentSocket.off("presence_change");
      currentSocket.off("connect");
      currentSocket.off("reconnect");
      currentSocket = null;
    }
    if (this._visibilityHandler) {
      document.removeEventListener("visibilitychange", this._visibilityHandler);
      this._visibilityHandler = null;
    }
    disconnectSocket();
    usePresenceStore.getState().setOnlineUsers([]);
  }
};
