import React, { useState, useRef, useEffect } from "react";
import { Play, Pause } from "lucide-react";
import { MessageStatusIcon, formatBubbleTime } from "@/shared/utils/chatUtils";

export default function AudioMessage({
  msg,
  currentMsgDate,
  isMe,
}) {
  const mediaUrl = msg.media?.url || msg.mediaUrl;
  const isExpired = msg.media?.status === "EXPIRED" || (!mediaUrl && msg.expiresAt && new Date(msg.expiresAt) <= new Date());

  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(() => {
    const rawDur = Number(msg.media?.duration);
    return Number.isFinite(rawDur) && rawDur > 0 ? rawDur : 0;
  });
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef(null);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  if (isExpired) {
    return (
      <div className="p-3 bg-slate-100 border border-slate-200/80 rounded-xl text-slate-500 text-xs">
        <p className="font-bold text-slate-700">🎵 Audio no longer available</p>
        <p className="text-[11px] text-slate-400 mt-0.5">This media expired after the 60-day retention period.</p>
        <div className="flex justify-end items-center gap-1 mt-1.5">
          <span className="text-[9px] text-slate-400 font-mono">
            {formatBubbleTime(currentMsgDate)}
          </span>
          {isMe && <MessageStatusIcon status={msg.messageStatus || msg.status} />}
        </div>
      </div>
    );
  }

  const togglePlay = (e) => {
    e.stopPropagation();
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => setIsPlaying(true))
          .catch((err) => {
            console.warn("Audio playback error:", err);
            setIsPlaying(false);
          });
      }
    }
  };

  const handleSeek = (e) => {
    e.stopPropagation();
    if (!audioRef.current) return;
    const rect = e.currentTarget?.getBoundingClientRect();
    if (!rect || !rect.width || rect.width <= 0) return;

    const clickX = e.clientX - rect.left;
    if (!Number.isFinite(clickX)) return;

    const newProgress = Math.max(0, Math.min(1, clickX / rect.width));
    if (!Number.isFinite(newProgress)) return;

    const validDuration = Number.isFinite(duration) && duration > 0
      ? duration
      : Number.isFinite(audioRef.current.duration) && audioRef.current.duration > 0 && audioRef.current.duration !== Infinity
      ? audioRef.current.duration
      : 0;

    if (validDuration > 0) {
      const newTime = Math.max(0, Math.min(validDuration, newProgress * validDuration));
      if (Number.isFinite(newTime)) {
        try {
          audioRef.current.currentTime = newTime;
          setCurrentTime(newTime);
        } catch (seekErr) {
          console.warn("Audio seek error:", seekErr);
        }
      }
    }
  };

  const handleMetadataLoaded = () => {
    const d = audioRef.current?.duration;
    if (Number.isFinite(d) && d > 0 && d !== Infinity) {
      setDuration(d);
    }
  };

  const handleTimeUpdate = () => {
    const ct = audioRef.current?.currentTime;
    if (Number.isFinite(ct) && ct >= 0) {
      setCurrentTime(ct);
    }
  };

  const formatTime = (sec) => {
    if (!sec || !Number.isFinite(sec) || isNaN(sec) || sec < 0 || sec === Infinity) return "00:00";
    const mins = Math.floor(sec / 60);
    const secs = Math.floor(sec % 60);
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const progressPercent = Number.isFinite(duration) && duration > 0 && Number.isFinite(currentTime)
    ? Math.max(0, Math.min(100, (currentTime / duration) * 100))
    : 0;

  return (
    <div className="flex flex-col min-w-[240px] max-w-[300px]">
      <audio
        ref={audioRef}
        src={mediaUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleMetadataLoaded}
        onDurationChange={handleMetadataLoaded}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
        }}
        preload="metadata"
      />

      <div className="flex items-center gap-3 py-1">
        {/* Play/Pause Button */}
        <button
          type="button"
          onClick={togglePlay}
          className={`w-10 h-10 rounded-full flex items-center justify-center shadow-xs transition-transform active:scale-95 shrink-0 ${
            isMe
              ? "bg-[#00a884] text-white hover:bg-emerald-600 shadow-emerald-200"
              : "bg-slate-800 text-white hover:bg-slate-700"
          }`}
        >
          {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="translate-x-0.5" />}
        </button>

        {/* Waveform / Progress Slider */}
        <div className="flex-1 flex flex-col justify-center gap-1.5 cursor-pointer" onClick={handleSeek}>
          <div className="w-full h-2 bg-slate-200/80 rounded-full overflow-hidden relative">
            <div
              className={`h-full rounded-full transition-all duration-100 ${
                isMe ? "bg-[#00a884]" : "bg-slate-700"
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono font-medium select-none">
            <span>{formatTime(isPlaying ? currentTime : (duration || currentTime))}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </div>

      {/* Caption if present */}
      {msg.message && !msg.message.startsWith("[Attachment") && (
        <p className="text-[12px] text-slate-700 font-medium mt-1 leading-relaxed break-words px-0.5">
          {msg.message}
        </p>
      )}

      <div className="flex justify-end items-center gap-1 mt-0.5 px-0.5">
        <span className="text-[9px] text-slate-400 font-semibold font-mono tracking-tight select-none uppercase">
          {formatBubbleTime(currentMsgDate)}
        </span>
        {isMe && (
          <span className="scale-[0.85] opacity-80 shrink-0">
            <MessageStatusIcon status={msg.messageStatus || msg.status} />
          </span>
        )}
      </div>
    </div>
  );
}
