import { toast } from "react-toastify";

export const showChatNotification = ({
  displayName,
  phone,
  message,
  addNotification,
}) => {
  console.log(`[Notification] Created | For: ${displayName}`);

  toast.info(`Message from ${displayName}`);

  if (!addNotification) return;

  addNotification({
    id: Date.now(),
    name: displayName,
    phone,
    message,
    timestamp: new Date(),
    type: "message",
    read: false,
  });
};
