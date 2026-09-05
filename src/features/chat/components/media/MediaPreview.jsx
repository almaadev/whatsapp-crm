import React, { useState, useEffect, useRef } from "react";
import { X, Send, FileText, Music, Play, Pause, AlertCircle, Loader2, Sparkles } from "lucide-react";
import { formatBytes } from "@/features/chat/services/mediaService";

export default function MediaPreview({
  mediaItem, // { file, mediaType, previewUrl, originalSize, compressedSize, savingsPercent, wasCompressed, isCompressing, compressionProgress, error }
  caption,
  setCaption,
  onCancel,
  onSend,
  isSending,
  uploadProgress,
  stageText,
}) {
  const audioRef = useRef(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [isAudioSeeking, setIsAudioSeeking] = useState(false);
  const [audioError, setAudioError] = useState(false);

  const previewUrl = mediaItem?.previewUrl;
  const mediaType = mediaItem?.mediaType || "image";

  // Helper to format MM:SS
  const formatTime = (sec) => {
    if (!sec || !Number.isFinite(sec) || isNaN(sec) || sec < 0 || sec === Infinity) return "00:00";
    const mins = Math.floor(sec / 60);
    const secs = Math.floor(sec % 60);
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  // Reset audio playback on preview change or unmount
  useEffect(() => {
    setIsPlayingAudio(false);
    setAudioCurrentTime(0);
    setAudioDuration(0);
    setAudioError(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    };
  }, [previewUrl]);

  const handleClose = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    onCancel?.();
  };

  const toggleAudioPlay = () => {
    if (!audioRef.current || audioError) return;
    if (isPlayingAudio) {
      audioRef.current.pause();
      setIsPlayingAudio(false);
    } else {
      if (audioRef.current.ended || audioRef.current.currentTime >= audioDuration) {
        audioRef.current.currentTime = 0;
      }
      audioRef.current
        .play()
        .then(() => setIsPlayingAudio(true))
        .catch((err) => {
          console.warn("Audio playback error:", err);
          setIsPlayingAudio(false);
        });
    }
  };

  const handleAudioTimeUpdate = () => {
    if (!isAudioSeeking && audioRef.current) {
      const ct = audioRef.current.currentTime;
      if (Number.isFinite(ct) && ct >= 0) {
        setAudioCurrentTime(ct);
      }
    }
  };

  const handleAudioLoadedMetadata = () => {
    if (audioRef.current) {
      const d = audioRef.current.duration;
      if (Number.isFinite(d) && d > 0 && d !== Infinity) {
        setAudioDuration(d);
      }
    }
  };

  const handleAudioEnded = () => {
    setIsPlayingAudio(false);
    setAudioCurrentTime(0);
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
    }
  };

  if (!mediaItem) return null;

  const {
    file,
    originalSize = file?.size || 0,
    compressedSize = file?.size || 0,
    savingsPercent = 0,
    wasCompressed = false,
    isCompressing = false,
    compressionProgress = 0,
    error = null,
  } = mediaItem;

  const isActionDisabled = isSending || isCompressing || Boolean(error);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 md:p-6 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#00a884]" />
            <h3 className="text-sm font-bold text-slate-800 tracking-tight">
              Preview {mediaType === "image" ? "Photo" : mediaType === "video" ? "Video" : mediaType === "audio" ? "Audio" : "Document"}
            </h3>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isSending}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200/60 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Preview Body */}
        <div className="p-5 flex-1 overflow-y-auto custom-scrollbar flex flex-col items-center justify-center min-h-[220px]">
          {/* IMAGE PREVIEW */}
          {mediaType === "image" && (
            <div className="relative w-full flex flex-col items-center">
              <div className="relative max-h-64 rounded-2xl overflow-hidden shadow-md border border-slate-200/80 bg-slate-900/5">
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="max-h-64 w-auto object-contain rounded-2xl"
                />
              </div>
              <div className="w-full mt-3 flex items-center justify-between text-xs text-slate-600 px-1">
                <span className="font-semibold truncate max-w-[200px]">{file?.name}</span>
                <span className="font-mono text-slate-500 font-bold">{formatBytes(compressedSize || originalSize)}</span>
              </div>
              {wasCompressed && (
                <div className="w-full mt-1.5 flex items-center justify-between px-2 py-1 bg-emerald-50 text-emerald-700 text-[11px] rounded-lg border border-emerald-200 font-medium">
                  <span className="flex items-center gap-1">
                    <Sparkles size={12} /> Original: {formatBytes(originalSize)} → Compressed: {formatBytes(compressedSize)}
                  </span>
                  <span className="font-bold">✓ Saved {savingsPercent}%</span>
                </div>
              )}
            </div>
          )}

          {/* VIDEO PREVIEW */}
          {mediaType === "video" && (
            <div className="relative w-full flex flex-col items-center">
              <div className="relative w-full max-h-64 rounded-2xl overflow-hidden shadow-md border border-slate-200/80 bg-black flex items-center justify-center">
                <video
                  src={previewUrl}
                  controls
                  className="max-h-64 w-full object-contain rounded-2xl"
                />
              </div>
              <div className="w-full mt-3 flex items-center justify-between text-xs text-slate-600 px-1">
                <span className="font-semibold truncate max-w-[200px]">{file?.name}</span>
                <span className="font-mono text-slate-500 font-bold">{formatBytes(compressedSize || originalSize)}</span>
              </div>
              {isCompressing && (
                <div className="w-full mt-3 p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-xs">
                  <div className="flex justify-between font-bold mb-1.5">
                    <span>Compressing video...</span>
                    <span>{compressionProgress}%</span>
                  </div>
                  <div className="w-full bg-amber-200/60 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-amber-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${compressionProgress}%` }}
                    />
                  </div>
                </div>
              )}
              {!isCompressing && wasCompressed && (
                <div className="w-full mt-1.5 flex items-center justify-between px-2 py-1 bg-emerald-50 text-emerald-700 text-[11px] rounded-lg border border-emerald-200 font-medium">
                  <span>Original: {formatBytes(originalSize)} → Compressed: {formatBytes(compressedSize)}</span>
                  <span className="font-bold">✓ Saved {savingsPercent}%</span>
                </div>
              )}
            </div>
          )}

          {/* PDF DOCUMENT PREVIEW */}
          {mediaType === "document" && (
            <div className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 text-rose-500 flex items-center justify-center shrink-0 shadow-xs">
                <FileText size={28} />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-bold text-slate-800 truncate">{file?.name}</h4>
                <p className="text-xs text-slate-400 font-mono mt-0.5">{formatBytes(file?.size || 0)} • PDF Document</p>
              </div>
            </div>
          )}

          {/* AUDIO PREVIEW - WHATSAPP STYLE PROGRESS TRACKER */}
          {mediaType === "audio" && (
            <div className="w-full p-4 bg-slate-50 border border-slate-200/90 rounded-2xl flex flex-col gap-3">
              <audio
                ref={audioRef}
                src={previewUrl}
                onTimeUpdate={handleAudioTimeUpdate}
                onLoadedMetadata={handleAudioLoadedMetadata}
                onDurationChange={handleAudioLoadedMetadata}
                onEnded={handleAudioEnded}
                onError={() => setAudioError(true)}
                preload="metadata"
              />

              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-200 text-[#00a884] flex items-center justify-center shrink-0 shadow-xs">
                  <Music size={22} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold text-slate-800 truncate" title={file?.name || "Audio File"}>
                    {file?.name || "Audio Message"}
                  </h4>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    {formatBytes(compressedSize || originalSize || file?.size || 0)} • Audio
                  </p>
                </div>
              </div>

              {audioError ? (
                <div className="p-3 bg-red-50 text-red-600 border border-red-200 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0 text-red-500" />
                  <span>Unable to play audio preview. The file can still be sent.</span>
                </div>
              ) : (
                <div className="w-full bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
                  {/* Play / Pause Button */}
                  <button
                    type="button"
                    onClick={toggleAudioPlay}
                    className="w-9 h-9 rounded-xl bg-[#00a884] text-white flex items-center justify-center shadow-xs hover:bg-emerald-600 active:scale-95 transition-all shrink-0"
                    title={isPlayingAudio ? "Pause" : "Play"}
                  >
                    {isPlayingAudio ? (
                      <Pause size={16} fill="currentColor" />
                    ) : (
                      <Play size={16} fill="currentColor" className="translate-x-0.5" />
                    )}
                  </button>

                  {/* Progress Tracker / Seek Bar */}
                  <div className="flex-1 flex items-center gap-2.5 min-w-0">
                    <input
                      type="range"
                      min="0"
                      max={audioDuration > 0 ? audioDuration : 1}
                      step="0.05"
                      value={audioCurrentTime}
                      onMouseDown={() => setIsAudioSeeking(true)}
                      onTouchStart={() => setIsAudioSeeking(true)}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (Number.isFinite(val)) setAudioCurrentTime(val);
                      }}
                      onMouseUp={(e) => {
                        setIsAudioSeeking(false);
                        const val = parseFloat(e.target.value);
                        if (Number.isFinite(val) && audioRef.current) {
                          audioRef.current.currentTime = val;
                          setAudioCurrentTime(val);
                        }
                      }}
                      onTouchEnd={(e) => {
                        setIsAudioSeeking(false);
                        const val = parseFloat(e.target.value);
                        if (Number.isFinite(val) && audioRef.current) {
                          audioRef.current.currentTime = val;
                          setAudioCurrentTime(val);
                        }
                      }}
                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#00a884] focus:outline-none"
                    />
                    <span className="text-[11px] font-mono font-bold text-slate-500 shrink-0 select-none">
                      {formatTime(audioCurrentTime)} / {formatTime(audioDuration)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Error Message Display */}
          {error && (
            <div className="w-full mt-3 p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Upload Progress Bar (when uploading/sending) */}
          {isSending && (
            <div className="w-full mt-4 p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-900 text-xs">
              <div className="flex justify-between font-bold mb-1.5">
                <span className="flex items-center gap-1.5">
                  <Loader2 size={13} className="animate-spin text-emerald-600" />
                  {stageText || "Uploading to server..."}
                </span>
                <span>{uploadProgress || 0}%</span>
              </div>
              <div className="w-full bg-emerald-200/60 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-[#00a884] h-2 rounded-full transition-all duration-200"
                  style={{ width: `${uploadProgress || 0}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Caption Input */}
        <div className="px-5 py-2 border-t border-slate-100 bg-slate-50/50">
          <input
            type="text"
            placeholder="Add a caption..."
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            disabled={isActionDisabled}
            className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 placeholder:text-slate-400 outline-none focus:border-[#00a884] focus:ring-2 focus:ring-emerald-500/10 shadow-xs"
          />
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between p-4 border-t border-slate-100 bg-white">
          <button
            type="button"
            onClick={handleClose}
            disabled={isSending}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSend}
            disabled={isActionDisabled}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold shadow-sm flex items-center gap-2 transition-all
              ${isActionDisabled
                ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                : "bg-[#00a884] text-white hover:bg-emerald-600 active:scale-95 shadow-emerald-200"
              }
            `}
          >
            {isSending ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Sending...
              </>
            ) : (
              <>
                <Send size={14} /> Send
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
