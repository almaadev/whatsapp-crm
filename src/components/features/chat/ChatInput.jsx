import React, { useState, useRef, useEffect, memo } from "react";
import { Send, Layers, X, Variable } from "lucide-react";
import { TemplateBubble } from "@/components/layout/TemplateBubble";
import { toast } from "react-toastify";

const ChatInput = memo(function ChatInput({ onSendMessage, onSendTemplate, sending }) {
  const [text, setText] = useState("");
  const [showBubble, setShowBubble] = useState(false);

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
    if (text.trim() && !sending) {
      onSendMessage(text);
      setText("");
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "/" && text === "") {
      e.preventDefault();
      setShowBubble(true);
    } else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendClick();
    }
  };

  return (
    <div className="relative bg-[#f0f2f5] p-3 px-4 border-t border-slate-200 flex items-end gap-3 z-20">
      {showBubble && (
        <TemplateBubble onSelect={handleTemplateSelect} onManage={() => setShowBubble(false)} onClose={() => setShowBubble(false)} />
      )}

      {varTemplate && (
        <div className="absolute bottom-[70px] left-4 mb-2 w-[calc(100%-2rem)] max-w-sm bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-emerald-500/30 p-4 z-50 animate-in zoom-in-95">
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

      <div className="flex-1 bg-white border border-slate-200 rounded-2xl flex items-center px-4 py-1.5 focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all shadow-sm min-h-[44px]">
        <textarea
          ref={textareaRef}
          className="w-full bg-transparent border-none text-sm outline-none placeholder:text-slate-400 resize-none py-1.5 text-slate-800 custom-scrollbar"
          style={{ maxHeight: "150px" }}
          placeholder="Type a message (or type '/' for templates)"
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
        />
      </div>

      <button onClick={handleSendClick} disabled={sending || !text.trim()} className={`p-3 rounded-full shadow transition-all flex-shrink-0 mb-0.5 ${text.trim() ? "bg-[#00a884] text-white hover:bg-emerald-700" : "bg-slate-200 text-slate-400"}`}>
        {sending ? <div className="w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin" /> : <Send size={20} className={text.trim() ? "ml-0.5" : ""} />}
      </button>
      <button onClick={() => setShowBubble(!showBubble)} className={`p-3 flex-shrink-0 rounded-full transition-all shadow-sm ${showBubble ? "bg-emerald-100 text-emerald-600" : "bg-white text-slate-500 hover:bg-slate-100"}`} title="Templates (Shortcut: /)">
        <Layers size={20} />
      </button>
    </div>
  );
});

export default ChatInput;
