import api from "@/lib/axios";

export const categoryChatService = {

getChats: async (category, search = "") => {
let url = `/api/category-chats/${category}`;
if (search) {
url += `?search=${encodeURIComponent(search)}`;
}

const { data } = await api.get(url);
return data;
},

sendMessage: async (category, phone, message) => {
const { data } = await api.post(`/api/category-chats/${category}`, { phone, message });
return data;
},

updateStatus: async (category, phone, status) => {
const { data } = await api.post(`/api/category-leads-update/${category}`, { phone, status });
return data;
}

};