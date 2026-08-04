import { useEffect, useRef, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { chatService } from "@/features/chat/services/chatService";
import { useChatStore } from "@/features/chat/stores/chatStore";

/**
 * Custom hook for managing the main chat interface logic.
 * Handles fetching initial chats, setting up socket listeners for real-time incoming messages,
 * and processing message status updates.
 *
 * @param {string} role - The role of the user, used for fetching appropriate messages.
 * @returns {Object} An object containing the `loading` state.
 */
export function useChat(role) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(true);

  const setMessages = useChatStore((state) => state.setMessages);

  const addMessage = useChatStore((state) => state.addMessage);

  const addNotification = useChatStore((state) => state.addNotification);

  const selectedChat = useChatStore((state) => state.selectedChat);

  const selectedChatRef = useRef(selectedChat);

  useEffect(() => {
    selectedChatRef.current = selectedChat;
  }, [selectedChat]);

  const fetchChats = useCallback(async () => {
    try {
      const chats = await chatService.getMessages(role);

      if (!Array.isArray(chats)) return;

      const sortedChats = chats.sort(
        (a, b) => new Date(b.lastSeenAt) - new Date(a.lastSeenAt),
      );

      setMessages(sortedChats);
    } catch (error) {
      console.error("Chat Fetch Error:", error);
    } finally {
      setLoading(false);
    }
  }, [role, setMessages]);

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
      const targetChat = chats.find((chat) => chat.phone === phone);

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
    if (!role) return;
    fetchChats();
  }, [role, fetchChats]);

  return {
    loading,
  };
}
