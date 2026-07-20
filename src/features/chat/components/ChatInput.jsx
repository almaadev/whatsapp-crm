import React, { useState, useRef, useEffect, memo } from "react";
import { Send, Layers, X, Variable, Paperclip, Smile } from "lucide-react";
import { TemplateBubble } from "@/shared/components/layout/TemplateBubble";
import { toast } from "react-toastify";

import EmojiPicker from "@/features/chat/components/EmojiPicker";

const ChatInput = memo(function ChatInput({ onSendMessage, onSendTemplate, sending, disabled, onFocus, isChatClosed }) {
  const [text, setText] = useState("");
  const [showBubble, setShowBubble] = useState(false);
  const [showEmojis, setShowEmojis] = useState(false);
  
  // File upload state
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);

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

  const handleTemplateSelect = (tpl) => {
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

  const handleSendClick = () => {
    if (disabled) return;
    
    if (selectedFile) {
      // Simulate sending file as a message with attachment representation
      const fileRepText = `[Attachment File: ${selectedFile.name}] ${text.trim()}`;
      onSendMessage(fileRepText);
      setSelectedFile(null);
      setText("");
    } else if (text.trim() && !sending) {
      onSendMessage(text);
      setText("");
    }
    setShowEmojis(false);
  };

  const handleKeyDown = (e) => {
    if (disabled) return;
    if (e.key === "/" && text === "") {
      e.preventDefault();
      setShowBubble(true);
    } else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendClick();
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleEmojiSelect = (emoji) => {
    setText((prev) => prev + emoji);
    textareaRef.current?.focus();
  };

  return (
    <div className="relative bg-white border-t border-slate-200/80 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] flex flex-col gap-2.5 z-20 select-none">
      
      {/* Template picker popover */}
      {showBubble && (
        <TemplateBubble onSelect={handleTemplateSelect} onManage={() => setShowBubble(false)} onClose={() => setShowBubble(false)} />
      )}

      {/* Local File Attachment Preview Queue */}
      {selectedFile && (
        <div className="flex items-center justify-between bg-slate-50 border border-slate-200/80 rounded-xl px-4 py-2 text-xs text-slate-700 animate-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center gap-2 font-semibold">
            <Paperclip size={12} className="text-[#00a884]" />
            <span className="truncate max-w-[200px]">{selectedFile.name}</span>
            <span className="text-slate-400 font-mono text-[10px]">({Math.round(selectedFile.size / 1024)} KB)</span>
          </div>
          <button onClick={() => setSelectedFile(null)} className="text-slate-400 hover:text-rose-500 hover:bg-slate-100 p-1 rounded-md transition-colors">
            <X size={14} />
          </button>
        </div>
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
        {/* Hidden attachment trigger */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          disabled={disabled}
        />
        
        {/* Paperclip Button */}
        <button
          type="button"
          disabled={isChatClosed || disabled}
          onClick={() => fileInputRef.current?.click()}
          className="p-2.5 rounded-xl border border-slate-200 text-slate-500 hover:text-[#00a884] hover:bg-slate-50 transition-all shadow-sm shrink-0 mb-0.5"
          title="Attach File"
        >
          <Paperclip size={18} />
        </button>

        {/* Emoji smile Button */}
        <button
          type="button"
          disabled={isChatClosed || disabled}
          onClick={() => setShowEmojis(!showEmojis)}
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
          disabled={isChatClosed || disabled}
          onClick={() => setShowBubble(!showBubble)}
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
            className={`w-full bg-transparent border-none text-sm outline-none placeholder:text-slate-400 resize-none py-1 text-slate-800 custom-scrollbar font-medium ${isChatClosed ? "bg-slate-100 text-slate-400 cursor-not-allowed" : ""}`}
            title={isChatClosed ? "This chat is closed. You cannot send messages, reopen chat to continue." : "Type a message (or type '/' for templates)"}
            style={{ maxHeight: "150px" }}
            placeholder="Type a message (or type '/' for templates)..."
            rows={1}
            value={text}
            readOnly={isChatClosed}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
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
          onClick={handleSendClick}
          disabled={ sending || (!text.trim() && !selectedFile) || disabled || isChatClosed }
          className={`p-3 rounded-xl shadow-md transition-all shrink-0 mb-0.5 flex items-center justify-center
            ${(text.trim() || selectedFile) && !disabled
              ? "bg-[#00a884] text-white hover:bg-emerald-600 active:scale-95 shadow-emerald-200"
              : "bg-slate-100 text-slate-400 border border-slate-200 shadow-none cursor-not-allowed"
            }
          `}
        >
          {sending ? (
            <div className="w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin" />
          ) : (
            <Send size={18} className={(text.trim() || selectedFile) ? "translate-x-[0.5px]" : ""} />
          )}
        </button>
      </div>
    </div>
  );
});

export default ChatInput;
