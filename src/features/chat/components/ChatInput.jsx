import React, { useState, useRef, useEffect, memo } from "react";
import { Send, Layers, Variable, Paperclip, Smile, X } from "lucide-react";
import { ChatTemplatePanel } from "@/features/chat/components/ChatTemplatePanel";
import { toast } from "react-toastify";
import EmojiPicker from "@/features/chat/components/EmojiPicker";
import ChatStatusBanner from "@/features/chat/components/ChatStatusBanner";

// Media Components
import AttachmentMenu from "@/features/chat/components/media/AttachmentMenu";
import MediaPicker from "@/features/chat/components/media/MediaPicker";
import MediaPreview from "@/features/chat/components/media/MediaPreview";
import UploadProgress from "@/features/chat/components/media/UploadProgress";
import { mediaService } from "@/features/chat/services/mediaService";

const ChatInput = memo(function ChatInput({
  onSendMessage,
  onSendTemplate,
  onSendCRMTemplate,
  sending,
  disabled,
  onFocus,
  isChatClosed,
  chatClosed,
  isLockedByOther,
  lockHandlerName,
  activeChat,
  customerContext,
}) {
  const isClosed = Boolean(isChatClosed || chatClosed);
  const [text, setText] = useState("");
  const [showBubble, setShowBubble] = useState(false);
  const [showEmojis, setShowEmojis] = useState(false);

  // Attachment & Media states
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [previewItem, setPreviewItem] = useState(null); // { file, mediaType, previewUrl, originalSize, compressedSize, savingsPercent, wasCompressed, isCompressing, compressionProgress, error }
  const [mediaCaption, setMediaCaption] = useState("");
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [uploadStageText, setUploadStageText] = useState("");

  const mediaPickerRef = useRef(null);

  // Variable Modal State
  const [varTemplate, setVarTemplate] = useState(null);
  const [templateVars, setTemplateVars] = useState({});

  const textareaRef = useRef(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [text]);

  const getRequiredVariablesCount = (bodyText) => {
    const matches = bodyText ? bodyText.match(/\{\{(\d+)\}\}/g) : null;
    let count = 0;
    if (matches) {
      matches.forEach((m) => {
        const num = parseInt(m.replace(/[{}]/g, ""));
        if (num > count) count = num;
      });
    }
    return count;
  };

  const handleWhatsAppSelect = (tpl) => {
    const reqCount = getRequiredVariablesCount(tpl.body);
    if (reqCount > 0) {
      setVarTemplate({ template: tpl, reqCount });
      setTemplateVars({});
      setShowBubble(false);
    } else {
      onSendTemplate(tpl, {});
      setShowBubble(false);
    }
  };

  const handleCRMSelect = (tpl, resolvedText) => {
    setShowBubble(false);
    if (onSendCRMTemplate) {
      onSendCRMTemplate(tpl, resolvedText);
    } else if (onSendMessage) {
      onSendMessage(resolvedText);
    }
  };

  const handleSendClick = () => {
    if (disabled || isClosed || isUploadingMedia) return;

    if (text.trim() && !sending) {
      onSendMessage(text);
      setText("");
    }
    setShowEmojis(false);
    setShowAttachmentMenu(false);
  };

  const handleKeyDown = (e) => {
    if (disabled || isClosed) return;
    if (e.key === "/" && text === "") {
      e.preventDefault();
      setShowBubble(true);
    } else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendClick();
    }
  };

  const handleEmojiSelect = (emoji) => {
    setText((prev) => prev + emoji);
    textareaRef.current?.focus();
  };

  // Attachment Menu Selection Handler
  const handleAttachmentOption = (optionId) => {
    if (optionId === "photos_videos") {
      mediaPickerRef.current?.openPhotosVideos();
    } else if (optionId === "document") {
      mediaPickerRef.current?.openDocument();
    } else if (optionId === "audio") {
      mediaPickerRef.current?.openAudio();
    }
  };

  // File Picker Selected Callback
  const handleFilePicked = async (file, expectedCategory) => {
    const mime = (file.type || "").toLowerCase();
    const isVideo = mime.startsWith("video/") || (expectedCategory === "photos_videos" && ["mp4", "mov", "webm", "3gp"].includes(file.name.split(".").pop()?.toLowerCase()));
    const isAudio = mime.startsWith("audio/") || expectedCategory === "audio";
    const isPdf = mime === "application/pdf" || expectedCategory === "document";
    const mediaType = isVideo ? "video" : isAudio ? "audio" : isPdf ? "document" : "image";

    const initialItem = {
      file,
      mediaType,
      previewUrl: URL.createObjectURL(file),
      originalSize: file.size,
      compressedSize: file.size,
      savingsPercent: 0,
      wasCompressed: false,
      isCompressing: false,
      compressionProgress: 0,
      error: null,
    };

    setPreviewItem(initialItem);
    setMediaCaption("");

    // 1. Image compression if > 3MB
    if (mediaType === "image" && file.size > 3 * 1024 * 1024) {
      try {
        setPreviewItem((prev) => ({ ...prev, isCompressing: true, compressionProgress: 10 }));
        const compressed = await mediaService.compressImage(file, (p) => {
          setPreviewItem((prev) => ({ ...prev, compressionProgress: p }));
        });
        setPreviewItem((prev) => ({
          ...prev,
          file: compressed.file,
          previewUrl: compressed.previewUrl,
          compressedSize: compressed.compressedSize,
          savingsPercent: compressed.savingsPercent,
          wasCompressed: true,
          isCompressing: false,
        }));
      } catch (err) {
        setPreviewItem((prev) => ({
          ...prev,
          isCompressing: false,
          error: "Image compression failed: " + err.message,
        }));
      }
    }

    // 2. Video compression if > 10MB
    if (mediaType === "video" && file.size > 10 * 1024 * 1024) {
      try {
        setPreviewItem((prev) => ({ ...prev, isCompressing: true, compressionProgress: 10 }));
        const compressed = await mediaService.compressVideo(file, (p) => {
          setPreviewItem((prev) => ({ ...prev, compressionProgress: p }));
        });
        setPreviewItem((prev) => ({
          ...prev,
          file: compressed.file,
          compressedSize: compressed.compressedSize,
          savingsPercent: compressed.savingsPercent,
          wasCompressed: true,
          isCompressing: false,
        }));
      } catch (err) {
        setPreviewItem((prev) => ({
          ...prev,
          isCompressing: false,
          error: "Video could not be compressed below 10MB.",
        }));
      }
    }
  };

  // Send Media from Preview Modal
  const handleSendMediaPreview = async () => {
    if (!previewItem || !previewItem.file || isUploadingMedia) return;

    setIsUploadingMedia(true);
    setUploadStageText("Uploading to server...");
    setUploadPercent(5);

    try {
      // 1. Upload to Cloudinary backend API
      const uploadedData = await mediaService.uploadMedia(
        previewItem.file,
        previewItem.mediaType,
        (p) => {
          setUploadPercent(p);
          if (p >= 90) setUploadStageText("Finalizing message...");
        },
        {
          caption: mediaCaption || "",
          chatId: activeChat?._id || "",
          customerId: activeChat?.customerId || activeChat?.customer?._id || "",
        }
      );

      // 2. Send via ChatArea / API
      setUploadStageText("Sending via WhatsApp...");
      await onSendMessage(mediaCaption || "", {
        mediaId: uploadedData.id || uploadedData._id,
        mediaUrl: uploadedData.secureUrl || uploadedData.cloudinaryUrl || uploadedData.url,
        mediaType: uploadedData.mediaType,
        media: uploadedData,
        messageType: uploadedData.mediaType,
      });

      // Cleanup on verified success only
      setPreviewItem(null);
      setMediaCaption("");
      toast.success("Media sent successfully!");
    } catch (err) {
      console.error("Media send error:", err);
      const errMsg = err.response?.data?.message || err.message || "Upload failed. Please try again.";
      toast.error(errMsg);
      setPreviewItem((prev) => (prev ? { ...prev, error: errMsg } : null));
    } finally {
      setIsUploadingMedia(false);
      setUploadPercent(0);
      setUploadStageText("");
    }
  };

  return (
    <div className="relative bg-white border-t border-slate-200/80 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] flex flex-col gap-2.5 z-20 select-none shrink-0">
      {/* Hidden Native File Inputs */}
      <MediaPicker
        ref={mediaPickerRef}
        onFileSelected={handleFilePicked}
        disabled={isClosed || disabled}
      />

      {/* Closed Chat Banner */}
      {isClosed && <ChatStatusBanner isClosed={isClosed} />}

      {/* Locked Chat Notice inside Input */}
      {isLockedByOther && !isClosed && (
        <div className="bg-red-50/90 border border-red-200/80 text-red-800 px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between shadow-sm animate-in fade-in duration-200">
          <span className="flex items-center gap-2 truncate">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
            This conversation is currently locked by {lockHandlerName || "another user"}.
          </span>
        </div>
      )}

      {/* Unassigned Sender Warning Banner */}
      {disabled && !isClosed && !isLockedByOther && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between shadow-sm animate-in fade-in duration-200">
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            No WhatsApp sender has been assigned. Please contact your administrator.
          </span>
        </div>
      )}

      {/* Non-blocking Upload Progress Bar */}
      {isUploadingMedia && !previewItem && (
        <UploadProgress stageText={uploadStageText} percent={uploadPercent} />
      )}

      {/* Floating Attachment Menu (Desktop Popover / Mobile Bottom Sheet) */}
      <AttachmentMenu
        isOpen={showAttachmentMenu}
        onClose={() => setShowAttachmentMenu(false)}
        onSelectOption={handleAttachmentOption}
      />

      {/* Media Preview Modal */}
      {previewItem && (
        <MediaPreview
          mediaItem={previewItem}
          caption={mediaCaption}
          setCaption={setMediaCaption}
          onCancel={() => setPreviewItem(null)}
          onSend={handleSendMediaPreview}
          isSending={isUploadingMedia}
          uploadProgress={uploadPercent}
          stageText={uploadStageText}
        />
      )}

      {/* Floating Two-Tab Template Picker Panel */}
      {showBubble && (
        <ChatTemplatePanel
          activeChat={activeChat}
          customerContext={customerContext}
          onSelectWhatsApp={handleWhatsAppSelect}
          onSelectCRM={handleCRMSelect}
          onClose={() => setShowBubble(false)}
        />
      )}

      {/* Redesigned Floating Emoji Picker */}
      {showEmojis && (
        <div className="absolute bottom-[80px] left-4 z-50 shadow-2xl">
          <EmojiPicker
            onSelect={handleEmojiSelect}
            onClose={() => setShowEmojis(false)}
          />
        </div>
      )}

      {/* Dynamic Template Variables Modal */}
      {varTemplate && (
        <div className="absolute bottom-[85px] left-4 mb-2 w-[calc(100%-2rem)] max-w-sm bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-emerald-500/30 p-4 z-50 animate-in zoom-in-95">
          <div className="flex justify-between items-center mb-3 border-b border-slate-100 pb-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-emerald-100 flex items-center justify-center text-emerald-600">
                <Variable size={12} />
              </div>
              <h4 className="text-sm font-bold text-slate-800">Fill Template Variables</h4>
            </div>
            <button onClick={() => setVarTemplate(null)} className="text-slate-400 hover:text-rose-500 bg-slate-50 p-1.5 rounded-md">
              <X size={14} />
            </button>
          </div>

          <div className="bg-slate-50 border border-slate-100 rounded-lg p-2.5 mb-4 max-h-24 overflow-y-auto custom-scrollbar">
            <p className="text-[11px] text-slate-600 font-mono leading-relaxed whitespace-pre-wrap">{varTemplate.template.body}</p>
          </div>

          <div className="space-y-3 mb-4 max-h-40 overflow-y-auto custom-scrollbar pr-1">
            {Array.from({ length: varTemplate.reqCount }, (_, i) => i + 1).map((num) => (
              <div key={num} className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-700 font-bold flex items-center justify-center text-xs shrink-0">{`{{${num}}}`}</span>
                <input
                  type="text"
                  placeholder={`Enter value for {{${num}}}`}
                  value={templateVars[num] || ""}
                  onChange={(e) => setTemplateVars({ ...templateVars, [num]: e.target.value })}
                  className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 shadow-sm"
                />
              </div>
            ))}
          </div>

          <button
            onClick={() => {
              for (let i = 1; i <= varTemplate.reqCount; i++) {
                if (!templateVars[i] || templateVars[i].trim() === "") {
                  return toast.error(`Please enter a value for variable {{${i}}}`);
                }
              }
              onSendTemplate(varTemplate.template, templateVars);
              setVarTemplate(null);
            }}
            className="w-full py-2.5 bg-[#00a884] text-white rounded-xl text-sm font-bold shadow-md hover:bg-emerald-600 active:scale-[0.98] transition flex justify-center items-center gap-2"
          >
            <Send size={14} /> Send Message
          </button>
        </div>
      )}

      {/* Main Composer Row */}
      <div className="flex items-end gap-3 w-full">
        {/* Paperclip / Attachment Button */}
        <button
          type="button"
          disabled={isClosed || disabled}
          onClick={() => {
            setShowAttachmentMenu(!showAttachmentMenu);
            setShowEmojis(false);
            setShowBubble(false);
          }}
          className={`p-2.5 rounded-xl border transition-all shadow-sm shrink-0 mb-0.5
            ${showAttachmentMenu
              ? "border-[#00a884] bg-emerald-50 text-[#00a884]"
              : "border-slate-200 text-slate-500 hover:text-[#00a884] hover:bg-slate-50"
            }
          `}
          title="Attach Media (Photos, Videos, Documents, Audio)"
        >
          <Paperclip size={18} />
        </button>

        {/* Emoji smile Button */}
        <button
          type="button"
          disabled={isClosed || disabled}
          onClick={() => {
            setShowEmojis(!showEmojis);
            setShowAttachmentMenu(false);
            setShowBubble(false);
          }}
          className={`p-2.5 rounded-xl border transition-all shadow-sm shrink-0 mb-0.5
            ${showEmojis 
              ? "border-[#00a884] bg-emerald-50 text-[#00a884]" 
              : "border-slate-200 text-slate-500 hover:text-[#00a884] hover:bg-slate-50"
            }
          `}
          title="Add Emoji"
        >
          <Smile size={18} />
        </button>

        {/* Templates Button */}
        <button
          type="button"
          disabled={isClosed || disabled}
          onClick={() => {
            setShowBubble(!showBubble);
            setShowEmojis(false);
            setShowAttachmentMenu(false);
          }}
          className={`p-2.5 rounded-xl border transition-all shadow-sm shrink-0 mb-0.5
            ${showBubble 
              ? "border-emerald-500 bg-emerald-50 text-emerald-600" 
              : "border-slate-200 text-slate-500 hover:text-emerald-600 hover:bg-slate-50"
            }
          `}
          title="Templates (Shortcut: /)"
        >
          <Layers size={18} />
        </button>

        {/* Text Area Card */}
        <div className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col px-4 py-2 focus-within:bg-white focus-within:border-[#00a884] focus-within:ring-2 focus-within:ring-emerald-500/10 transition-all shadow-sm min-h-[44px]">
          <textarea
            ref={textareaRef}
            className={`w-full bg-transparent border-none text-sm outline-none placeholder:text-slate-400 resize-none py-1 text-slate-800 custom-scrollbar font-medium ${isClosed ? "bg-slate-100 text-slate-400 cursor-not-allowed" : ""}`}
            title={isClosed ? "This conversation has been closed. Reopen the chat to continue messaging." : "Type a message (or type '/' for templates)"}
            style={{ maxHeight: "150px" }}
            placeholder={isClosed ? "This conversation has been closed. Reopen the chat to continue messaging." : "Type a message (or type '/' for templates)..."}
            rows={1}
            value={text}
            readOnly={isClosed}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled || isClosed}
            onFocus={onFocus}
          />
          {text.length > 50 && (
            <div className="text-[9px] font-bold text-slate-400 self-end mt-1 font-mono">
              {text.length} / 1000 characters
            </div>
          )}
        </div>

        {/* Send Button */}
        <button
          type="button"
          onClick={handleSendClick}
          disabled={sending || !text.trim() || disabled || isClosed || isUploadingMedia}
          className={`p-3 rounded-xl shadow-md transition-all shrink-0 mb-0.5 flex items-center justify-center
            ${text.trim() && !disabled && !isUploadingMedia && !sending
              ? "bg-[#00a884] text-white hover:bg-emerald-600 active:scale-95 shadow-emerald-200"
              : "bg-slate-100 text-slate-400 border border-slate-200 shadow-none cursor-not-allowed"
            }
          `}
          title="Send Message"
        >
          {sending ? (
            <div className="w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin" />
          ) : (
            <Send size={18} className={text.trim() ? "translate-x-[0.5px]" : ""} />
          )}
        </button>
      </div>
    </div>
  );
});

export default ChatInput;
