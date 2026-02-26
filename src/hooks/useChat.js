import { useState, useEffect, useRef } from "react";
import { chatService } from "@/services/chatService";
import { useChatStore } from "@/store/chatStore";
import { toast } from "react-toastify"; 
import { io } from "socket.io-client"; 

export function useChat(role) {
  const [loading, setLoading] = useState(true);
  const setMessages = useChatStore((s) => s.setMessages);
  const addMessage = useChatStore((s) => s.addMessage); 
  const updateChatDetails = useChatStore((s) => s.updateChatDetails);
  
  // Connect to the Notification Store Action
  const addNotification = useChatStore((s) => s.addNotification);

  const selectedChat = useChatStore((s) => s.selectedChat);
  const selectedChatRef = useRef(selectedChat);

  useEffect(() => {
    selectedChatRef.current = selectedChat;
  }, [selectedChat]);

  const socketRef = useRef(null);

  // --- NEW HELPER: Safely play audio without console errors ---
  const playSafeAudio = (path) => {
    try {
        const audio = new Audio(path);
        audio.play().catch((err) => {
            // Ignore 'NotAllowedError' (Browser Autoplay Policy)
            if (err.name !== "NotAllowedError") {
                console.error("Audio playback error:", err);
            }
        });
    } catch (e) {
        console.error("Audio setup error:", e);
    }
  };
  // ------------------------------------------------------------

  useEffect(() => {
    if (!role) return;

    // 1. Initial Load
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

    // 2. Setup Socket
    const socket = io(); 
    socketRef.current = socket;

    socket.on("connect", () => {
        console.log("✅ Socket Connected to Server");
    });

    // 3. Listen for Real-time Messages
    socket.on("new_message", (newMessage) => {
        
        addMessage(newMessage);

        if (newMessage.direction === "INBOUND") {
             try {
                const isCurrentChat = selectedChatRef.current?.phone === newMessage.phone;

                // Name Logic: Default to formatted number
                let displayName = newMessage.phone.replace("whatsapp:", "");

                // Check store for saved contact name
                const currentMessages = useChatStore.getState().messages;
                const contact = currentMessages.find(c => c.phone === newMessage.phone);

                if (contact && contact.name && contact.name !== contact.phone) {
                    displayName = contact.name;
                } else if (newMessage.name && newMessage.name !== "Unknown" && newMessage.name !== "null" && newMessage.name.trim() !== "") {
                    displayName = newMessage.name;
                }

                if (isCurrentChat) {
                    // Scenario 1: Open Chat -> Just Sound (Safe Play)
                    playSafeAudio("/audio/incoming_message.mp3");
                } else {
                    // Scenario 2: Background -> Notification Sound + Toast + Panel
                    playSafeAudio("/audio/notification.wav");
                    
                    // Show Toast
                    toast.info(`Message from ${displayName}`);

                    // Add to Notification Panel
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

    return () => {
        if (socketRef.current) {
            socketRef.current.disconnect();
        }
    };
    
  }, [role, setMessages, addMessage, addNotification]); 

  return { loading };
}