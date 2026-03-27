import { useState, useCallback } from 'react';
import { categoryChatService } from '@/services/categoryChatService';
import { toast } from 'react-toastify';
import { useProductChatStore } from '@/store/productChatStore';

export const useProductChat = () => {
    const category = 'product';
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);

    const selectedChat = useProductChatStore(s => s.selectedChat);
    const setSelectedChat = useProductChatStore(s => s.setSelectedChat);
    const messages = useProductChatStore(s => s.messages);
    const setMessages = useProductChatStore(s => s.setMessages);
    const addMessage = useProductChatStore(s => s.addMessage);
    const updateChatDetails = useProductChatStore(s => s.updateChatDetails);

    const fetchChats = useCallback(async (showLoading = true) => {
        if (showLoading) setLoading(true);
        try {
            const data = await categoryChatService.getChats(category);
            setMessages(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error(error);
            toast.error("Failed to load Product chats");
        } finally {
            setLoading(false);
        }
    }, [setMessages]);

    const sendMessage = async (phone, messageText) => {
        if (!phone || !messageText.trim()) return false;
        setSending(true);

        const tempId = `temp-${Date.now()}`;
        const tempMsg = { tempId, message: messageText, direction: "OUTBOUND", status: "SENT", createdAt: new Date().toISOString(), phone };
        addMessage(tempMsg);

        try {
            await categoryChatService.sendMessage(category, phone, messageText);
            await fetchChats(false);
            return true;
        } catch (error) {
            toast.error("Error sending message");
            return false;
        } finally {
            setSending(false);
        }
    };

    const updateStatus = async (phone, status) => {
        updateChatDetails(phone, { status });
        try {
            await categoryChatService.updateStatus(category, phone, status);
            toast.success(`Status updated to ${status}`);
            await fetchChats(false);
            return true;
        } catch (err) {
            toast.error("Failed to update status");
            return false;
        }
    };

    return { selectedChat, setSelectedChat, messages, fetchChats, sendMessage, updateStatus, loading, sending };
};