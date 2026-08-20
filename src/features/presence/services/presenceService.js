import { connectSocket } from "@/features/chat/services/socketService";
import { usePresenceStore } from "../stores/presenceStore";

let heartbeatInterval = null;
let currentSocket = null;

export const presenceService = {
  _registerHandler: null,
  _presenceHandler: null,
  _visibilityHandler: null,

  init(user) {
    if (!user || (!user.id && !user._id && !user.userId)) {
      this.destroy();
      return;
    }

    const socket = connectSocket();
    currentSocket = socket;

    // Listen to presence updates
    if (this._presenceHandler) {
      socket.off("presence_change", this._presenceHandler);
    }
    this._presenceHandler = (onlineUsers) => {
      usePresenceStore.getState().setOnlineUsers(onlineUsers);
    };
    socket.on("presence_change", this._presenceHandler);

    // Register user details on connect or reconnect
    const uId = (user.id || user._id || user.userId).toString();
    const branchId = user.branch?.toString() || user.branchId?.toString() || "";

    if (this._registerHandler) {
      socket.off("connect", this._registerHandler);
      socket.off("reconnect", this._registerHandler);
    }

    this._registerHandler = () => {
      const userData = {
        userId: uId,
        id: uId,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        branch: branchId,
        branchId: branchId
      };
      socket.emit("register_user", userData);
      console.log("⚡ Registered presence for user:", user.name);
    };

    socket.on("connect", this._registerHandler);
    socket.on("reconnect", this._registerHandler);

    // If socket is already connected, register immediately
    if (socket.connected) {
      this._registerHandler();
    }

    // Start sending heartbeat signals every 10 seconds
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    heartbeatInterval = setInterval(() => {
      if (socket.connected) {
        socket.emit("heartbeat");
      }
    }, 10000);

    // Trigger instant re-register when tab visibility returns (e.g. suspension wakeup)
    if (this._visibilityHandler) {
      document.removeEventListener("visibilitychange", this._visibilityHandler);
    }
    this._visibilityHandler = () => {
      if (document.visibilityState === "visible") {
        if (!socket.connected) {
          socket.connect();
        } else if (this._registerHandler) {
          this._registerHandler();
        }
      }
    };

    document.addEventListener("visibilitychange", this._visibilityHandler);
  },

  destroy() {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
    if (currentSocket) {
      if (this._presenceHandler) {
        currentSocket.off("presence_change", this._presenceHandler);
        this._presenceHandler = null;
      }
      if (this._registerHandler) {
        currentSocket.off("connect", this._registerHandler);
        currentSocket.off("reconnect", this._registerHandler);
        this._registerHandler = null;
      }
      currentSocket = null;
    }
    if (this._visibilityHandler) {
      document.removeEventListener("visibilitychange", this._visibilityHandler);
      this._visibilityHandler = null;
    }
    usePresenceStore.getState().setOnlineUsers([]);
  }
};
