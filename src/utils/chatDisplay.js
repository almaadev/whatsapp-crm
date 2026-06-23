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
