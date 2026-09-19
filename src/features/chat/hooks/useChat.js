import { useEffect, useRef, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { chatService } from "@/features/chat/services/chatService";
import { useChatStore } from "@/features/chat/stores/chatStore";
import { isSamePhone } from "@/shared/utils/phoneUtils";

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

  const handleStatusUpdate = useCallback(({ sid, status, phone }) => {
    const state = useChatStore.getState();

    const chats = state.messages;
    const updateMessageStatus = state.updateMessageStatus;

    const processChat = (chat) => {
      if (!chat.history?.length) return;

      let targetMessage = chat.history.find(
        (msg) => msg.twilioSid === sid || msg.sid === sid,
      );

      if (!targetMessage) {
        targetMessage = chat.history
          .slice()
          .reverse()
          .find((msg) => msg.direction === "OUTBOUND");
      }

      if (!targetMessage) return;

      const messageId =
        targetMessage.tempId || targetMessage._id || targetMessage.id;

      updateMessageStatus(chat.phone, messageId, status, sid);
    };

    if (phone) {
      const targetChat = chats.find((chat) => isSamePhone(chat.phone, phone));

      if (targetChat) {
        processChat(targetChat);
      }
    } else {
      chats.forEach(processChat);
    }
  }, []);

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
