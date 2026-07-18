import api from "@/shared/lib/axios";
import { useEffect, useState, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getCategoryConfig } from "@/shared/constants/categories";
import { getCategoryChatStore } from "@/features/chat/stores/categoryChatStore";
import { categoryChatService } from "@/features/chat/services/categoryChatService";
import { connectSocket } from "@/features/chat/services/socketService";
import { toast } from "react-toastify";


/**
 * Custom hook for managing category-specific chats (e.g., Product Lead, MD Camp).
 * Handles fetching chats for a specific slug, sending messages, updating statuses,
 * and listening for real-time socket events related to the category.
 *
 * @param {string} slug - The category slug identifier (e.g., 'product-lead', 'md-camp').
 * @returns {Object} Tools and state needed by the category inbox UI.
 */
export function useCategoryChat(slug) {
  const queryClient = useQueryClient();
  const config = getCategoryConfig(slug);
  const useStore = getCategoryChatStore(slug);

  const store = useStore();
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const selectedChatRef = useRef(store.selectedChat);
  const messagesRef = useRef(store.messages);

  useEffect(() => {
    selectedChatRef.current = store.selectedChat;
    messagesRef.current = store.messages;
  }, [store.selectedChat, store.messages]);

  const fetchChats = useCallback(async (search = "") => {
    try {
      setLoading(true);
      const data = await categoryChatService.getChats(slug, search);

      if (!Array.isArray(data)) throw new Error("Invalid data format received");

      const formattedData = data.map((chat) => ({
        ...chat,
        history: (chat.history || []).map((msg) => ({
          ...msg,
          timestamp: msg.timestamp || msg.createdAt || new Date().toISOString(),
        })),
      }));

      useStore.getState().setMessages(formattedData);

      const currentSelected = selectedChatRef.current;
      if (currentSelected) {
        const updatedSelected = formattedData.find((c) => c.phone === currentSelected.phone);
        if (updatedSelected) {
          useStore.getState().setSelectedChat(updatedSelected);
        }
      }
    } catch (error) {
      console.error(`Fetch Error in useCategoryChat(${slug}):`, error);
    } finally {
      setLoading(false);
    }
  }, [slug, useStore]);

  const sendMessage = async (phone, message) => {
    try {
      setSending(true);
      const res = await categoryChatService.sendMessage(slug, phone, message);
      if (res && res.message) {
        useStore.getState().addMessage({
          ...res.message,
          timestamp: res.message.timestamp || new Date().toISOString(),
        });
      }
      return true;
    } catch {
      toast.error("Failed to send message");
      return false;
    } finally {
      setSending(false);
    }
  };

  const updateStatus = async (phone, status) => {
    try {
      await api.post("/api/lead-status", { phone, status });
      useStore.getState().updateChatDetails(phone, { status });
      toast.success(`Status updated to ${status}`);
    } catch {
      toast.error("Failed to update status");
    }
  };

  useEffect(() => {
    fetchChats();

    const handleNewMessage = (msg) => {
      const newMsg = {
        ...msg,
        timestamp: msg.timestamp || new Date().toISOString(),
        chatType: config.chatType,
      };

      const currentState = useStore.getState();
      currentState.addMessage(newMsg);
      try {
        queryClient.invalidateQueries({ queryKey: ["category-chats", slug] });
      } catch (qErr) {}
    };

    const handleStatusUpdate = (update) => {
      useStore.getState().updateMessageStatus(update.phone, update.sid, update.status);
    };

    const socket = connectSocket();
    socket.on(config.socketEvent, handleNewMessage);
    socket.on("message_status_update", handleStatusUpdate);

    return () => {
      socket.off(config.socketEvent, handleNewMessage);
      socket.off("message_status_update", handleStatusUpdate);
    };
  }, [slug, config.chatType, config.socketEvent, fetchChats, useStore]);

  return { loading, sending, fetchChats, sendMessage, updateStatus, useStore, config };
}
