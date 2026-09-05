"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";

/**
 * Calculates current total online & offline seconds based on server session data.
 */
export function calculateClientDurations(sessionData) {
  if (!sessionData || !sessionData.loginAt) {
    return { onlineSeconds: 0, offlineSeconds: 0 };
  }

  const now = Date.now();
  let onlineSec = 0;
  let offlineSec = 0;

  const segments = sessionData.segments || [];

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const onlineFrom = seg.onlineFrom ? new Date(seg.onlineFrom).getTime() : null;
    const offlineAt = seg.offlineAt ? new Date(seg.offlineAt).getTime() : null;
    const onlineAt = seg.onlineAt ? new Date(seg.onlineAt).getTime() : null;

    if (onlineFrom) {
      if (offlineAt) {
        // Completed segment
        onlineSec += Math.max(0, Math.floor((offlineAt - onlineFrom) / 1000));
        if (onlineAt && onlineAt > offlineAt) {
          offlineSec += Math.max(0, Math.floor((onlineAt - offlineAt) / 1000));
        }
      } else {
        // Active open segment
        if (sessionData.status === "online") {
          onlineSec += Math.max(0, Math.floor((now - onlineFrom) / 1000));
        } else if (sessionData.status === "offline") {
          const offlinePoint = sessionData.lastHeartbeatAt
            ? new Date(sessionData.lastHeartbeatAt).getTime()
            : onlineFrom;
          onlineSec += Math.max(0, Math.floor((offlinePoint - onlineFrom) / 1000));
          offlineSec += Math.max(0, Math.floor((now - offlinePoint) / 1000));
        }
      }
    }
  }

  // Fallback if no segments recorded yet
  if (segments.length === 0 && sessionData.loginAt) {
    const start = new Date(sessionData.loginAt).getTime();
    onlineSec = Math.max(0, Math.floor((now - start) / 1000));
  }

  return { onlineSeconds: onlineSec, offlineSeconds: offlineSec };
}

export function formatDurationHHMMSS(totalSeconds) {
  if (isNaN(totalSeconds) || totalSeconds < 0) return "00:00:00";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return [hours, minutes, seconds].map((v) => String(v).padStart(2, "0")).join(":");
}

