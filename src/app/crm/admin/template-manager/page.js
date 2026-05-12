"use client";

import React, { useState, useRef, useEffect } from "react";
import { useSession } from "next-auth/react";
import { toast } from "react-toastify";
import { 
    LayoutTemplate, ShieldAlert, Loader2, Menu, 
    Send, PlusCircle, CheckCircle2, Clock, 
    MessageSquare, AlertCircle, Save, Image as ImageIcon,
    Link as LinkIcon, Trash2, UploadCloud, Bold, Italic, 
    Strikethrough, Variable, ExternalLink, PhoneCall, FastForward,
    Database, RefreshCw, XCircle
} from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";

export default function TemplateManager() {
    const { data: session, status } = useSession();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    
    const [isCreating, setIsCreating] = useState(false);
    const [formData, setFormData] = useState({ 
        category: "UTILITY", name: "", language: "en", templateType: "TEXT",
        headerType: "NONE", headerText: "", body: "", footerText: "" 
    });
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState("");
    const fileInputRef = useRef(null);

    const [buttons, setButtons] = useState([]);
    const [createdTemplate, setCreatedTemplate] = useState(null);

    const [templates, setTemplates] = useState([]);
    const [loadingLibrary, setLoadingLibrary] = useState(true);

    const [isSending, setIsSending] = useState(false);
    const [testPhone, setTestPhone] = useState("");
    const [variables, setVariables] = useState({});

    const isAuthorized = session?.user?.role === 'superAdmin' || session?.user?.department === 'admin';

    const fetchTemplates = async () => {
        setLoadingLibrary(true);
        try {
            const res = await fetch("/api/admin/templates/create");
            const data = await res.json();
            if (data.success) setTemplates(data.templates);
        } catch (err) {
            console.error("Error fetching templates");
        } finally {
            setLoadingLibrary(false);
        }
    };

    useEffect(() => {
        if (isAuthorized) fetchTemplates();
    }, [isAuthorized]);

    const checkApprovalStatus = async (sid) => {
        const loadingId = toast.loading("Syncing status from Twilio...");
        try {
            const res = await fetch(`/api/admin/templates/approval?sid=${sid}`);
            const data = await res.json();
            if (data.success) {
                toast.update(loadingId, { render: `Status: ${data.status.toUpperCase()}`, type: "success", isLoading: false, autoClose: 3000 });
                setTemplates(prev => prev.map(t => t.sid === sid ? { ...t, approvalStatus: data.status } : t));
                if (createdTemplate?.contentSid === sid) setCreatedTemplate(prev => ({ ...prev, approvalStatus: data.status }));
            } else {
                toast.update(loadingId, { render: data.error || "Failed to check status", type: "error", isLoading: false, autoClose: 3000 });
            }
        } catch (err) {
            toast.update(loadingId, { render: "Network error", type: "error", isLoading: false, autoClose: 3000 });
        }
    };

    const manualSubmitToWhatsApp = async (template) => {
        const loadingId = toast.loading("Submitting template to WhatsApp...");
        try {
            const res = await fetch(`/api/admin/templates/approval`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sid: template.sid, name: template.name, category: template.category })
            });
            const data = await res.json();
            if (data.success) {
                toast.update(loadingId, { render: `Successfully submitted! Pending approval.`, type: "success", isLoading: false, autoClose: 4000 });
                setTemplates(prev => prev.map(t => t.sid === template.sid ? { ...t, approvalStatus: "pending" } : t));
                if (createdTemplate?.contentSid === template.sid) setCreatedTemplate(prev => ({ ...prev, approvalStatus: "pending" }));
            } else {
                toast.update(loadingId, { render: data.error || "Submission failed", type: "error", isLoading: false, autoClose: 5000 });
            }
        } catch (err) {
            toast.update(loadingId, { render: "Network error", type: "error", isLoading: false, autoClose: 3000 });
        }
    };

    const insertBodyVariable = () => {
        const currentBody = formData.body || "";
        const matches = currentBody.match(/\{\{(\d+)\}\}/g);
        let nextNum = 1;
        if (matches) {
            const nums = matches.map(m => parseInt(m.replace(/[{}]/g, ''), 10));
            nextNum = Math.max(...nums) + 1;
        }
        setFormData(prev => ({ ...prev, body: prev.body + `{{${nextNum}}}` }));
    };

    const insertHeaderVariable = () => {
        const currentHeader = formData.headerText || "";
        if (!currentHeader.includes('{{1}}')) setFormData(prev => ({ ...prev, headerText: prev.headerText + '{{1}}' }));
        else toast.warning("Headers can only contain one variable: {{1}}");
    };

    const handleAddButton = () => {
        if (buttons.length >= 3) return toast.warning("Maximum 3 buttons allowed.");
        setButtons([...buttons, { type: 'QUICK_REPLY', title: '', value: '' }]);
    };

    const handleButtonChange = (index, field, val) => {
        const newButtons = [...buttons];
        newButtons[index][field] = val;
        setButtons(newButtons);
    };

    const handleRemoveButton = (index) => setButtons(buttons.filter((_, i) => i !== index));

    const handleImageChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
        }
    };

    const insertFormatting = (syntax) => setFormData(prev => ({ ...prev, body: prev.body + syntax }));

    const handleCreateTemplate = async (e) => {
        e.preventDefault();
        if (!formData.name || !formData.body) return toast.warning("Name and Body are required.");
        if (formData.headerType === 'MEDIA' && !imageFile) return toast.warning("Please upload a media image.");

        for (let b of buttons) {
            if (!b.title) return toast.warning("Please fill button titles.");
            if (b.type !== 'QUICK_REPLY' && !b.value) return toast.warning("Please fill button URL/Phone values.");
        }

        setIsCreating(true);
        try {
            const allText = (formData.headerText || "") + " " + (formData.body || "");
            const variableMatches = allText.match(/\{\{(\d+)\}\}/g);
            const varMap = {};
            if (variableMatches) {
                [...new Set(variableMatches)].forEach(match => {
                    const num = match.replace(/[{}]/g, '');
                    varMap[num] = `Variable_${num}`;
                });
            }

            const submitData = new FormData();
            submitData.append("friendly_name", formData.name);
            submitData.append("category", formData.category);
            submitData.append("language", formData.language);
            submitData.append("templateType", formData.templateType);
            submitData.append("headerType", formData.headerType);
            submitData.append("headerText", formData.headerText);
            submitData.append("body", formData.body);
            submitData.append("footerText", formData.footerText);
            submitData.append("variables", JSON.stringify(varMap));
            submitData.append("buttons", JSON.stringify(buttons));
            if (imageFile) submitData.append("image", imageFile);

            const res = await fetch("/api/admin/templates/create", { method: "POST", body: submitData });
            const data = await res.json();

            if (res.ok && data.success) {
                toast.success("Template Saved! Fetching library...");
                setCreatedTemplate({ ...data, rawBody: formData.body, variables: varMap });
                setFormData({ category: "UTILITY", name: "", language: "en", templateType: "TEXT", headerType: "NONE", headerText: "", body: "", footerText: "" });
                setImageFile(null); setImagePreview(""); setButtons([]);
                if(fileInputRef.current) fileInputRef.current.value = "";
                if (data.template) setTemplates(prev => [data.template, ...prev]);
            } else {
                toast.error(data.error || "Failed to create template");
            }
        } catch (error) {
            toast.error("Network Error");
        } finally {
            setIsCreating(false);
        }
    };

    const handleSendTest = async (e, forceTemplate = null) => {
        if (e) e.preventDefault();
        const templateToUse = forceTemplate || createdTemplate;

        if (!testPhone || !templateToUse?.contentSid) return toast.warning("Phone number and template required");

        setIsSending(true);
        try {
            const res = await fetch("/api/admin/templates/send", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ to: testPhone, contentSid: templateToUse.contentSid || templateToUse.sid, variables: variables })
            });

            const data = await res.json();
            if (res.ok && data.success) toast.success(`Message Sent! Status: ${data.status}`);
            else toast.error(data.error || "Failed to send message");
        } catch (error) {
            toast.error("Network Error");
        } finally {
            setIsSending(false);
        }
    };

    const formatPreviewBody = (text) => {
        if (!text) return { __html: "Your message body will appear here..." };
        let formatted = text
            .replace(/\*([^\*]+)\*/g, "<strong>$1</strong>")
            .replace(/_([^_]+)_/g, "<em>$1</em>")
            .replace(/~([^~]+)~/g, "<del>$1</del>")
            .replace(/\{\{(\d+)\}\}/g, `<span class="bg-blue-100 text-blue-800 px-1 rounded mx-0.5">{{$1}}</span>`);
        return { __html: formatted.replace(/\n/g, '<br/>') };
    };

    const getStatusBadge = (status) => {
        const s = status?.toLowerCase();
        if (s === 'approved') return <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200"><CheckCircle2 size={12}/> Approved</span>;
        if (s === 'rejected') return <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-rose-600 bg-rose-50 px-2.5 py-1 rounded-md border border-rose-200"><XCircle size={12}/> Rejected</span>;
        if (s === 'pending') return <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200"><Clock size={12}/> Pending Review</span>;
        return <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-600 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200"><AlertCircle size={12}/> {status || "Unsubmitted"}</span>;
    }

    if (status === "loading") return <div className="flex h-screen items-center justify-center text-slate-500 font-bold tracking-widest uppercase text-sm"><Loader2 className="animate-spin mr-2" size={20}/> Verifying Access...</div>;
    if (!isAuthorized) {
        return (
            <div className="flex h-[100dvh] bg-slate-50 overflow-hidden relative">
                <Sidebar role={session?.user?.role} mobileOpen={mobileMenuOpen} setMobileOpen={setMobileMenuOpen} />
                <div className="flex flex-1 w-full h-full flex-col items-center justify-center p-6 text-center">
                    <ShieldAlert size={80} className="text-rose-400 mb-6" />
                    <h2 className="text-3xl font-extrabold text-slate-800">Clearance Required</h2>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-[100dvh] bg-[#f8fafc] font-sans overflow-hidden">
            {mobileMenuOpen && <div className="fixed inset-0 bg-black/40 z-40 md:hidden backdrop-blur-sm transition-opacity" onClick={() => setMobileMenuOpen(false)} />}
            
            <Sidebar role={session?.user?.role} mobileOpen={mobileMenuOpen} setMobileOpen={setMobileMenuOpen} />

            <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
                
                <header className="h-auto md:h-20 px-6 py-4 md:py-0 bg-white border-b border-slate-200 flex items-center justify-between shrink-0 z-20 shadow-sm gap-4">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setMobileMenuOpen(true)} className="md:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-lg"><Menu size={24} /></button>
                        <div>
                            <h1 className="text-xl md:text-2xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
                                <LayoutTemplate className="text-[#00a884]" size={24} /> Template Builder
                            </h1>
                            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mt-0.5 ml-1">WhatsApp Campaign Manager</p>
                        </div>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 custom-scrollbar">
                    
                    {typeof window !== 'undefined' && window.location.hostname === 'localhost' && (
                        <div className="max-w-[1400px] mx-auto mb-6 bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl text-sm font-medium flex items-start gap-3">
                            <AlertCircle size={18} className="mt-0.5 shrink-0" />
                            <p><strong>Localhost Warning:</strong> You are testing on localhost. Twilio cannot download images from localhost. Ensure your <code className="bg-amber-100 px-1 rounded">NEXT_PUBLIC_BASE_URL</code> is set to an Ngrok URL.</p>
                        </div>
                    )}

                    <div className="max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">

                        {/* ================= COLUMN 1: FORM ================= */}
                        <div className="lg:col-span-7 space-y-6">
                            
                            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                                <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                                    <h3 className="font-extrabold text-slate-800 flex items-center gap-2 text-lg">
                                        <MessageSquare size={20} className="text-[#00a884]"/> Template Details
                                    </h3>
                                </div>
                                
                                <form onSubmit={handleCreateTemplate} className="p-6 space-y-6">
                                    
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Template Type *</label>
                                            <select 
                                                value={formData.templateType} 
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setFormData({...formData, templateType: val, headerType: val === 'WHATSAPP_CARD' ? 'MEDIA' : 'NONE'});
                                                }}
                                                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884] shadow-sm text-slate-700"
                                            >
                                                <option value="TEXT">Simple Text</option>
                                                <option value="CALL_TO_ACTION">Call To Action / Quick Reply</option>
                                                <option value="WHATSAPP_CARD">WhatsApp Card</option>
                                            </select>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Language *</label>
                                            <select 
                                                value={formData.language} onChange={(e) => setFormData({...formData, language: e.target.value})}
                                                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884] shadow-sm text-slate-700"
                                            >
                                                <option value="en">English (en)</option>
                                                <option value="ta">Tamil (ta)</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Category *</label>
                                            <select 
                                                value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})}
                                                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884] shadow-sm text-slate-700"
                                            >
                                                <option value="MARKETING">Marketing</option>
                                                <option value="UTILITY">Utility</option>
                                                <option value="AUTHENTICATION">Authentication</option>
                                            </select>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Template Name *</label>
                                            <input 
                                                type="text" required placeholder="e.g., promo_offer_01"
                                                value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')})}
                                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884] shadow-sm"
                                            />
                                        </div>
                                    </div>

                                    <hr className="border-slate-100" />

                                    {/* Header Section */}
                                    <div className="space-y-3">
                                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Header (Optional)</label>
                                        
                                        <select 
                                            value={formData.headerType} 
                                            onChange={(e) => setFormData({...formData, headerType: e.target.value, headerText: ""})}
                                            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884] shadow-sm text-slate-700"
                                        >
                                            <option value="NONE">None</option>
                                            {/* WhatsApp Cards cannot have both text and media headers simultaneously */}
                                            <option value="TEXT">Text</option>
                                            <option value="MEDIA">Media (Image/Video/Document)</option>
                                        </select>

                                        {formData.headerType === 'TEXT' && (
                                            <div className="space-y-1.5">
                                                <div className="flex items-center justify-between">
                                                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Header Text</label>
                                                    <button type="button" onClick={insertHeaderVariable} className="px-2 py-1 bg-[#00a884]/10 text-[#00a884] rounded font-bold text-[10px] hover:bg-[#00a884]/20 flex items-center gap-1 transition"><Variable size={12}/> ADD VARIABLE</button>
                                                </div>
                                                <input 
                                                    type="text" placeholder="Header text (max 60 chars)" maxLength={60}
                                                    value={formData.headerText} onChange={(e) => setFormData({...formData, headerText: e.target.value})}
                                                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-[#00a884] shadow-sm"
                                                />
                                            </div>
                                        )}

                                        {formData.headerType === 'MEDIA' && (
                                            <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100 border-dashed flex items-center gap-4">
                                                <label className="flex-1 cursor-pointer flex items-center justify-center gap-2 bg-white border border-slate-200 hover:border-emerald-400 text-slate-600 px-4 py-2.5 rounded-xl transition-all shadow-sm">
                                                    <UploadCloud size={18} className="text-emerald-500" />
                                                    <span className="text-sm font-bold">{imageFile ? imageFile.name : "Choose File"}</span>
                                                    <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} ref={fileInputRef} />
                                                </label>
                                                {imageFile && (
                                                    <button type="button" onClick={() => {setImageFile(null); setImagePreview(""); fileInputRef.current.value = "";}} className="p-2.5 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-100 transition shadow-sm border border-rose-100">
                                                        <Trash2 size={18}/>
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Body Section */}
                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Body *</label>
                                            <div className="flex items-center gap-1.5">
                                                <button type="button" onClick={() => insertFormatting('* *')} className="p-1.5 bg-slate-100 rounded text-slate-600 hover:bg-slate-200 transition"><Bold size={14}/></button>
                                                <button type="button" onClick={() => insertFormatting('_ _')} className="p-1.5 bg-slate-100 rounded text-slate-600 hover:bg-slate-200 transition"><Italic size={14}/></button>
                                                <button type="button" onClick={() => insertFormatting('~ ~')} className="p-1.5 bg-slate-100 rounded text-slate-600 hover:bg-slate-200 transition"><Strikethrough size={14}/></button>
                                                <button type="button" onClick={insertBodyVariable} className="px-2 py-1 ml-1 bg-[#00a884]/10 text-[#00a884] rounded font-bold text-[10px] hover:bg-[#00a884]/20 flex items-center gap-1 transition"><Variable size={12}/> ADD VARIABLE</button>
                                            </div>
                                        </div>
                                        <textarea 
                                            required rows={5} placeholder="Type your message here..."
                                            value={formData.body} onChange={(e) => setFormData({...formData, body: e.target.value})}
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884] shadow-sm resize-none leading-relaxed"
                                        />
                                    </div>

                                    {/* Footer Section */}
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Footer (Optional)</label>
                                        <input 
                                            type="text" placeholder="Short footer text..." maxLength={60}
                                            value={formData.footerText} onChange={(e) => setFormData({...formData, footerText: e.target.value})}
                                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-[#00a884] shadow-sm"
                                        />
                                    </div>

                                    <hr className="border-slate-100" />

                                    {/* Buttons Section */}
                                    {(formData.templateType === 'CALL_TO_ACTION' || formData.templateType === 'WHATSAPP_CARD') && (
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                                                    <LinkIcon size={14}/> Actions
                                                </label>
                                                <button 
                                                    type="button" onClick={handleAddButton} 
                                                    className="text-[11px] font-bold bg-[#00a884]/10 text-[#00a884] px-3 py-1.5 rounded-lg hover:bg-[#00a884]/20 transition shadow-sm"
                                                >
                                                    + Add Action
                                                </button>
                                            </div>
                                            
                                            {buttons.length === 0 && <p className="text-xs text-slate-400 italic">No buttons added.</p>}

                                            {buttons.map((btn, index) => (
                                                <div key={index} className="flex flex-col gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200 relative group">
                                                    <button type="button" onClick={() => handleRemoveButton(index)} className="absolute top-2 right-2 text-rose-500 hover:bg-rose-100 p-1.5 rounded-md transition"><Trash2 size={14}/></button>
                                                    
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pr-6">
                                                        <div className="space-y-1.5">
                                                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Type of action</label>
                                                            <select 
                                                                value={btn.type} onChange={(e) => handleButtonChange(index, 'type', e.target.value)}
                                                                className="w-full bg-white border border-slate-200 rounded-lg text-xs font-bold px-3 py-2.5 outline-none focus:border-[#00a884] shadow-sm text-slate-700 cursor-pointer"
                                                            >
                                                                <option value="QUICK_REPLY">Quick Reply</option>
                                                                <option value="URL">Visit Website</option>
                                                                <option value="PHONE_NUMBER">Call Phone Number</option>
                                                            </select>
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Button Text</label>
                                                            <input 
                                                                type="text" placeholder="e.g. Buy Now" value={btn.title} maxLength={25}
                                                                onChange={(e) => handleButtonChange(index, 'title', e.target.value)}
                                                                className="w-full bg-white border border-slate-200 rounded-lg text-xs font-medium px-3 py-2.5 outline-none focus:border-[#00a884] shadow-sm"
                                                            />
                                                        </div>
                                                    </div>

                                                    {btn.type !== 'QUICK_REPLY' && (
                                                        <div className="space-y-1.5 mt-1">
                                                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                                                {btn.type === 'URL' ? 'Website URL (https://...)' : 'Phone Number (+91...)'}
                                                            </label>
                                                            <input 
                                                                type={btn.type === 'URL' ? "url" : "text"} 
                                                                placeholder={btn.type === 'URL' ? "https://example.com" : "+91 9876543210"} 
                                                                value={btn.value}
                                                                onChange={(e) => handleButtonChange(index, 'value', e.target.value)}
                                                                className="w-full bg-white border border-slate-200 rounded-lg text-xs font-medium px-3 py-2.5 outline-none focus:border-[#00a884] shadow-sm"
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Submit */}
                                    <button 
                                        type="submit" disabled={isCreating}
                                        className="w-full flex items-center justify-center gap-2 bg-[#00a884] text-white px-4 py-3.5 rounded-xl text-sm font-bold shadow-lg shadow-[#00a884]/30 hover:bg-[#008f6f] active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed mt-4"
                                    >
                                        {isCreating ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} 
                                        Save Template
                                    </button>
                                </form>
                            </div>

                        </div>

                        {/* ================= COLUMN 2: LIVE PREVIEW & TESTING ================= */}
                        <div className="lg:col-span-5 relative space-y-8">
                            
                            {/* Live Preview UI */}
                            <div className="sticky top-6 flex flex-col items-center">
                                <h3 className="text-sm font-extrabold text-slate-800 mb-4 uppercase tracking-widest text-center flex items-center gap-2"><LayoutTemplate size={16}/> Live Preview</h3>
                                
                                <div className="w-[340px] h-[650px] bg-[#EFEAE2] rounded-[2.5rem] border-[12px] border-slate-800 shadow-2xl overflow-hidden flex flex-col relative before:absolute before:inset-0 before:opacity-[0.04] before:bg-[url('https://i.pinimg.com/originals/97/c0/07/97c00759d90d786d9b6096d274ad3e07.png')] before:bg-cover before:bg-center">
                                    
                                    <div className="bg-[#00a884] text-white px-4 py-3 flex items-center gap-3 shadow-md z-10 shrink-0">
                                        <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center"><LayoutTemplate size={16}/></div>
                                        <div className="flex flex-col">
                                            <span className="font-bold text-sm">Almaa Herbal Nature</span>
                                            <span className="text-[10px] text-white/80 font-medium">Business Account</span>
                                        </div>
                                    </div>

                                    <div className="flex-1 p-4 overflow-y-auto custom-scrollbar flex flex-col justify-end z-10 relative space-y-4">
                                        
                                        <div className="flex justify-center"><div className="bg-white/80 backdrop-blur-sm text-slate-500 text-[10px] font-bold px-3 py-1 rounded-lg uppercase tracking-wider shadow-sm">Today</div></div>

                                        {formData.templateType === 'WHATSAPP_CARD' ? (
                                            
                                            // WhatsApp Card Style (Carousel Items)
                                            <div className="w-full self-start overflow-x-auto pb-4 snap-x snap-mandatory hide-scrollbar">
                                                <div className="flex gap-3 w-max">
                                                    <div className="bg-white rounded-xl shadow-md overflow-hidden w-[240px] shrink-0 border border-slate-200 snap-center">
                                                        
                                                        {formData.headerType === 'MEDIA' && (
                                                            <div className="w-full h-32 bg-slate-100 flex items-center justify-center overflow-hidden border-b border-slate-100">
                                                                {imagePreview ? (
                                                                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <ImageIcon size={32} className="text-slate-300" />
                                                                )}
                                                            </div>
                                                        )}
                                                        {formData.headerType === 'TEXT' && formData.headerText && (
                                                            <div className="p-3 pb-0 font-extrabold text-[15px] text-slate-800 line-clamp-1">{formData.headerText}</div>
                                                        )}

                                                        <div className="p-3">
                                                            <div className="text-[12px] text-slate-600 leading-snug line-clamp-2" dangerouslySetInnerHTML={formatPreviewBody(formData.body)} />
                                                            {formData.footerText && (
                                                                <div className="text-[10px] text-slate-400 mt-1.5 font-medium line-clamp-1">{formData.footerText}</div>
                                                            )}
                                                        </div>
                                                        {buttons.length > 0 && (
                                                            <div className="border-t border-slate-100 flex flex-col bg-white">
                                                                {buttons.map((btn, i) => (
                                                                    <div key={i} className="flex items-center justify-center gap-2 py-2 border-b last:border-b-0 border-slate-100 text-[#00a884] font-medium text-[12px] hover:bg-slate-50 cursor-pointer">
                                                                        {btn.type === 'URL' ? <ExternalLink size={12}/> : btn.type === 'PHONE_NUMBER' ? <PhoneCall size={12}/> : <FastForward size={12} />}
                                                                        {btn.title || "Button Text"}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                        ) : (
                                            // Standard Message Bubble Style
                                            <div className="bg-white rounded-xl rounded-tl-none shadow-md overflow-hidden max-w-[280px] w-full self-start">
                                                {formData.headerType === 'MEDIA' && (
                                                    <div className="w-full h-36 bg-slate-100 flex items-center justify-center overflow-hidden">
                                                        {imagePreview ? (
                                                            <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                                                        ) : (
                                                            <ImageIcon size={32} className="text-slate-300" />
                                                        )}
                                                    </div>
                                                )}

                                                <div className="p-2.5">
                                                    {formData.headerType === 'TEXT' && formData.headerText && (
                                                        <div className="font-extrabold text-[15px] text-slate-800 mb-1 leading-snug">{formData.headerText}</div>
                                                    )}

                                                    <div className="text-[13.5px] text-slate-800 leading-[1.35] whitespace-pre-wrap word-break" dangerouslySetInnerHTML={formatPreviewBody(formData.body)} />

                                                    {formData.footerText && (
                                                        <div className="text-[11.5px] text-slate-400 mt-2 font-medium">{formData.footerText}</div>
                                                    )}
                                                    <div className="text-right text-[10px] text-slate-400 mt-1">12:00 PM</div>
                                                </div>

                                                {buttons.length > 0 && (
                                                    <div className="border-t border-slate-100 flex flex-col bg-white">
                                                        {buttons.map((btn, i) => (
                                                            <div key={i} className="flex items-center justify-center gap-2 py-2.5 border-b last:border-b-0 border-slate-100 text-[#00a884] font-medium text-[13px] hover:bg-slate-50 cursor-pointer transition">
                                                                {btn.type === 'URL' ? <ExternalLink size={14}/> : btn.type === 'PHONE_NUMBER' ? <PhoneCall size={14}/> : <FastForward size={14} />}
                                                                {btn.title || "Button Text"}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>

                    {/* ================= TEMPLATE LIBRARY ================= */}
                    <div className="mt-12 max-w-[1400px] mx-auto bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                            <div>
                                <h3 className="font-extrabold text-slate-800 flex items-center gap-2 text-lg">
                                    <Database size={20} className="text-[#00a884]"/> Template Library
                                </h3>
                                <p className="text-xs text-slate-500 font-medium mt-1">Manage and sync WhatsApp approval statuses.</p>
                            </div>
                            <button onClick={fetchTemplates} disabled={loadingLibrary} className="p-2 bg-white rounded-xl border border-slate-200 shadow-sm hover:bg-slate-50 transition active:scale-95 disabled:opacity-50">
                                <RefreshCw size={18} className={`text-[#00a884] ${loadingLibrary ? 'animate-spin' : ''}`}/>
                            </button>
                        </div>

                        <div className="overflow-x-auto min-h-[300px]">
                            {loadingLibrary ? (
                                <div className="flex flex-col items-center justify-center p-12 text-slate-400">
                                    <Loader2 size={32} className="animate-spin text-[#00a884] mb-4" />
                                    <p className="text-sm font-bold uppercase tracking-widest">Loading Library...</p>
                                </div>
                            ) : templates.length === 0 ? (
                                <div className="p-12 text-center text-slate-500 font-bold">No templates created yet.</div>
                            ) : (
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-white text-slate-500 text-[10px] uppercase font-bold tracking-wider border-b border-slate-200">
                                        <tr>
                                            <th className="px-6 py-4">Name & Type</th>
                                            <th className="px-6 py-4">Category</th>
                                            <th className="px-6 py-4">Language</th>
                                            <th className="px-6 py-4">WhatsApp Status</th>
                                            <th className="px-6 py-4 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 text-sm">
                                        {templates.map((tpl) => (
                                            <tr key={tpl._id} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="font-extrabold text-slate-800">{tpl.name}</div>
                                                    <div className="text-[10px] font-mono text-slate-400 mt-1">{tpl.templateType}</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider">{tpl.category}</span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="font-bold text-slate-600 uppercase">{tpl.language}</span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    {getStatusBadge(tpl.approvalStatus)}
                                                </td>
                                                <td className="px-6 py-4 text-right space-x-2">
                                                    <button onClick={() => checkApprovalStatus(tpl.sid)} className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold hover:bg-indigo-100 transition shadow-sm border border-indigo-100">
                                                        Check Status
                                                    </button>
                                                    {(tpl.approvalStatus === 'failed_submission' || tpl.approvalStatus === 'unsubmitted') && (
                                                        <button onClick={() => manualSubmitToWhatsApp(tpl)} className="px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-bold hover:bg-emerald-100 transition shadow-sm border border-emerald-100">
                                                            Submit
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>

                </main>
            </div>
        </div>
    );
}