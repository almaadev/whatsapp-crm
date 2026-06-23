import { useEffect, useRef, useState, useCallback } from "react";

import { chatService } from "@/services/chatService";
import { connectSocket, disconnectSocket } from "@/services/socketService";

import { useChatStore } from "@/stores/chatStore";

import { playSafeAudio } from "@/utils/audio";
import { getDisplayName } from "@/utils/chatHelpers";
import { showChatNotification } from "@/utils/notification";

export function useChat(role) {
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

  const handleIncomingMessage = useCallback(
    (newMessage) => {
      addMessage(newMessage);

      if (newMessage.direction !== "INBOUND") {
        return;
      }

      try {
        const state = useChatStore.getState();

        const currentChat = selectedChatRef.current?.phone === newMessage.phone;

        const contact = state.messages.find(
          (item) => item.phone === newMessage.phone,
        );

        const displayName = getDisplayName(
          newMessage.phone,
          newMessage.name,
          contact,
        );

        if (currentChat) {
          playSafeAudio("/audio/incoming_message.mp3");
          return;
        }

        playSafeAudio("/audio/notification.wav");

        showChatNotification({
          displayName,
          phone: newMessage.phone,
          message: newMessage.message,
          addNotification,
        });
      } catch (error) {
        console.error("Notification Processing Error:", error);
      }
    },
    [addMessage, addNotification],
  );

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

  useEffect(() => {
    if (!role) return;

    fetchChats();

    const socket = connectSocket();

    socket.on("new_message", handleIncomingMessage);

    socket.on("message_status_update", handleStatusUpdate);

    return () => {
      socket.off("new_message", handleIncomingMessage);

      socket.off("message_status_update", handleStatusUpdate);

      disconnectSocket();
    };
  }, [role, fetchChats, handleIncomingMessage, handleStatusUpdate]);

  return {
    loading,
  };
}