export function formatDurationHuman(totalSeconds) {
  if (isNaN(totalSeconds) || totalSeconds <= 0) return "0m";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

export function useAssociateSession() {
  const { data: authSession, status: authStatus } = useSession();
  const [session, setSession] = useState(null);
  const [isOnline, setIsOnline] = useState(true);
  const [onlineSeconds, setOnlineSeconds] = useState(0);
  const [offlineSeconds, setOfflineSeconds] = useState(0);
  const [loading, setLoading] = useState(true);

  const sessionRef = useRef(null);
  const heartbeatTimerRef = useRef(null);
  const secondTimerRef = useRef(null);
  const heartbeatInFlightRef = useRef(false);
  const failedHeartbeatsRef = useRef(0);
  const isMountedRef = useRef(true);

  // Synchronize session state to mutable ref to avoid effect dependency churn
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  // 1. Fetch current active session from server (on initial auth or explicit manual refresh)
  const fetchCurrentSession = useCallback(async () => {
    if (authStatus !== "authenticated" || !authSession?.user?.id) return;
    try {
      const res = await fetch("/api/associate-session/current");
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.session && isMountedRef.current) {
          sessionRef.current = data.session;
          setSession(data.session);
          setIsOnline(data.session.status === "online");
          const { onlineSeconds: onSec, offlineSeconds: offSec } = calculateClientDurations(data.session);
          setOnlineSeconds(onSec);
          setOfflineSeconds(offSec);
        }
      }
    } catch (err) {
      console.error("[useAssociateSession] fetchCurrentSession failed:", err);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [authStatus, authSession?.user?.id]);

  // 2. Send heartbeat to server (in-flight protected & tab-visibility aware)
  const sendHeartbeat = useCallback(async (options = { force: false }) => {
    if (authStatus !== "authenticated" || !authSession?.user?.id) return;

    if (typeof window !== "undefined" && !navigator.onLine) {
      setIsOnline(false);
      return;
    }

    if (typeof document !== "undefined" && document.visibilityState === "hidden" && !options.force) {
      if (process.env.NODE_ENV === "development") {
        console.log("[HEARTBEAT] skipped - tab hidden");
      }
      return;
    }

    if (heartbeatInFlightRef.current) {
      if (process.env.NODE_ENV === "development") {
        console.log("[HEARTBEAT] skipped - request already in flight");
      }
      return;
    }

    heartbeatInFlightRef.current = true;
    if (process.env.NODE_ENV === "development") {
      console.log("[HEARTBEAT] sent");
    }

    try {
      const currentSessionId = sessionRef.current?.sessionId || sessionRef.current?._id;
      const res = await fetch("/api/associate-session/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: currentSessionId })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.session && isMountedRef.current) {
          failedHeartbeatsRef.current = 0;
          sessionRef.current = data.session;
          setSession(data.session);
          setIsOnline(data.session.status === "online");

          const { onlineSeconds: onSec, offlineSeconds: offSec } = calculateClientDurations(data.session);
          setOnlineSeconds(onSec);
          setOfflineSeconds(offSec);
        }
      } else {
        failedHeartbeatsRef.current += 1;
        if (failedHeartbeatsRef.current >= 3 && isMountedRef.current) {
          setIsOnline(false);
        }
      }
    } catch (err) {
      failedHeartbeatsRef.current += 1;
      if (failedHeartbeatsRef.current >= 3 && isMountedRef.current) {
        setIsOnline(false);
      }
    } finally {
      heartbeatInFlightRef.current = false;
    }
  }, [authStatus, authSession?.user?.id]);

  // 3. Controlled Heartbeat Lifecycle (single timer keyed strictly to user authentication)
  useEffect(() => {
    if (authStatus !== "authenticated" || !authSession?.user?.id) {
      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = null;
        if (process.env.NODE_ENV === "development") {
          console.log("[HEARTBEAT] stopped");
        }
      }
      return;
    }

    isMountedRef.current = true;

    // A. Initial fetch and immediate heartbeat synchronization
    fetchCurrentSession().then(() => {
      if (isMountedRef.current) {
        sendHeartbeat({ force: true });
      }
    });

    if (process.env.NODE_ENV === "development") {
      console.log("[HEARTBEAT] started (interval: 60s)");
    }

    // B. Single 60-Second Recurring Heartbeat Interval
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
    }

    heartbeatTimerRef.current = setInterval(() => {
      sendHeartbeat();
    }, 60000);

    // C. Visibility Change Listener (immediate ping on tab focus if visible)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        sendHeartbeat({ force: true });
      }
    };

    // D. Online/Offline Network Listeners
    const handleOnline = () => {
      setIsOnline(true);
      sendHeartbeat({ force: true });
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      isMountedRef.current = false;
      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = null;
        if (process.env.NODE_ENV === "development") {
          console.log("[HEARTBEAT] stopped");
        }
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [authStatus, authSession?.user?.id, fetchCurrentSession, sendHeartbeat]);

  // 4. Local 1-Second Timer Increment for Realtime Display (no network traffic)
  useEffect(() => {
    if (!session || session.status === "logged_out") return;

    if (secondTimerRef.current) {
      clearInterval(secondTimerRef.current);
    }

    secondTimerRef.current = setInterval(() => {
      if (isOnline && sessionRef.current?.status !== "offline") {
        setOnlineSeconds((prev) => prev + 1);
      } else {
        setOfflineSeconds((prev) => prev + 1);
      }
    }, 1000);

    return () => {
      if (secondTimerRef.current) {
        clearInterval(secondTimerRef.current);
        secondTimerRef.current = null;
      }
    };
  }, [session?.status, isOnline]);

  return {
    session,
    isOnline: isOnline && session?.status === "online",
    status: session?.status || (isOnline ? "online" : "offline"),
    loginAt: session?.loginAt ? new Date(session.loginAt) : null,
    onlineSeconds,
    offlineSeconds,
    formattedTimer: formatDurationHHMMSS(onlineSeconds),
    formattedOffline: formatDurationHHMMSS(offlineSeconds),
    humanTimer: formatDurationHuman(onlineSeconds),
    humanOffline: formatDurationHuman(offlineSeconds),
    loading,
    refreshSession: fetchCurrentSession
  };
}
