"use client";

import React, { useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { useCrmLayout } from "@/shared/components/layout/CrmShell";
import { toast } from "react-toastify";
import { twilioTemplateService } from "@/features/templates/services/twilioTemplateService";
import { useRouter } from "next/navigation";
import {
  LayoutTemplate, ShieldAlert, Loader2, Menu,
  MessageSquare, Save, Image as ImageIcon,
  Link as LinkIcon, Trash2, UploadCloud, Bold, Italic, Strikethrough,
  Variable, ExternalLink, PhoneCall, FastForward, ChevronLeft, Signal, Wifi, Battery, MoreVertical
} from "lucide-react";

export default function CreateTemplate() {
  const { data: session, status } = useSession();
  const { setMobileOpen } = useCrmLayout();
  const router = useRouter();

  // --- FORM STATE ---
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    category: "UTILITY", name: "", language: "en", templateType: "TEXT",
    headerType: "NONE", headerText: "", body: "", footerText: "",
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const fileInputRef = useRef(null);
  const [buttons, setButtons] = useState([]);

  const isAuthorized = session?.user?.role === "superAdmin" || session?.user?.department === "admin";

  const handleCreateTemplate = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.body) return toast.warning("Name and Body are required.");
    if (formData.headerType === "MEDIA" && !imageFile) return toast.warning("Please upload a media image.");
    for (let b of buttons) {
      if (!b.title) return toast.warning("Please fill button titles.");
      if (b.type !== "QUICK_REPLY" && !b.value) return toast.warning("Please fill button URL/Phone values.");
    }

    setIsCreating(true);
    try {
      const allText = (formData.headerText || "") + " " + (formData.body || "");
      const variableMatches = allText.match(/\{\{(\d+)\}\}/g);
      const varMap = {};
      if (variableMatches) {
        [...new Set(variableMatches)].forEach((match) => {
          const num = match.replace(/[{}]/g, "");
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

      await twilioTemplateService.createTemplate(submitData);
      toast.success("Template created successfully!");
      
      // Route back to the template manager library view
      router.push("/crm/admin/template-manager");
    } catch (error) { 
        toast.error(error.message || "Failed to create template."); 
    } finally { 
        setIsCreating(false); 
    }
  };

  // --- FORM HELPERS ---
  const insertBodyVariable = () => {
    const currentBody = formData.body || "";
    const matches = currentBody.match(/\{\{(\d+)\}\}/g);
    let nextNum = 1;
    if (matches) {
      const nums = matches.map((m) => parseInt(m.replace(/[{}]/g, ""), 10));
      nextNum = Math.max(...nums) + 1;
    }
    setFormData((prev) => ({ ...prev, body: prev.body + `{{${nextNum}}}` }));
  };

  const insertHeaderVariable = () => {
    const currentHeader = formData.headerText || "";
    if (!currentHeader.includes("{{1}}")) setFormData((prev) => ({ ...prev, headerText: prev.headerText + "{{1}}" }));
    else toast.warning("Headers can only contain one variable: {{1}}");
  };

  const handleAddButton = () => {
    if (buttons.length >= 3) return toast.warning("Maximum 3 buttons allowed.");
    setButtons([...buttons, { type: "QUICK_REPLY", title: "", value: "" }]);
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

  const insertFormatting = (syntax) => setFormData((prev) => ({ ...prev, body: prev.body + syntax }));

  const formatPreviewBody = (text) => {
    if (!text) return { __html: "Your message body will appear here..." };
    let formatted = text
      .replace(/\*([^\*]+)\*/g, "<strong>$1</strong>")
      .replace(/_([^_]+)_/g, "<em>$1</em>")
      .replace(/~([^~]+)~/g, "<del>$1</del>")
      .replace(/\{\{(\d+)\}\}/g, `<span class="bg-blue-100 text-blue-800 px-1 rounded mx-0.5">{{$1}}</span>`);
    return { __html: formatted.replace(/\n/g, "<br/>") };
  };

  if (status === "loading") return <div className="flex h-screen items-center justify-center text-slate-500 font-bold tracking-widest uppercase text-sm"><Loader2 className="animate-spin mr-2" size={20} /> Verifying Access...</div>;
  if (!isAuthorized) return <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative"><div className="flex flex-1 w-full h-full flex-col items-center justify-center p-6 text-center"><ShieldAlert size={80} className="text-rose-400 mb-6" /><h2 className="text-3xl font-extrabold text-slate-800">Clearance Required</h2></div></div>;

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative bg-[#f8fafc]">
        <header className="h-auto md:h-20 px-6 py-4 md:py-0 bg-white border-b border-slate-200 flex items-center justify-between shrink-0 z-20 shadow-sm gap-4 select-none">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileOpen(true)} className="md:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-lg"><Menu size={24} /></button>
            <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition border border-transparent hover:border-slate-200 mr-2 hidden md:block">
                <ChevronLeft size={20} />
            </button>
            <div>
              <h1 className="text-xl md:text-2xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2"><LayoutTemplate className="text-[#00a884]" size={24} /> Create WhatsApp Template</h1>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mt-0.5 ml-1">Fill in the details to create a new WhatsApp template</p>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 custom-scrollbar">
          <div className="max-w-[1400px] mx-auto grid grid-cols-1 xl:grid-cols-12 gap-8">
            {/* COLUMN 1: FORM */}
            <div className="xl:col-span-7 space-y-6">
              <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-200/80 overflow-hidden flex flex-col">
                <div className="p-6 border-b border-slate-100 bg-slate-50/50"><h3 className="font-extrabold text-slate-800 flex items-center gap-2 text-lg"><MessageSquare size={20} className="text-[#00a884]" /> Template Details</h3></div>
                <form onSubmit={handleCreateTemplate} className="p-6 space-y-6">
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Template Type *</label>
                      <select value={formData.templateType} onChange={(e) => { const val = e.target.value; setFormData({ ...formData, templateType: val, headerType: val === "WHATSAPP_CARD" ? "MEDIA" : "NONE", }); }} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884] shadow-sm text-slate-700 transition-shadow">
                        <option value="TEXT">Simple Text</option>
                        <option value="CALL_TO_ACTION">Call To Action / Quick Reply</option>
                        <option value="WHATSAPP_CARD">WhatsApp Card</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Language *</label>
                      <select value={formData.language} onChange={(e) => setFormData({ ...formData, language: e.target.value }) } className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884] shadow-sm text-slate-700 transition-shadow">
                        <option value="en">English (en)</option>
                        <option value="ta">Tamil (ta)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Category *</label>
                      <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value }) } className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884] shadow-sm text-slate-700 transition-shadow">
                        <option value="MARKETING">Marketing</option>
                        <option value="UTILITY">Utility</option>
                        <option value="AUTHENTICATION">Authentication</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Template Name *</label>
                      <input type="text" required placeholder="e.g., promo_offer_01" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""), }) } className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884] shadow-sm transition-shadow" />
                    </div>
                  </div>

                  <hr className="border-slate-100" />

                  <div className="space-y-3">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Header (Optional)</label>
                    <select value={formData.headerType} onChange={(e) => setFormData({ ...formData, headerType: e.target.value, headerText: "", }) } className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884] shadow-sm text-slate-700 transition-shadow">
                      <option value="NONE">None</option>
                      <option value="TEXT">Text</option>
                      <option value="MEDIA">Media (Image/Video/Document)</option>
                    </select>

                    {formData.headerType === "TEXT" && (
                      <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Header Text</label>
                          <button type="button" onClick={insertHeaderVariable} className="px-2 py-1 bg-[#00a884]/10 text-[#00a884] rounded font-bold text-[10px] hover:bg-[#00a884]/20 flex items-center gap-1 transition-colors"><Variable size={12} /> ADD VARIABLE</button>
                        </div>
                        <input type="text" placeholder="Header text (max 60 chars)" maxLength={60} value={formData.headerText} onChange={(e) => setFormData({ ...formData, headerText: e.target.value, }) } className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884] shadow-sm transition-shadow" />
                      </div>
                    )}

                    {formData.headerType === "MEDIA" && (
                      <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100 border-dashed flex items-center gap-4 animate-in fade-in slide-in-from-top-2">
                        <label className="flex-1 cursor-pointer flex items-center justify-center gap-2 bg-white border border-slate-200 hover:border-emerald-400 hover:shadow-md text-slate-600 px-4 py-2.5 rounded-xl transition-all shadow-sm">
                          <UploadCloud size={18} className="text-emerald-500" />
                          <span className="text-sm font-bold truncate max-w-[200px]">{imageFile ? imageFile.name : "Choose File"}</span>
                          <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} ref={fileInputRef} />
                        </label>
                        {imageFile && (
                          <button type="button" onClick={() => { setImageFile(null); setImagePreview(""); fileInputRef.current.value = ""; }} className="p-2.5 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-100 transition shadow-sm border border-rose-100" title="Remove image">
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Body *</label>
                      <div className="flex items-center gap-1.5">
                        <button type="button" onClick={() => insertFormatting("* *")} className="p-1.5 bg-slate-100 rounded text-slate-600 hover:bg-slate-200 transition-colors" title="Bold"><Bold size={14} /></button>
                        <button type="button" onClick={() => insertFormatting("_ _")} className="p-1.5 bg-slate-100 rounded text-slate-600 hover:bg-slate-200 transition-colors" title="Italic"><Italic size={14} /></button>
                        <button type="button" onClick={() => insertFormatting("~ ~")} className="p-1.5 bg-slate-100 rounded text-slate-600 hover:bg-slate-200 transition-colors" title="Strikethrough"><Strikethrough size={14} /></button>
                        <button type="button" onClick={insertBodyVariable} className="px-2 py-1 ml-1 bg-[#00a884]/10 text-[#00a884] rounded font-bold text-[10px] hover:bg-[#00a884]/20 flex items-center gap-1 transition-colors"><Variable size={12} /> ADD VARIABLE</button>
                      </div>
                    </div>
                    <textarea required rows={5} placeholder="Type your message here..." value={formData.body} onChange={(e) => setFormData({ ...formData, body: e.target.value }) } className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884] shadow-sm resize-none leading-relaxed transition-shadow custom-scrollbar" />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Footer (Optional)</label>
                    <input type="text" placeholder="Short footer text..." maxLength={60} value={formData.footerText} onChange={(e) => setFormData({ ...formData, footerText: e.target.value }) } className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884] shadow-sm transition-shadow" />
                  </div>

                  <hr className="border-slate-100" />

                  {(formData.templateType === "CALL_TO_ACTION" || formData.templateType === "WHATSAPP_CARD") && (
                    <div className="space-y-3 animate-in fade-in">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5"><LinkIcon size={14} /> Actions</label>
                        <button type="button" onClick={handleAddButton} className="text-[11px] font-bold bg-[#00a884]/10 text-[#00a884] px-3 py-1.5 rounded-lg hover:bg-[#00a884]/20 transition-colors shadow-sm">+ Add Action</button>
                      </div>

                      {buttons.length === 0 && <p className="text-xs text-slate-400 italic">No buttons added.</p>}

                      {buttons.map((btn, index) => (
                        <div key={index} className="flex flex-col gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200 relative group animate-in slide-in-from-top-2">
                          <button type="button" onClick={() => handleRemoveButton(index)} className="absolute top-2 right-2 text-rose-500 hover:bg-rose-100 p-1.5 rounded-md transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100" aria-label="Remove button"><Trash2 size={14} /></button>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pr-6">
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Type of action</label>
                              <select value={btn.type} onChange={(e) => handleButtonChange( index, "type", e.target.value ) } className="w-full bg-white border border-slate-200 rounded-lg text-xs font-bold px-3 py-2.5 outline-none focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884] shadow-sm text-slate-700 cursor-pointer transition-shadow">
                                <option value="QUICK_REPLY">Quick Reply</option>
                                <option value="URL">Visit Website</option>
                                <option value="PHONE_NUMBER">Call Phone Number</option>
                              </select>
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Button Text</label>
                              <input type="text" placeholder="e.g. Buy Now" value={btn.title} maxLength={25} onChange={(e) => handleButtonChange( index, "title", e.target.value ) } className="w-full bg-white border border-slate-200 rounded-lg text-xs font-medium px-3 py-2.5 outline-none focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884] shadow-sm transition-shadow" />
                            </div>
                          </div>

                          {btn.type !== "QUICK_REPLY" && (
                            <div className="space-y-1.5 mt-1 animate-in fade-in">
                              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{btn.type === "URL" ? "Website URL (https://...)" : "Phone Number (+91...)"}</label>
                              <input type={btn.type === "URL" ? "url" : "text"} placeholder={ btn.type === "URL" ? "https://example.com" : "+91 9876543210" } value={btn.value} onChange={(e) => handleButtonChange( index, "value", e.target.value ) } className="w-full bg-white border border-slate-200 rounded-lg text-xs font-medium px-3 py-2.5 outline-none focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884] shadow-sm transition-shadow" />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <button type="submit" disabled={isCreating} className="w-full flex items-center justify-center gap-2 bg-[#00a884] text-white px-4 py-3.5 rounded-xl text-sm font-bold shadow-lg shadow-[#00a884]/30 hover:bg-[#008f6f] active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed mt-4">
                    {isCreating ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save Template
                  </button>
                </form>
              </div>
            </div>

            {/* COLUMN 2: RESPONSIVE LIVE PREVIEW DEVICE */}
            <div className="xl:col-span-5 relative">
              <div className="xl:sticky xl:top-6 flex flex-col items-center w-full">
                <h3 className="text-sm font-extrabold text-slate-800 mb-6 uppercase tracking-widest text-center flex items-center gap-2"><LayoutTemplate size={16} /> Live Preview</h3>
                <div className="relative w-full max-w-[360px] aspect-[9/19] bg-slate-900 rounded-[3rem] p-[10px] shadow-2xl border-[1px] border-slate-700/50 before:absolute before:inset-0 before:rounded-[3rem] before:shadow-[inset_0_0_2px_rgba(255,255,255,0.2)] mx-auto">
                  <div className="absolute top-0 inset-x-0 h-7 flex justify-center z-30 pt-[12px]"><div className="w-[120px] h-[30px] bg-black rounded-full flex items-center justify-between px-3"><div className="w-3 h-3 rounded-full bg-slate-800/80 shadow-inner"></div><div className="w-2 h-2 rounded-full bg-blue-900/40"></div></div></div>
                  <div className="absolute -left-[3px] top-[100px] w-[3px] h-8 bg-slate-800 rounded-l-md"></div><div className="absolute -left-[3px] top-[140px] w-[3px] h-12 bg-slate-800 rounded-l-md"></div><div className="absolute -left-[3px] top-[200px] w-[3px] h-12 bg-slate-800 rounded-l-md"></div><div className="absolute -right-[3px] top-[140px] w-[3px] h-16 bg-slate-800 rounded-r-md"></div>
                  
                  <div className="w-full h-full bg-[#EFEAE2] rounded-[2.2rem] overflow-hidden flex flex-col relative z-20">
                    <div className="absolute inset-0 opacity-[0.035] pointer-events-none mix-blend-multiply" style={{ backgroundImage: "url('https://i.pinimg.com/originals/97/c0/07/97c00759d90d786d9b6096d274ad3e07.png')", backgroundSize: '250px' }}></div>
                    <div className="h-12 w-full bg-[#008069] flex items-end justify-between px-6 pb-2 text-white/90 z-20"><span className="text-[12px] font-semibold pl-2">9:41</span><div className="flex items-center gap-1.5 pr-1"><Signal size={12} /><Wifi size={12} /><Battery size={14} className="ml-0.5" /></div></div>
                    <div className="bg-[#008069] text-white px-4 py-2.5 flex items-center gap-3 shadow-md z-20 shrink-0"><button className="text-white/90"><ChevronLeft size={20}/></button><div className="w-9 h-9 bg-white/10 rounded-full flex items-center justify-center shrink-0 border border-white/20"><img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" alt="Avatar" className="w-full h-full rounded-full opacity-0" /><LayoutTemplate size={18} className="absolute text-white/90" /></div><div className="flex flex-col min-w-0 flex-1"><span className="font-bold text-[15px] leading-tight truncate">Almaa Herbal Nature</span><span className="text-[11px] text-white/80 font-medium">Business Account</span></div><div className="flex items-center gap-4 text-white/90 ml-1"><MoreVertical size={20}/></div></div>
                    
                    <div className="flex-1 p-4 overflow-y-auto custom-scrollbar flex flex-col justify-end z-10 relative space-y-4">
                      <div className="flex justify-center mb-2"><div className="bg-[#E1F3FB] text-slate-600 text-[11px] font-medium px-3 py-1 rounded-lg shadow-sm">Today</div></div>
                      
                      {formData.templateType === "WHATSAPP_CARD" ? (
                        <div className="w-full self-start overflow-x-auto pb-2 snap-x snap-mandatory hide-scrollbar">
                          <div className="flex gap-2.5 w-max px-1">
                            <div className="bg-white rounded-xl shadow-sm overflow-hidden w-[260px] shrink-0 border border-slate-200 snap-center flex flex-col">
                              {formData.headerType === "MEDIA" && (
                                <div className="w-full h-36 bg-slate-100 flex items-center justify-center overflow-hidden border-b border-slate-100 relative group">{imagePreview ? (<img src={imagePreview} alt="Preview" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />) : (<ImageIcon size={32} className="text-slate-300" />)}</div>
                              )}
                              {formData.headerType === "TEXT" && formData.headerText && <div className="p-3.5 pb-0 font-extrabold text-[15px] text-slate-800 leading-tight">{formData.headerText}</div>}
                              <div className="p-3.5 flex-1"><div className="text-[13.5px] text-[#111b21] leading-relaxed word-break" dangerouslySetInnerHTML={formatPreviewBody(formData.body)}/>{formData.footerText && (<div className="text-[11.5px] text-[#667781] mt-2 font-medium">{formData.footerText}</div>)}</div>
                              {buttons.length > 0 && (<div className="border-t border-slate-200/60 flex flex-col bg-white">{buttons.map((btn, i) => (<div key={i} className="flex items-center justify-center gap-2 py-3 border-b last:border-b-0 border-slate-200/60 text-[#00a884] font-semibold text-[14px] hover:bg-slate-50 cursor-pointer transition-colors active:bg-slate-100">{btn.type === "URL" ? <ExternalLink size={16} /> : btn.type === "PHONE_NUMBER" ? <PhoneCall size={16} /> : <FastForward size={16} />}{btn.title || "Button Text"}</div>))}</div>)}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-white rounded-[1.1rem] rounded-tl-none shadow-sm overflow-hidden max-w-[280px] w-full self-start relative">
                          {formData.headerType === "MEDIA" && (
                            <div className="w-full h-40 bg-slate-100 flex items-center justify-center overflow-hidden relative group p-1">{imagePreview ? (<img src={imagePreview} alt="Preview" className="w-full h-full object-cover rounded-xl transition-transform duration-500 group-hover:scale-105" />) : (<div className="w-full h-full rounded-xl bg-slate-200/50 flex items-center justify-center border border-slate-200/50"><ImageIcon size={32} className="text-slate-400" /></div>)}</div>
                          )}
                          <div className="p-3 pb-2 pt-2.5">
                            {formData.headerType === "TEXT" && formData.headerText && <div className="font-extrabold text-[15px] text-slate-800 mb-1.5 leading-snug">{formData.headerText}</div>}
                            <div className="text-[14px] text-[#111b21] leading-relaxed whitespace-pre-wrap word-break" dangerouslySetInnerHTML={formatPreviewBody(formData.body)}/>
                            <div className="flex items-end justify-between mt-1.5 gap-2"><div className="flex-1">{formData.footerText && <div className="text-[12px] text-[#667781] font-medium leading-tight">{formData.footerText}</div>}</div><div className="text-right text-[10.5px] text-[#667781] font-medium shrink-0 pt-1">12:00 PM</div></div>
                          </div>
                          {buttons.length > 0 && (<div className="border-t border-slate-200/60 flex flex-col bg-white">{buttons.map((btn, i) => (<div key={i} className="flex items-center justify-center gap-2 py-3 border-b last:border-b-0 border-slate-200/60 text-[#008069] font-semibold text-[14.5px] hover:bg-slate-50 cursor-pointer transition-colors active:bg-slate-100">{btn.type === "URL" ? <ExternalLink size={16} /> : btn.type === "PHONE_NUMBER" ? <PhoneCall size={16} /> : <FastForward size={16} />}{btn.title || "Button Text"}</div>))}</div>)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
    </div>
  );
}