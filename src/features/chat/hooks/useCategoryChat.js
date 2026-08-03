import api from "@/shared/lib/axios";
import { useEffect, useState, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getCategoryConfig } from "@/shared/constants/categories";
import { getCategoryChatStore } from "@/features/chat/stores/categoryChatStore";
import { categoryChatService } from "@/features/chat/services/categoryChatService";
import { connectSocket } from "@/features/chat/services/socketService";
import { resolveCustomerDisplayName } from "@/shared/utils/customerResolver";
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

  const selectedChatPhone = store.selectedChat?.phone;

  useEffect(() => {
    if (selectedChatPhone) {
      const cleanPhone = selectedChatPhone.replace("whatsapp:", "");
      let routePrefix = slug;
      if (slug === "product") routePrefix = "product-lead";
      else if (slug === "mdcamp") routePrefix = "md-camp";
      else if (slug === "therapy") routePrefix = "therapy";

      console.log(`[useCategoryChat] Fetching detailed customer for slug: "${slug}", routePrefix: "${routePrefix}", phone: "${cleanPhone}"`);
      
      api.get(`/api/${routePrefix}/leads/${encodeURIComponent(cleanPhone)}`)
        .then(({ data }) => {
          console.log(`[useCategoryChat] Fetched detailed customer data successfully:`, data);
          useStore.getState().setDetailedCustomer(data);
        })
        .catch(err => {
          console.error(`[useCategoryChat] Failed to fetch category lead details:`, err);
          useStore.getState().setDetailedCustomer(null);
        });
    } else {
      useStore.getState().setDetailedCustomer(null);
    }
  }, [selectedChatPhone, slug, useStore]);

  const fetchChats = useCallback(async (search = "") => {
    try {
      setLoading(true);
      const data = await categoryChatService.getChats(slug, search);

      if (!Array.isArray(data)) throw new Error("Invalid data format received");

      const formattedData = data.map((chat) => ({
        ...chat,
        name: resolveCustomerDisplayName(chat),
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

    const handleChatStatusUpdated = (data) => {
      if (data?.phone) {
        const isClosed = Boolean(data.isClosed ?? data.isChatClosed);
        useStore.getState().updateChatDetails(data.phone, {
          isClosed,
          isChatClosed: isClosed,
        });
      }
    };

    const handleCustomerUpdated = (data) => {
      fetchChats();
      if (data?.phone) {
        useStore.getState().updateChatDetails(data.phone, data);
      }
      try {
        queryClient.invalidateQueries({ queryKey: ["category-chats", slug] });
      } catch (qErr) {}
    };

    const socket = connectSocket();
    socket.on(config.socketEvent, handleNewMessage);
    socket.on("incoming-message", handleNewMessage);
    socket.on("message_status_update", handleStatusUpdate);
    socket.on("chat_status_updated", handleChatStatusUpdated);
    socket.on("customer_branch_updated", handleCustomerUpdated);
    socket.on("customer_updated", handleCustomerUpdated);

    return () => {
      socket.off(config.socketEvent, handleNewMessage);
      socket.off("incoming-message", handleNewMessage);
      socket.off("message_status_update", handleStatusUpdate);
      socket.off("chat_status_updated", handleChatStatusUpdated);
      socket.off("customer_branch_updated", handleCustomerUpdated);
      socket.off("customer_updated", handleCustomerUpdated);
    };
  }, [slug, config.chatType, config.socketEvent, fetchChats, useStore, queryClient]);

  return { loading, sending, fetchChats, sendMessage, updateStatus, useStore, config };
}
