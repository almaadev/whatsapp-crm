export function formatSafeTime(timeStr) {
  if (!timeStr) return "";
  try {
    const d = new Date(timeStr);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export function getDisplayMessage(chat, emptyFallback = "No messages yet") {
  if (!chat) return emptyFallback;

  const lastMsg = chat.history?.length > 0 ? chat.history[chat.history.length - 1] : null;
  if (lastMsg) {
    if (lastMsg.message?.trim()) return lastMsg.message;
    if (lastMsg.mediaUrl) {
      const mType = (lastMsg.mediaType || "").toLowerCase();
      const mUrl = lastMsg.mediaUrl.toLowerCase();
      if (mType.includes("video") || mUrl.endsWith(".mp4")) return "🎥 Video";
      if (mType.includes("audio") || mUrl.match(/\.(mp3|ogg|wav)$/)) return "🎵 Audio";
      if (mType.includes("pdf") || mUrl.endsWith(".pdf")) return "📄 Document";
      return "📷 Photo";
    }
  }

  return chat.message || emptyFallback;
}

export function getChatMessagePreview(chat, currentUser, emptyFallback = "No messages yet") {
  if (!chat) return emptyFallback;

  const lastMsg = chat.history?.length > 0 ? chat.history[chat.history.length - 1] : null;
  
  let content = "";
  if (lastMsg) {
    if (lastMsg.message?.trim()) {
      content = lastMsg.message;
    } else if (lastMsg.mediaUrl) {
      const mType = (lastMsg.mediaType || "").toLowerCase();
      const mUrl = lastMsg.mediaUrl.toLowerCase();
      if (mType.includes("video") || mUrl.endsWith(".mp4")) content = "🎥 Video";
      else if (mType.includes("audio") || mUrl.match(/\.(mp3|ogg|wav)$/)) content = "🎵 Audio";
      else if (mType.includes("pdf") || mUrl.endsWith(".pdf")) content = "📄 Document";
      else content = "📷 Photo";
    }
  } else {
    content = chat.message || "";
  }

  if (!content.trim()) return emptyFallback;

  const direction = lastMsg ? lastMsg.direction : chat.direction;
  if (direction === "OUTBOUND") {
    const isAutomated = lastMsg
      ? (lastMsg.isAutomated === true ||
         lastMsg.senderType === "system" ||
         lastMsg.senderType === "automation" ||
         lastMsg.senderName === "Auto Answer" ||
         lastMsg.senderName === "System Automation" ||
         lastMsg.senderName === "System" ||
         lastMsg.senderName === "Twilio bot")
      : (chat.isAutomated === true ||
         chat.senderType === "system" ||
         chat.senderType === "automation" ||
         chat.senderName === "Auto Answer" ||
         chat.senderName === "System Automation" ||
         chat.senderName === "System" ||
         chat.senderName === "Twilio bot");

    if (isAutomated) {
      return `Auto Answer: ${content}`;
    }

    const sendByField = lastMsg ? lastMsg.sendBy : chat.sendBy;
    
    if (!sendByField) {
      return `Unknown User: ${content}`;
    }

    let senderId = "";
    let senderName = "Unknown User";

    if (typeof sendByField === "object" && sendByField !== null) {
      senderId = sendByField._id ? sendByField._id.toString() : "";
      senderName = sendByField.name || "Unknown User";
    } else {
      senderId = sendByField.toString();
      senderName = "Unknown User";
    }

    const currentUserId = currentUser?.id || currentUser?._id;
    
    if (currentUserId && senderId && currentUserId.toString() === senderId) {
      return `You: ${content}`;
    }
    
    return `${senderName}: ${content}`;
  }

  return content;
}
