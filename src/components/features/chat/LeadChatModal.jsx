"use client";

import React, { useRef, useEffect, useState, memo, useMemo, useCallback } from 'react';
import { useTemplateStore } from "@/store/templateStore";
import { ChevronLeft, User, MapPin, ToggleLeft, ToggleRight, FileText, Info, Send, Layers, Search, Variable,  X, Loader2, Edit2, Trash2, Tag, Plus, Save } from "lucide-react";
import { toast } from "react-toastify";

function useDebounce(value, delay) {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
        const handler = setTimeout(() => setDebouncedValue(value), delay);
        return () => clearTimeout(handler);
    }, [value, delay]);
    return debouncedValue;
}

// -----------------------------------------------------------------------------
//  HEADER COMPONENT
// -----------------------------------------------------------------------------
export const LeadChatHeader = memo(function LeadChatHeader({
    selectedChat,
    onBack,
    onInfoClick,
    showToggle,
    isToggling,
    onToggle,
    isChatActive,
    statusMenuRef,
    isStatusMenuOpen,
    setIsStatusMenuOpen,
    onStatusChange,
    themeGradient = "from-blue-500 to-cyan-400",
    themeBadgeClasses = "bg-blue-50 text-blue-800 hover:bg-blue-100",
    themeIconHoverClasses = "hover:text-blue-700 hover:bg-blue-50"
}) {
    return (
        <div className="bg-[#f0f2f5] px-4 py-3 border-b border-slate-200 flex items-center justify-between shrink-0 shadow-sm z-20">
            <div className="flex items-center gap-3">
                <button onClick={onBack} className="md:hidden p-1.5 -ml-1.5 text-slate-500 hover:bg-slate-100 rounded-full">
                    <ChevronLeft size={24} />
                </button>
                <div className={`w-10 h-10 bg-gradient-to-tr ${themeGradient} rounded-full flex items-center justify-center text-white shrink-0 shadow-sm cursor-pointer`} onClick={onInfoClick}>
                    <User size={20} className="opacity-90" />
                </div>
                <div className="flex flex-col cursor-pointer min-w-0" onClick={onInfoClick}>
                    <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-800 text-[15px] leading-tight truncate">{selectedChat?.name || selectedChat?.phone}</h3>
                        {selectedChat?.city && (
                            <div className="hidden lg:flex items-center gap-1 text-[11px] font-semibold text-slate-600 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
                                <MapPin size={12} /> {selectedChat.city}
                            </div>
                        )}
                    </div>
                    <p className="text-[12px] text-slate-500 mt-0.5 truncate">{selectedChat?.phone?.replace("whatsapp:", "")}</p>
                </div>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-3">
                {showToggle && (
                    <button onClick={onToggle} disabled={isToggling} className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold transition-all shadow-sm ${isChatActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'}`} title={isChatActive ? "Mark chat as Closed" : "Mark chat as Active"}>
                        {isToggling ? <span className="w-3 h-3 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"/> : (isChatActive ? <ToggleRight size={16} /> : <ToggleLeft size={16} />)}
                        <span>{isChatActive ? "Active" : "Closed"}</span>
                    </button>
                )}
                <div className="flex relative" ref={statusMenuRef}>
                    <button onClick={() => setIsStatusMenuOpen(!isStatusMenuOpen)} className={`flex items-center gap-1.5 ${themeBadgeClasses} px-3 py-1.5 rounded-lg text-sm font-bold transition-colors shadow-sm`}>
                        <FileText size={16} /><span className="hidden sm:inline">{selectedChat?.status || "New"}</span>
                    </button>
                    {isStatusMenuOpen && (
                        <div className="absolute right-0 mt-2 w-40 bg-white rounded-lg shadow-xl border border-slate-100 py-1 z-50 animate-in fade-in zoom-in-95">
                            {["Follow Up", "Closed", "Not Interested"].map((st) => (
                                <button key={st} onClick={() => { onStatusChange(st); setIsStatusMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 text-slate-700 font-medium">{st}</button>
                            ))}
                        </div>
                    )}
                </div>
                <button onClick={onInfoClick} className={`flex items-center justify-center p-2 text-slate-400 ${themeIconHoverClasses} rounded-full transition-all`}>
                    <Info size={22} />
                </button>
            </div>
        </div>
    );
});

// -----------------------------------------------------------------------------
//  INPUT COMPONENT (WITH TEMPLATE ENGINE)
// -----------------------------------------------------------------------------
export const LeadChatInput = memo(function LeadChatInput({ replyText, setReplyText, handleSend, onSendTemplate, sending }) {
    const textareaRef = useRef(null);
    const [showBubble, setShowBubble] = useState(false);
    const [showSidebar, setShowSidebar] = useState(false);
    
    // Variable Modal State
    const [varTemplate, setVarTemplate] = useState(null);
    const [templateVars, setTemplateVars] = useState({});

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [replyText]);

    const getRequiredVariablesCount = (bodyText) => {
        const matches = bodyText ? bodyText.match(/\{\{(\d+)\}\}/g) : null;
        let count = 0;
        if (matches) {
            matches.forEach(m => {
                const num = parseInt(m.replace(/[{}]/g, ''));
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

    const handleKeyDown = (e) => {
        if (e.key === '/' && replyText === "") {
            e.preventDefault();
            setShowBubble(true);
        } else if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (replyText.trim() && !sending) {
                handleSend();
            }
        }
    };

    return (
        <div className="relative bg-[#f0f2f5] p-3 px-4 border-t border-slate-200 flex items-end gap-3 z-20">
            {showBubble && <TemplateBubble onSelect={handleTemplateSelect} onManage={() => { setShowBubble(false); setShowSidebar(true); }} onClose={() => setShowBubble(false)} />}
            {showSidebar && <TemplateSidebar open={showSidebar} onClose={() => setShowSidebar(false)} />}

            {/* VARIABLE FILLING MODAL FOR LEADS */}
            {varTemplate && (
                <div className="absolute bottom-[70px] left-4 mb-2 w-[calc(100%-2rem)] max-w-sm bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-emerald-500/30 p-4 z-50 animate-in zoom-in-95">
                    <div className="flex justify-between items-center mb-3 border-b border-slate-100 pb-2">
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-md bg-emerald-100 flex items-center justify-center text-emerald-600"><Variable size={12} /></div>
                            <h4 className="text-sm font-bold text-slate-800">Fill Template Variables</h4>
                        </div>
                        <button onClick={() => setVarTemplate(null)} className="text-slate-400 hover:text-rose-500 bg-slate-50 p-1.5 rounded-md"><X size={14} /></button>
                    </div>
                    
                    <div className="bg-slate-50 border border-slate-100 rounded-lg p-2.5 mb-4 max-h-24 overflow-y-auto custom-scrollbar">
                        <p className="text-[11px] text-slate-600 font-mono leading-relaxed whitespace-pre-wrap">{varTemplate.template.body}</p>
                    </div>

                    <div className="space-y-3 mb-4 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                        {Array.from({ length: varTemplate.reqCount }, (_, i) => i + 1).map(num => (
                            <div key={num} className="flex items-center gap-3">
                                <span className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-700 font-bold flex items-center justify-center text-xs shrink-0">{`{{${num}}}`}</span>
                                <input
                                    type="text"
                                    placeholder={`Enter value for {{${num}}}`}
                                    value={templateVars[num] || ""}
                                    onChange={e => setTemplateVars({...templateVars, [num]: e.target.value})}
                                    className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 shadow-sm"
                                />
                            </div>
                        ))}
                    </div>

                    <button
                        onClick={() => {
                            for(let i = 1; i <= varTemplate.reqCount; i++) {
                                if(!templateVars[i] || templateVars[i].trim() === "") {
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
                    value={replyText} 
                    onChange={(e) => setReplyText(e.target.value)} 
                    placeholder="Type a message (or type '/' for templates)" 
                    className="w-full max-h-32 bg-transparent outline-none resize-none text-[15px] text-slate-800 custom-scrollbar py-1.5" 
                    rows={1} 
                    onKeyDown={handleKeyDown} 
                />
            </div>
            <button 
                onClick={handleSend}
                disabled={!replyText.trim() || sending} 
                className={`p-3 rounded-full shadow transition-all flex-shrink-0 mb-0.5 flex items-center justify-center w-[48px] h-[48px] ${replyText.trim() ? "bg-[#00a884] text-white hover:bg-emerald-700" : "bg-slate-200 text-slate-400"}`}
            >
                {sending ? <div className="w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin" /> : <Send size={20} className={replyText.trim() ? "ml-0.5" : ""} />}
            </button>
            <button onClick={() => setShowBubble(!showBubble)} className={`p-3 flex-shrink-0 rounded-full transition-all shadow-sm ${showBubble ? "bg-emerald-100 text-emerald-600" : "bg-white text-slate-500 hover:bg-slate-100"}`} title="Templates (Shortcut: /)">
                <Layers size={20} />
            </button>
        </div>
    );
});

// -----------------------------------------------------------------------------
//  TEMPLATE COMPONENTS (IMPORTED DIRECTLY INTO THIS MODULE)
// -----------------------------------------------------------------------------
const TemplateBubble = memo(function TemplateBubble({ onSelect, onManage, onClose }) {
    const { templates, loading, fetchTemplates } = useTemplateStore();
    const [search, setSearch] = useState("");
    const debouncedSearch = useDebounce(search, 300);
    const searchRef = useRef(null);

    useEffect(() => {
        fetchTemplates();
        setTimeout(() => searchRef.current?.focus(), 50);
    }, [fetchTemplates]);

    const filtered = useMemo(() =>
        templates.filter(t => t.name.toLowerCase().includes(debouncedSearch.toLowerCase())),
        [templates, debouncedSearch]);

    return (
        <div className="absolute bottom-[70px] right-4 w-72 sm:w-80 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200/60 flex flex-col overflow-hidden animate-in zoom-in-95 fade-in duration-200 z-50 origin-bottom-right">
            <div className="p-3 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50">
                <Search size={14} className="text-slate-400" />
                <input
                    ref={searchRef}
                    type="text"
                    placeholder="Search templates (/)"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="bg-transparent border-none outline-none text-sm w-full text-slate-700 placeholder:text-slate-400"
                />
                <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-md text-slate-400 transition-colors"><X size={14} /></button>
            </div>
            <div className="max-h-64 overflow-y-auto custom-scrollbar p-2 space-y-1">
                {loading ? (
                    <div className="p-6 flex justify-center"><Loader2 size={16} className="animate-spin text-[#00a884]" /></div>
                ) : filtered.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400 font-medium">No templates match '{debouncedSearch}'</div>
                ) : (
                    filtered.map(tpl => (
                        <button
                            key={tpl._id || tpl.sid}
                            onClick={() => { onSelect(tpl); onClose(); }}
                            className="w-full text-left p-3 rounded-xl hover:bg-emerald-50 hover:shadow-sm border border-transparent hover:border-emerald-100 transition-all group flex items-center gap-3"
                        >
                            <div className="w-8 h-8 rounded-lg bg-slate-100 group-hover:bg-emerald-100 flex items-center justify-center shrink-0 transition-colors">
                                <Layers size={14} className="text-slate-500 group-hover:text-emerald-600 transition-colors" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-slate-700 group-hover:text-emerald-800 truncate transition-colors">{tpl.name}</p>
                            </div>
                        </button>
                    ))
                )}
            </div>
            <div className="p-3 border-t border-slate-100 bg-slate-50">
                <button onClick={() => { onClose(); onManage(); }} className="w-full py-2.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-100 hover:text-slate-800 transition-colors shadow-sm flex items-center justify-center gap-2">
                    <Plus size={14} /> Manage Templates
                </button>
            </div>
        </div>
    );
});

const TemplateSidebar = memo(function TemplateSidebar({ open, onClose }) {
    const { templates, loading, addTemplate, updateTemplate, removeTemplate, forceRefresh } = useTemplateStore();

    const [sidInput, setSidInput] = useState("");
    const [nameInput, setNameInput] = useState("");
    const [editId, setEditId] = useState(null);
    const [adding, setAdding] = useState(false);
    const [deletingId, setDeletingId] = useState(null);
    const [showAddForm, setShowAddForm] = useState(false);

    useEffect(() => { if (open) forceRefresh(); }, [open, forceRefresh]);

    const resetForm = () => { setSidInput(""); setNameInput(""); setEditId(null); setShowAddForm(false); };

    const handleSave = async () => {
        const sid = sidInput.trim();
        if (!sid) return toast.error("Content SID is required");
        setAdding(true);
        try {
            const payload = { name: nameInput.trim() || `Template ${templates.length + 1}`, sid };
            const url = editId ? `/api/templates/${editId}` : "/api/templates";
            const res = await fetch(url, {
                method: editId ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const json = await res.json();
            if (!res.ok || !json.success) throw new Error(json.error || "Failed to save");
            if (editId) updateTemplate(editId, json.data); else addTemplate(json.data);
            toast.success(editId ? "Template updated" : "Template added");
            resetForm();
        } catch (error) {
            toast.error(error.message);
        } finally {
            setAdding(false);
        }
    };

    const handleDelete = async (id) => {
        setDeletingId(id);
        try {
            const res = await fetch(`/api/templates/${id}`, { method: "DELETE" });
            const json = await res.json();
            if (!res.ok || !json.success) throw new Error(json.error || "Failed to delete");
            removeTemplate(id);
            toast.success("Template deleted");
        } catch (error) {
            toast.error(error.message);
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <>
            <div className={`fixed inset-0 z-[999] bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300 ${open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`} onClick={onClose} />
            <div className={`fixed top-0 right-0 h-[100dvh] w-full sm:w-[420px] bg-white border-l border-slate-200 shadow-2xl z-[1000] flex flex-col transform transition-transform duration-300 ease-out ${open ? "translate-x-0" : "translate-x-full"}`}>
                <div className="p-6 border-b border-slate-100 bg-white flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2"><Layers size={18} className="text-[#00a884]" /><span className="font-extrabold text-base text-slate-800 tracking-tight">Template Library</span></div>
                    <button className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-400 hover:text-rose-500 transition-all" onClick={onClose}><X size={16} /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-5 bg-slate-50 flex flex-col gap-3 custom-scrollbar">
                    {loading && templates.length === 0 ? (
                        <div className="flex justify-center p-10"><Loader2 className="animate-spin text-[#00a884]" /></div>
                    ) : templates.map(tpl => (
                        <div key={tpl._id || tpl.sid} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3 transition-all hover:border-slate-300 shadow-sm animate-in fade-in slide-in-from-bottom-2">
                            <div className="w-9 h-9 rounded-lg shrink-0 flex items-center justify-center bg-slate-50 border border-slate-200 text-slate-400"><Tag size={15} /></div>
                            <div className="flex-1 min-w-0"><div className="text-sm font-bold text-slate-800 truncate">{tpl.name}</div></div>
                            <div className="flex gap-1 shrink-0">
                                <button className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:bg-blue-100 hover:text-blue-600 transition-colors" onClick={() => { setEditId(tpl._id); setNameInput(tpl.name); setSidInput(tpl.sid); setShowAddForm(true); }}><Edit2 size={14} /></button>
                                <button className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:bg-rose-100 hover:text-rose-600 transition-colors" onClick={() => handleDelete(tpl._id)} disabled={deletingId === tpl._id}>{deletingId === tpl._id ? <Loader2 size={14} className="animate-spin text-rose-500" /> : <Trash2 size={14} />}</button>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="shrink-0 p-5 sm:p-6 bg-white border-t border-slate-200">
                    {!showAddForm ? (
                        <button className="w-full py-3 bg-emerald-50 border border-dashed border-emerald-200 rounded-xl text-[#00a884] text-sm font-bold flex items-center justify-center gap-2 hover:bg-emerald-100 transition-all" onClick={() => setShowAddForm(true)}><Plus size={16} /> Add New Template</button>
                    ) : (
                        <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2">
                            <div><label className="block text-[10px] font-bold uppercase text-slate-500 mb-1.5">Template Label</label><input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#00a884] focus:ring-2 focus:ring-[#00a884]/10" value={nameInput} onChange={e => setNameInput(e.target.value)} placeholder="e.g. Welcome Message" /></div>
                            <div><label className="block text-[10px] font-bold uppercase text-slate-500 mb-1.5">Content SID *</label><input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 font-mono text-sm text-slate-700 outline-none focus:border-[#00a884] focus:ring-2 focus:ring-[#00a884]/10" value={sidInput} onChange={e => setSidInput(e.target.value)} placeholder="HXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" spellCheck={false} /></div>
                            <div className="flex gap-2 mt-2">
                                <button className="flex-1 py-2.5 bg-slate-100 rounded-lg text-slate-600 text-sm font-bold hover:bg-slate-200 transition-all" onClick={resetForm}>Cancel</button>
                                <button className="flex-[2] py-2.5 bg-[#00a884] text-white rounded-lg text-sm font-bold flex items-center justify-center gap-2 hover:bg-[#059669] transition-all disabled:opacity-50" onClick={handleSave} disabled={adding || !sidInput.trim()}>{adding ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
});