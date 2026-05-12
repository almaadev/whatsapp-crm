"use client";

import { useState, useEffect, useRef } from "react";
import { X, Plus, Trash2, CheckCircle2, Layers, Tag, Copy, Check, Edit2, Loader2, MessageSquare } from "lucide-react";
import { toast } from "react-toastify";

export default function TemplateManagerPanel({ open, onClose, selectedId, onSelect }) {
    const [templates, setTemplates] = useState([]);
    const [fetching, setFetching] = useState(false);
    
    // Form States
    const [sidInput, setSidInput] = useState("");
    const [nameInput, setNameInput] = useState("");
    const [categoryInput, setCategoryInput] = useState("Marketing"); // Added Category State
    const [editId, setEditId] = useState(null); 

    const [adding, setAdding] = useState(false);
    const [deletingId, setDeletingId] = useState(null);
    const [sidError, setSidError] = useState("");
    const [copiedId, setCopiedId] = useState(null);
    const [showAddForm, setShowAddForm] = useState(false);
    
    const panelRef = useRef(null);
    const sidInputRef = useRef(null);

    // Fetch Templates from MongoDB
    const fetchTemplates = async () => {
        setFetching(true);
        try {
            const res = await fetch("/api/templates");
            const json = await res.json();
            if (json.success) {
                setTemplates(json.data);
            }
        } catch (error) {
            console.error("Failed to load templates:", error);
            toast.error("Could not load template library.");
        } finally {
            setFetching(false);
        }
    };

    useEffect(() => {
        if (open) fetchTemplates();
    }, [open]);

    useEffect(() => {
        if (open && showAddForm && sidInputRef.current) {
            setTimeout(() => sidInputRef.current?.focus(), 180);
        }
    }, [open, showAddForm]);

    // Close on Escape
    useEffect(() => {
        const handler = (e) => { if (e.key === "Escape" && open) onClose(); };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [open, onClose]);

    const handleSave = async () => {
        const sid = sidInput.trim();
        const name = nameInput.trim();

        if (!sid) { setSidError("Content SID is required"); return; }
        if (!/^HX[a-fA-F0-9]{32}$/i.test(sid)) {
            setSidError("Must be a valid Twilio Content SID (HX + 32 hex chars)");
            return;
        }

        setAdding(true);
        setSidError("");
        
        try {
            // Added Category to Payload
            const payload = { 
                name: name || `Template ${templates.length + 1}`, 
                sid, 
                category: categoryInput 
            };
            const url = editId ? `/api/templates/${editId}` : "/api/templates";
            const method = editId ? "PUT" : "POST";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const json = await res.json();
            if (!res.ok || !json.success) throw new Error(json.error || "Failed to save template");

            toast.success(editId ? "Template updated successfully!" : "Template added securely!");
            
            await fetchTemplates();
            resetForm();
        } catch (error) {
            setSidError(error.message);
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
            
            await fetchTemplates();
            
            if (selectedId === templates.find(t => t._id === id)?.sid) {
                onSelect(null, null);
            }
            toast.success("Template deleted from database.");
        } catch (error) {
            toast.error(error.message);
        } finally {
            setDeletingId(null);
        }
    };

    const triggerEdit = (tpl) => {
        setEditId(tpl._id);
        setNameInput(tpl.name);
        setSidInput(tpl.sid);
        setCategoryInput(tpl.category || "Marketing");
        setShowAddForm(true);
    };

    const resetForm = () => {
        setSidInput("");
        setNameInput("");
        setCategoryInput("Marketing");
        setSidError("");
        setEditId(null);
        setShowAddForm(false);
    };

    const handleSelect = (tpl) => {
        onSelect(tpl.sid, tpl.name);
    };

    const handleCopySid = async (tpl) => {
        await navigator.clipboard.writeText(tpl.sid).catch(() => {});
        setCopiedId(tpl._id);
        setTimeout(() => setCopiedId(null), 1600);
    };

    const isSelected = (tpl) => tpl.sid === selectedId;

    // --- Category Badge Colors ---
    const getCategoryStyles = (category) => {
        switch(category?.toLowerCase()) {
            case "utility": return "bg-blue-50 text-blue-600 border-blue-200";
            case "authentication": return "bg-amber-50 text-amber-600 border-amber-200";
            default: return "bg-purple-50 text-purple-600 border-purple-200"; // Marketing default
        }
    };

    return (
        <>
            {/* Backdrop */}
            <div 
                className={`fixed inset-0 z-[999] bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300 ${open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`} 
                onClick={onClose} 
            />

            {/* Sliding Panel */}
            <div 
                ref={panelRef} 
                className={`fixed top-0 right-0 h-[100dvh] w-full sm:w-[420px] bg-white border-l border-slate-200 shadow-2xl z-[1000] flex flex-col transform transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${open ? "translate-x-0" : "translate-x-full"}`}
                role="dialog" 
                aria-modal="true" 
                aria-label="Template Manager"
            >
                
                {/* Header */}
                <div className="p-6 border-b border-slate-100 bg-white flex items-center justify-between shrink-0">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                            <Layers size={18} className="text-[#00a884]" />
                            <span className="font-sans font-extrabold text-base text-slate-800 tracking-tight">
                                Template Library
                            </span>
                            {templates.length > 0 && (
                                <span className="font-mono text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-full px-2 py-0.5">
                                    {templates.length}
                                </span>
                            )}
                        </div>
                        <span className="font-mono text-[10px] text-slate-500 tracking-wider">
                            Twilio Content SID Database
                        </span>
                    </div>
                    <button 
                        className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center cursor-pointer text-slate-400 transition-all hover:bg-slate-100 hover:text-rose-500 hover:border-slate-300" 
                        onClick={onClose} 
                        aria-label="Close panel"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Body (Template List) */}
                <div className="flex-1 overflow-y-auto p-5 bg-slate-50 flex flex-col gap-3 custom-scrollbar">
                    {fetching ? (
                        <div className="flex-1 flex flex-col items-center justify-center gap-3 p-10 text-center">
                            <Loader2 size={24} className="animate-spin text-[#00a884]" />
                            <p className="font-sans text-sm font-semibold text-slate-500">Syncing Database...</p>
                        </div>
                    ) : templates.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center gap-3 p-10 text-center">
                            <div className="w-16 h-16 rounded-2xl bg-white border border-dashed border-slate-300 flex items-center justify-center text-slate-400 shadow-sm mb-2">
                                <MessageSquare size={28} />
                            </div>
                            <div>
                                <p className="font-sans text-sm font-bold text-slate-700 mb-1">No templates saved</p>
                                <p className="font-mono text-xs text-slate-400">Add a Content SID below to get started</p>
                            </div>
                        </div>
                    ) : (
                        templates.map((tpl) => {
                            const selected = isSelected(tpl);
                            const deleting = deletingId === tpl._id;

                            return (
                                <div
                                    key={tpl._id}
                                    className={`bg-white border rounded-xl p-4 flex items-center gap-3 cursor-pointer transition-all relative overflow-hidden shadow-sm animate-in fade-in slide-in-from-bottom-2 ${selected ? "bg-emerald-50/50 border-emerald-200 hover:bg-emerald-50" : "border-slate-200 hover:bg-slate-50 hover:border-slate-300 hover:shadow-md"} ${deleting ? "opacity-0 translate-x-4" : ""}`}
                                    onClick={() => handleSelect(tpl)}
                                >
                                    {/* Active Stripe */}
                                    {selected && <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#00a884] rounded-l-xl" />}

                                    <div className={`w-9 h-9 rounded-lg shrink-0 flex items-center justify-center border transition-all ${selected ? "bg-emerald-100 border-emerald-300" : "bg-slate-50 border-slate-200"}`}>
                                        <Tag size={15} className={selected ? "text-emerald-600" : "text-slate-400"} />
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className={`text-sm font-bold whitespace-nowrap overflow-hidden text-ellipsis font-sans transition-colors ${selected ? "text-emerald-800" : "text-slate-800"}`}>
                                            {tpl.name}
                                        </div>
                                        <div className="flex items-center gap-2 mt-1">
                                            {/* Category Badge */}
                                            <span className={`font-sans text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${getCategoryStyles(tpl.category)}`}>
                                                {tpl.category || "Marketing"}
                                            </span>
                                            <span className={`font-mono text-[10px] ${selected ? "text-emerald-600 font-semibold" : "text-slate-400"}`}>
                                                {selected ? "Active Template" : new Date(tpl.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Hover Actions */}
                                    <div className="flex gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                                        <button className="w-7 h-7 rounded-md bg-transparent cursor-pointer flex items-center justify-center text-slate-400 transition-all hover:bg-slate-200 hover:text-slate-700" onClick={() => handleCopySid(tpl)} title="Copy SID">
                                            {copiedId === tpl._id ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                                        </button>
                                        <button className="w-7 h-7 rounded-md bg-transparent cursor-pointer flex items-center justify-center text-slate-400 transition-all hover:bg-blue-100 hover:text-blue-600" onClick={() => triggerEdit(tpl)} title="Edit Template">
                                            <Edit2 size={14} />
                                        </button>
                                        <button className="w-7 h-7 rounded-md bg-transparent cursor-pointer flex items-center justify-center text-slate-400 transition-all hover:bg-rose-100 hover:text-rose-600 disabled:opacity-50" onClick={() => handleDelete(tpl._id)} disabled={deleting} title="Delete">
                                            {deleting ? <Loader2 size={14} className="animate-spin text-rose-500" /> : <Trash2 size={14} />}
                                        </button>
                                    </div>

                                    {selected && (
                                        <div className="w-5 h-5 rounded-full bg-[#00a884] flex items-center justify-center shrink-0 shadow-[0_2px_4px_rgba(0,168,132,0.3)] ml-1">
                                            <CheckCircle2 size={12} color="#fff" strokeWidth={3} />
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer Add/Edit Form */}
                <div className="shrink-0 p-5 sm:p-6 bg-white border-t border-slate-200 shadow-[0_-4px_10px_rgba(0,0,0,0.02)]">
                    {!showAddForm ? (
                        <button className="w-full py-3 px-4 bg-emerald-50 border border-dashed border-emerald-200 rounded-xl cursor-pointer text-[#00a884] font-sans text-sm font-bold flex items-center justify-center gap-2 transition-all hover:bg-emerald-100 hover:border-[#00a884]" onClick={() => setShowAddForm(true)}>
                            <Plus size={16} strokeWidth={2.5} /> Add New Template
                        </button>
                    ) : (
                        <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] font-bold tracking-[0.05em] uppercase text-slate-500 mb-1.5 font-sans">Template Label</label>
                                    <input 
                                        type="text" 
                                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 font-sans text-sm text-slate-700 outline-none transition-all focus:border-[#00a884] focus:ring-2 focus:ring-[#00a884]/10 placeholder:text-slate-400" 
                                        value={nameInput} 
                                        onChange={e => setNameInput(e.target.value)} 
                                        placeholder="e.g. Welcome Message" 
                                        maxLength={40} 
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold tracking-[0.05em] uppercase text-slate-500 mb-1.5 font-sans">Category</label>
                                    <select 
                                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 font-sans text-sm text-slate-700 outline-none transition-all focus:border-[#00a884] focus:ring-2 focus:ring-[#00a884]/10 cursor-pointer"
                                        value={categoryInput}
                                        onChange={(e) => setCategoryInput(e.target.value)}
                                    >
                                        <option value="Marketing">Marketing</option>
                                        <option value="Utility">Utility</option>
                                        <option value="Authentication">Authentication</option>
                                    </select>
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-[10px] font-bold tracking-[0.05em] uppercase text-slate-500 mb-1.5 font-sans">Twilio Content SID <span className="text-rose-500">*</span></label>
                                <input 
                                    ref={sidInputRef} 
                                    type="text" 
                                    className={`w-full bg-slate-50 border rounded-lg px-3 py-2.5 font-mono text-sm text-slate-700 outline-none transition-all focus:ring-2 placeholder:text-slate-400 ${sidError ? "border-rose-300 focus:border-rose-400 focus:ring-rose-400/10" : "border-slate-200 focus:border-[#00a884] focus:ring-[#00a884]/10"}`} 
                                    value={sidInput} 
                                    onChange={e => { setSidInput(e.target.value); setSidError(""); }} 
                                    onKeyDown={e => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") resetForm(); }} 
                                    placeholder="HXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" 
                                    spellCheck={false} 
                                />
                                {sidError && <div className="text-[11px] text-rose-500 font-medium font-sans mt-1">⚠ {sidError}</div>}
                            </div>

                            <div className="flex gap-2 mt-1 border-t border-slate-100 pt-4">
                                <button className="flex-1 py-2.5 px-4 bg-slate-100 border-none rounded-lg cursor-pointer text-slate-600 font-sans text-sm font-bold transition-all hover:bg-slate-200" onClick={resetForm}>
                                    Cancel
                                </button>
                                <button className="flex-[2] py-2.5 px-4 bg-[#00a884] border-none rounded-lg cursor-pointer text-white font-sans text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-[0_2px_8px_rgba(0,168,132,0.25)] hover:bg-[#059669] hover:shadow-[0_4px_12px_rgba(0,168,132,0.3)] hover:-translate-y-px disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none" onClick={handleSave} disabled={adding || !sidInput.trim()}>
                                    {adding ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} strokeWidth={2.5} />}
                                    {editId ? "Update Template" : "Save Template"}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}