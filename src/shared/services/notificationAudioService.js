import { useChatStore } from "@/features/chat/stores/chatStore";
import { resolveCustomerDisplayName } from "@/shared/utils/customerResolver";
import { showChatNotification } from "@/shared/utils/notification";

/**
 * Centralized Enterprise Notification Audio & Browser Notification Service.
 * Preloads audio instances once during app startup, unlocks browser audio context on first gesture,
 * reuses cached memory objects via cloneNode, deduplicates event emissions, and enforces strict single-trigger audio playback rules.
 */
class NotificationAudioService {
  constructor() {
    this.incomingAudio = null;
    this.notificationAudio = null;
    this.isPreloaded = false;
    this.isUnlocked = false;
    this.processedMessageIds = new Map(); // key: msgId -> timestamp
  }

  /**
   * Unlock browser audio playback policy on the very first user interaction anywhere on page.
   */
  unlockAudioOnFirstInteraction() {
    if (typeof window === "undefined" || this.isUnlocked) return;

    const unlock = () => {
      if (this.isUnlocked) return;
      this.isUnlocked = true;
      console.log("🔓 [NotificationAudioService] Audio unlocked via first user gesture.");

      if (this.incomingAudio) {
        this.incomingAudio.play().then(() => {
          this.incomingAudio.pause();
          this.incomingAudio.currentTime = 0;
        }).catch(() => {});
      }
      if (this.notificationAudio) {
        this.notificationAudio.play().then(() => {
          this.notificationAudio.pause();
          this.notificationAudio.currentTime = 0;
        }).catch(() => {});
      }

      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("click", unlock);
    };

    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    window.addEventListener("click", unlock, { once: true });
  }

  /**
   * Preload both audio files in memory once.
   */
  preload() {
    if (typeof window === "undefined" || this.isPreloaded) return;

    try {
      this.incomingAudio = new Audio("/audio/incoming_message.mp3");
      this.incomingAudio.preload = "auto";

      this.notificationAudio = new Audio("/audio/notification.wav");
      this.notificationAudio.preload = "auto";

      this.isPreloaded = true;
      this.unlockAudioOnFirstInteraction();
      console.log("🔊 [NotificationAudioService] Preloaded audio files into memory.");
    } catch (err) {
      console.error("[NotificationAudioService] Error preloading audio:", err);
    }
  }

  /**
   * Safe, low-latency audio playback helper reusing preloaded buffer.
   */
  privatePlayAudio(audioElement, soundName) {
    this.preload();
    if (!audioElement) return;

    console.log(`[Audio] play() called | File: ${soundName}`);

    try {
      // cloneNode(true) reuses the preloaded audio buffer without state locking or ended conflicts
      const clone = audioElement.cloneNode(true);
      clone.currentTime = 0;
      const playPromise = clone.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            console.log(`[Audio] HTMLAudioElement.play() resolved | File: ${soundName}`);
          })
          .catch((err) => {
            if (
              err.name !== "NotAllowedError" &&
              err.name !== "AbortError" &&
              err.name !== "NotSupportedError"
            ) {
              console.warn(`[NotificationAudioService] ${soundName} playback warning:`, err.message);
            }
          });
      }
    } catch (e) {
      console.error(`[NotificationAudioService] ${soundName} error:`, e);
    }
  }

  /**
   * Play incoming_message.mp3 (ONLY for currently active conversation)
   */
  playIncomingSound() {
    this.privatePlayAudio(this.incomingAudio, "incoming_message.mp3");
  }

  /**
   * Play notification.wav (ONLY for background / other conversations)
   */
  playNotificationSound() {
    this.privatePlayAudio(this.notificationAudio, "notification.wav");
  }

  /**
   * Display native browser notification if tab is in background
   */
  showBrowserNotification(title, body, phone) {
    if (typeof window === "undefined" || !("Notification" in window)) return;

    if (Notification.permission === "granted") {
      try {
        new Notification(title, {
          body,
          icon: "/logo/logo.png",
          tag: phone || "whatsapp-crm-msg",
        });
      } catch (e) {}
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission();
    }
  }

  /**
   * Deduplicate message events within a 10-second window.
   * Returns true if message is NEW and UNIQUE.
   */
  isUniqueMessage(msg) {
    if (!msg) return false;

    const id =
      msg.twilioSid ||
      msg.tempId ||
      msg._id ||
      `${msg.phone}_${msg.timestamp || ""}_${msg.message || ""}`;

    const now = Date.now();

    // Clean old entries (> 10s)
    for (const [key, time] of this.processedMessageIds.entries()) {
      if (now - time > 10000) {
        this.processedMessageIds.delete(key);
      }
    }

    if (this.processedMessageIds.has(id)) {
      console.log(`🔇 [NotificationAudioService] Duplicate message suppressed: ${id}`);
      return false;
    }

    this.processedMessageIds.set(id, now);
    return true;
  }

  /**
   * Main entry point for processing incoming audio & notification logic.
   * Enforces Cases 1, 2, 3, 4, 5 strictly.
   */
  handleMessageNotification(msg) {
    // Case 4: Outgoing messages never play audio
    if (!msg || msg.direction !== "INBOUND") {
      return;
    }

    // Deduplicate event triggers
    if (!this.isUniqueMessage(msg)) {
      return;
    }

    try {
      const state = useChatStore.getState();
      const selectedChat = state.selectedChat;
      const isCurrentConversationOpen = selectedChat?.phone === msg.phone;
      const isTabActive = typeof document !== "undefined" && document.visibilityState === "visible";

      const contact = state.messages.find((item) => item.phone === msg.phone);
      const displayName = resolveCustomerDisplayName(contact || msg || { phone: msg.phone, name: msg.name });

      if (isCurrentConversationOpen) {
        // Case 1: Active conversation -> incoming_message.mp3 ONCE
        this.playIncomingSound();
      } else {
        // Case 2 & Case 3: Other conversation or background tab -> notification.wav ONCE
        this.playNotificationSound();

        // UI Toast & internal notification list update
        showChatNotification({
          displayName,
          phone: msg.phone,
          message: msg.message,
          addNotification: state.addNotification,
        });

        // Case 3: Background tab native notification
        if (!isTabActive) {
          this.showBrowserNotification(`New message from ${displayName}`, msg.message || "Media message", msg.phone);
        }
      }
    } catch (err) {
      console.error("[NotificationAudioService] Error processing notification:", err);
    }
  }
}

export const notificationAudioService = new NotificationAudioService();
