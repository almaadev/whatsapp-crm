import { useState, useCallback } from 'react';
import { categoryChatService } from '@/services/categoryChatService';
import { toast } from 'react-toastify';
import { useTherapyChatStore } from '@/store/therapyChatStore';

export const useTherapyChat = () => {
    const category = 'therapy';
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);

    const selectedChat = useTherapyChatStore(s => s.selectedChat);
    const setSelectedChat = useTherapyChatStore(s => s.setSelectedChat);
    const messages = useTherapyChatStore(s => s.messages);
    const setMessages = useTherapyChatStore(s => s.setMessages);
    const addMessage = useTherapyChatStore(s => s.addMessage);
    const updateChatDetails = useTherapyChatStore(s => s.updateChatDetails);

    // ✅ FIXED: Added 'search' parameter
    const fetchChats = useCallback(async (search = "", showLoading = true) => {
        if (showLoading) setLoading(true);
        try {
            // ✅ FIXED: Passing 'search' to the API service
            const data = await categoryChatService.getChats(category, search);
            setMessages(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error(error);
            toast.error("Failed to load Therapy chats");
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
            await fetchChats("", false); // Reset search when refreshing after send
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
            await fetchChats("", false);
            return true;
        } catch (err) {
            toast.error("Failed to update status");
            return false;
        }
    };

    return { selectedChat, setSelectedChat, messages, fetchChats, sendMessage, updateStatus, loading, sending };
};