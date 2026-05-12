import { useState, useEffect, useRef } from "react";
import { chatService } from "@/services/chatService";
import { useChatStore } from "@/store/chatStore";
import { toast } from "react-toastify"; 
import { io } from "socket.io-client"; 

export function useChat(role) {
  const [loading, setLoading] = useState(true);
  const setMessages = useChatStore((s) => s.setMessages);
  const addMessage = useChatStore((s) => s.addMessage); 
  const updateMessageStatus = useChatStore((s) => s.updateMessageStatus);
  
  const addNotification = useChatStore((s) => s.addNotification);

  const selectedChat = useChatStore((s) => s.selectedChat);
  const selectedChatRef = useRef(selectedChat);

  useEffect(() => {
    selectedChatRef.current = selectedChat;
  }, [selectedChat]);

  const socketRef = useRef(null);

  const playSafeAudio = (path) => {
    try {
        const audio = new Audio(path);
        audio.play().catch((err) => {
            if (err.name !== "NotAllowedError") {
                console.error("Audio playback error:", err);
            }
        });
    } catch (e) {
        console.error("Audio setup error:", e);
    }
  };

  useEffect(() => {
    if (!role) return;

    const fetchChats = async () => {
      try {
        const data = await chatService.getMessages(role);
        if (data && Array.isArray(data)) {
           const sortedData = data.sort((a, b) => new Date(b.lastSeenAt) - new Date(a.lastSeenAt));
           setMessages(sortedData);
        }
      } catch (err) {
        console.error("Fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchChats();

<<<<<<< HEAD
    // 👇 FIX: Explicitly setup socket connection for live server
    const socketUrl = process.env.NODE_ENV === "production" ? "https://crm.almaaerp.in" : "";
    
    const socket = io(socketUrl, {
      path: "/socket.io/",
      transports: ["websocket", "polling"],
      secure: true,
      rejectUnauthorized: false
=======
    // 👇 FIX: Dynamically resolve the socket URL and configure robust timeout/transports
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || (process.env.NODE_ENV === "production" ? "https://crm.almaaerp.in" : (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"));
    
    const socket = io(socketUrl, {
      path: "/socket.io/",
      transports: ["websocket", "polling"], // Polling first prevents initial timeout failures in dev
      secure: process.env.NODE_ENV === "production",
      rejectUnauthorized: false,
      reconnectionAttempts: 5,
      timeout: 10000 // Increased to 10 seconds
>>>>>>> c1be5bc (Initial commit from new system)
    }); 
    
    socketRef.current = socket;

    socket.on("connect", () => {
<<<<<<< HEAD
        console.log("✅ Socket Connected to Server");
    });

    socket.on("connect_error", (err) => {
        console.error("❌ Socket Connection Error:", err.message);
=======
        console.log("✅ Socket Connected to Server:", socket.id);
    });

    socket.on("connect_error", (err) => {
        console.warn("⚠️ Socket Connection Warning:", err.message);
>>>>>>> c1be5bc (Initial commit from new system)
    });

    socket.on("new_message", (newMessage) => {
        
        addMessage(newMessage);

        if (newMessage.direction === "INBOUND") {
             try {
                const isCurrentChat = selectedChatRef.current?.phone === newMessage.phone;

                let displayName = newMessage.phone.replace("whatsapp:", "");

                const currentMessages = useChatStore.getState().messages;
                const contact = currentMessages.find(c => c.phone === newMessage.phone);

                if (contact && contact.name && contact.name !== contact.phone) {
                    displayName = contact.name;
                } else if (newMessage.name && newMessage.name !== "Unknown" && newMessage.name !== "null" && newMessage.name.trim() !== "") {
                    displayName = newMessage.name;
                }

                if (isCurrentChat) {
                    playSafeAudio("/audio/incoming_message.mp3");
                } else {
                    playSafeAudio("/audio/notification.wav");
                    toast.info(`Message from ${displayName}`);

                    if (addNotification) {
                        addNotification({
                            id: Date.now(),
                            name: displayName,
                            phone: newMessage.phone,
                            message: newMessage.message,
                            timestamp: new Date(),
                            type: 'message',
                            read: false
                        });
                    }
                }
             } catch (e) {
                console.error("Notification Logic Error:", e);
             }
        }
    });

    socket.on("message_status_update", ({ sid, status }) => {

        const state = useChatStore.getState();
        const allChats = state.messages;
        
        allChats.forEach(chat => {
            if (chat.history) {
                const msgToUpdate = chat.history.find(m => m.twilioSid === sid);
                if (msgToUpdate) {
                    updateMessageStatus(chat.phone, msgToUpdate.tempId || msgToUpdate.id, status);
                }
            }
        });
    });

    return () => {
        if (socketRef.current) {
            socketRef.current.disconnect();
        }
    };
    
  }, [role, setMessages, addMessage, updateMessageStatus, addNotification]); 

  return { loading };
}