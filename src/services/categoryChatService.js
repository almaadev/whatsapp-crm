export const categoryChatService = {
    getChats: async (category) => {
        const response = await fetch(`/api/category-chats/${category}`);
        if (!response.ok) throw new Error(`Failed to fetch ${category} chats`);
        return response.json();
    },
    
    sendMessage: async (category, phone, message) => {
        const response = await fetch(`/api/category-chats/${category}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone, message })
        });
        if (!response.ok) throw new Error('Failed to send message');
        return response.json();
    },
    
    updateStatus: async (category, phone, status) => {
        const response = await fetch(`/api/category-leads-update/${category}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mobile: phone, status })
        });
        if (!response.ok) throw new Error('Failed to update status');
        return response.json();
    }
};