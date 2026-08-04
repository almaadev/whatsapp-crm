import { notificationAudioService } from "@/shared/services/notificationAudioService";

export const playSafeAudio = (path) => {
  if (typeof window === "undefined" || !path) return;
  if (path.includes("incoming_message.mp3")) {
    notificationAudioService.playIncomingSound();
  } else if (path.includes("notification.wav")) {
    notificationAudioService.playNotificationSound();
  } else {
    notificationAudioService.playNotificationSound();
  }
};