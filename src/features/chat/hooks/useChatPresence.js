import { useEffect, useRef } from "react";
import { connectSocket } from "@/features/chat/services/socketService";
import { usePresenceStore } from "@/features/chat/stores/presenceStore";
import { useSession } from "next-auth/react";

export function useChatPresence(selectedChatPhone) {
  const { data: session } = useSession();
  const syncHandlers = usePresenceStore((s) => s.syncHandlers);
  const setHandler = usePresenceStore((s) => s.setHandler);
  const removeHandler = usePresenceStore((s) => s.removeHandler);

  const selectedPhoneRef = useRef(selectedChatPhone);

  useEffect(() => {
    selectedPhoneRef.current = selectedChatPhone;
  }, [selectedChatPhone]);

  useEffect(() => {
    const socket = connectSocket();

    const onSync = (handlersArray) => {
      syncHandlers(handlersArray);
    };

    const onHandled = ({ phone, handler }) => {
      setHandler(phone, handler);
    };

    const onUnhandled = ({ phone }) => {
      removeHandler(phone);
    };

    const onLockUpdated = ({ phone, handler }) => {
      setHandler(phone, handler);
    };


    socket.on("sync_active_handlers", onSync);
    socket.on("chat_handled", onHandled);
    socket.on("chat_unhandled", onUnhandled);
    socket.on("chat_lock_updated", onLockUpdated);
    

    // Request sync on mount
    socket.emit("request_active_handlers");

    return () => {
      socket.off("sync_active_handlers", onSync);
      socket.off("chat_handled", onHandled);
      socket.off("chat_unhandled", onUnhandled);
      socket.off("chat_lock_updated", onLockUpdated);
      
    };
  }, [syncHandlers, setHandler, removeHandler]);

  // Handle joining and leaving chats
  useEffect(() => {
    if (!session?.user) return;
    const socket = connectSocket();
    
    if (selectedChatPhone) {
      socket.emit("join_chat", { 
        phone: selectedChatPhone, 
        user: { 
          name: session.user.name, 
          email: session.user.email, 
          id: session.user.id || session.user.email,
          role: session.user.role,
          department: session.user.department
        } 
      });

      // Start pinging to keep alive
      const interval = setInterval(() => {
        socket.emit("ping_chat", { phone: selectedChatPhone });
      }, 30000); // 30 seconds

      return () => {
        clearInterval(interval);
        socket.emit("leave_chat", { phone: selectedChatPhone });
      };
    }
  }, [selectedChatPhone, session]);
}
