export const categoryChatService = {
    // Add search parameter here
    getChats: async (category, search = "") => {
        let url = `/api/category-chats/${category}`;
        if (search) {
            url += `?search=${encodeURIComponent(search)}`;
        }
        
        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to fetch chats");
        return await res.json();
    },

    sendMessage: async (category, phone, message) => {
        const res = await fetch(`/api/category-chats/${category}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phone, message }),
        });
        if (!res.ok) throw new Error("Failed to send message");
        return await res.json();
    },

    updateStatus: async (category, phone, status) => {
        const res = await fetch(`/api/category-leads-update/${category}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phone, status }),
        });
        if (!res.ok) throw new Error("Failed to update status");
        return await res.json();
    }
};