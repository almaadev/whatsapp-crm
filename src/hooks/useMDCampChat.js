import { useState, useCallback } from 'react';
import { categoryChatService } from '@/services/categoryChatService';
import { toast } from 'react-toastify';
import { useMDCampChatStore } from '@/store/mdcampChatStore';

export const useMDCampChat = () => {
    const category = 'mdcamp';
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);

    const selectedChat = useMDCampChatStore(s => s.selectedChat);
    const setSelectedChat = useMDCampChatStore(s => s.setSelectedChat);
    const messages = useMDCampChatStore(s => s.messages);
    const setMessages = useMDCampChatStore(s => s.setMessages);
    const addMessage = useMDCampChatStore(s => s.addMessage);
    const updateChatDetails = useMDCampChatStore(s => s.updateChatDetails);

    // ✅ FIXED: Added 'search' parameter
    const fetchChats = useCallback(async (search = "", showLoading = true) => {
        if (showLoading) setLoading(true);
        try {
            // ✅ FIXED: Passing 'search' to the API service
            const data = await categoryChatService.getChats(category, search);
            setMessages(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error(error);
            toast.error("Failed to load MD Camp chats");
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