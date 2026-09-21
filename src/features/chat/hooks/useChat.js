import { useEffect, useRef, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { connectSocket } from "@/features/chat/services/socketService";
import { chatService } from "@/features/chat/services/chatService";
import { useChatStore } from "@/features/chat/stores/chatStore";
import { isSamePhone } from "@/shared/utils/phoneUtils";

/**
 * Processes incoming message_status_update payload and updates the Zustand chat store.
 * Strictly adheres to correlation rules:
 * 1. Matches by twilioSid or sid
 * 2. Matches by messageId, id, _id, or tempId
 * 3. Does NOT blindly overwrite latest outbound message if correlation data (sid/messageId) was provided but did not match
 * 4. Only falls back to latest outbound message when correlation data is genuinely unavailable
 *
 * @param {Object} payload - { sid, status, phone, messageId, branchId }
 * @param {Object} store - Zustand useChatStore instance
 */
export function processStatusUpdate(payload, store = useChatStore) {
  if (!payload || !payload.status) return;
  const { sid, status, phone, messageId } = payload;

  if (process.env.NODE_ENV === "development") {
    console.log(`[CHAT SOCKET] message_status_update received`);
    console.log(`[CHAT SOCKET] sid=${sid || "N/A"}`);
    console.log(`[CHAT SOCKET] status=${status}`);
    console.log(`[CHAT SOCKET] target phone=${phone || "N/A"}`);
  }

  const state = store.getState();
  const chats = state.messages || [];
  const updateMessageStatus = state.updateMessageStatus;
  if (typeof updateMessageStatus !== "function") return;

  const hasCorrelationData = Boolean(sid || messageId);

  const processChat = (chat) => {
    if (!chat?.history?.length) return;

    let targetMessage = null;

    if (hasCorrelationData) {
      // 1. Primary correlation: twilioSid / sid
      if (sid) {
        targetMessage = chat.history.find(
          (msg) => msg.twilioSid === sid || msg.sid === sid
        );
      }
      // 2. Secondary correlation: messageId / tempId / _id / id
      if (!targetMessage && messageId) {
        targetMessage = chat.history.find(
          (msg) =>
            msg._id === messageId ||
            msg.id === messageId ||
            msg.tempId === messageId ||
            msg.messageId === messageId
        );
      }
      // If correlation data was provided but no message in this chat matched, do NOT blindly update latest outbound
      if (!targetMessage) return;
    } else {
      // Fallback-to-latest-outbound logic ONLY when correlation data is genuinely unavailable
      targetMessage = chat.history
        .slice()
        .reverse()
        .find((msg) => msg.direction === "OUTBOUND");
      if (!targetMessage) return;
    }

    const targetId =
      targetMessage.tempId || targetMessage._id || targetMessage.id || messageId || sid;

    updateMessageStatus(chat.phone, targetId, status, sid || targetMessage.twilioSid);
  };

  if (phone) {
    const matchedChats = chats.filter((c) => isSamePhone(c.phone, phone));
    if (matchedChats.length > 0) {
      matchedChats.forEach(processChat);
    } else if (state.selectedChat && isSamePhone(state.selectedChat.phone, phone)) {
      processChat(state.selectedChat);
    }
  } else {
    chats.forEach(processChat);
    if (state.selectedChat && !chats.some((c) => isSamePhone(c.phone, state.selectedChat.phone))) {
      processChat(state.selectedChat);
    }
  }
}

/**
 * Custom hook for managing the main chat interface logic.
 * Handles fetching initial chats, setting up socket listeners for real-time incoming messages,
 * and processing message status updates.
 *
 * @param {string} role - The role of the user, used for fetching appropriate messages.
 * @returns {Object} An object containing the `loading` state.
 */
export function useChat(optionsOrRole) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const isConfigObj = typeof optionsOrRole === "object" && optionsOrRole !== null;
  const isAuthenticated = isConfigObj ? (optionsOrRole.isAuthenticated ?? true) : true;
  const isAuthorized = isConfigObj ? (optionsOrRole.isAuthorized ?? true) : true;
  const role = isConfigObj ? optionsOrRole.role : optionsOrRole;

  const setMessages = useChatStore((state) => state.setMessages);
  const addMessage = useChatStore((state) => state.addMessage);
  const addNotification = useChatStore((state) => state.addNotification);
  const selectedChat = useChatStore((state) => state.selectedChat);
  const selectedChatRef = useRef(selectedChat);

  useEffect(() => {
    selectedChatRef.current = selectedChat;
  }, [selectedChat]);

  const fetchChats = useCallback(async () => {
    if (!isAuthenticated || !isAuthorized) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const chats = await chatService.getMessages(role);

      if (!Array.isArray(chats)) {
        setMessages([]);
        setError(null);
        return;
      }

      const sortedChats = chats.sort(
        (a, b) =>
          new Date(b.lastSeenAt || b.timestamp || 0) -
          new Date(a.lastSeenAt || a.timestamp || 0),
      );

      setMessages(sortedChats);
      setError(null);
    } catch (err) {
      const errMsg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Failed to load chats";
      console.error("Chat Fetch Error:", errMsg);
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, isAuthorized, role, setMessages]);

  const handleStatusUpdate = useCallback((payload) => {
    processStatusUpdate(payload, useChatStore);
  }, []);

  // Enterprise Lifecycle: Register message_status_update singleton listener once with cleanup
  useEffect(() => {
    if (!isAuthenticated || !isAuthorized) return;

    const socket = connectSocket();
    if (!socket) return;

    socket.on("message_status_update", handleStatusUpdate);

    return () => {
      socket.off("message_status_update", handleStatusUpdate);
    };
  }, [isAuthenticated, isAuthorized, handleStatusUpdate]);

  const handleCustomerBranchUpdate = useCallback(
    (data) => {
      fetchChats();
      try {
        queryClient.invalidateQueries({ queryKey: ["chats"] });
        queryClient.invalidateQueries({ queryKey: ["leads"] });
        queryClient.invalidateQueries({ queryKey: ["customers"] });
      } catch (e) {}
    },
    [fetchChats, queryClient],
  );

  useEffect(() => {
    if (!isAuthenticated || !isAuthorized) {
      setLoading(false);
      return;
    }
    fetchChats();
  }, [isAuthenticated, isAuthorized, fetchChats]);

  return {
    loading,
    error,
    refreshChats: fetchChats,
  };
}
