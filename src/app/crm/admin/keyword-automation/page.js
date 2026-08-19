"use client";
import { useState, useEffect } from "react";
import { 
  Search, Plus, Edit2, Trash2, Zap, 
  Loader2, MessageSquareCode, Check, X, 
  AlertCircle, Activity, FileText, Layers, Variable
} from "lucide-react";
import { automationRepository } from "@/shared/api/repositories/automationRepository";
import { crmTemplateRepository } from "@/shared/api/repositories/crmTemplateRepository";
import { toast } from "react-toastify";

export default function KeywordAutomationPage() {
  const [keywords, setKeywords] = useState([]);
  const [crmTemplates, setCrmTemplates] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [currentEdit, setCurrentEdit] = useState(null);
  const [keywordInput, setKeywordInput] = useState("");
  const [formData, setFormData] = useState({
    keywords: [],
    templateType: "whatsapp",
    templateId: "",
    templateSid: "",
    isActive: true,
  });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchKeywords = async () => {
    setLoading(true);
    try {
      const { data: json } = await automationRepository.getKeywords();
      if (json.success) setKeywords(json.data);
    } catch (err) {
      console.error("Failed to fetch keywords", err);
      toast.error("Failed to fetch keywords");
    }
    setLoading(false);
  };

  const fetchCrmTemplates = async () => {
    try {
      const { data: json } = await crmTemplateRepository.getTemplates({ status: "active" });
      if (json.success) setCrmTemplates(json.data || []);
    } catch (err) {
      console.error("Failed to fetch CRM templates", err);
    }
  };

  useEffect(() => {
    fetchKeywords();
    fetchCrmTemplates();
  }, []);

  const addKeyword = (rawWord) => {
    const word = rawWord.trim().toLowerCase();
    if (!word) return;
    if (word.length > 100) {
      toast.warn("Keyword too long (max 100 characters)");
      return;
    }
    setFormData((prev) => {
      if (prev.keywords.includes(word)) {
        return prev;
      }
      if (prev.keywords.length >= 50) {
        toast.warn("Maximum 50 keywords allowed per rule");
        return prev;
      }
      return {
        ...prev,
        keywords: [...prev.keywords, word],
      };
    });
    setKeywordInput("");
  };

  const handleOpenModal = (automationRule = null) => {
    setError("");
    setKeywordInput("");
    if (automationRule) {
      setCurrentEdit(automationRule._id);
      
      let initialKeywords = [];
      if (Array.isArray(automationRule.keywords) && automationRule.keywords.length > 0) {
        initialKeywords = [...automationRule.keywords];
      } else if (automationRule.key) {
        initialKeywords = [automationRule.key];
      }

      const tType = automationRule.templateType || (automationRule.templateId ? "crm" : "whatsapp");
      const tId = automationRule.templateId?._id || automationRule.templateId || "";

      setFormData({ 
        keywords: initialKeywords, 
        templateType: tType,
        templateId: tId,
        templateSid: automationRule.templateSid || "", 
        isActive: automationRule.isActive ?? true,
      });
    } else {
      setCurrentEdit(null);
      setFormData({
        keywords: [],
        templateType: "crm",
        templateId: crmTemplates[0]?._id || "",
        templateSid: "",
        isActive: true,
      });
    }
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    let finalKeywords = [...formData.keywords];
    const remainingInput = keywordInput.trim().toLowerCase();
    if (remainingInput && !finalKeywords.includes(remainingInput)) {
      if (remainingInput.length <= 100 && finalKeywords.length < 50) {
        finalKeywords.push(remainingInput);
      }
    }
    
    if (finalKeywords.length === 0) {
      setIsSubmitting(false);
      return setError("At least one trigger keyword is required.");
    }

    if (formData.templateType === "crm") {
      if (!formData.templateId) {
        setIsSubmitting(false);
        return setError("Please select a CRM Template.");
      }
    } else {
      if (!formData.templateSid.trim()) {
        setIsSubmitting(false);
        return setError("Twilio WhatsApp Template SID is required.");
      }
    }

    const payload = {
      keywords: finalKeywords,
      key: finalKeywords[0],
      templateType: formData.templateType,
      templateId: formData.templateType === "crm" ? formData.templateId : null,
      templateSid: formData.templateType === "whatsapp" ? formData.templateSid.trim() : "",
      isActive: formData.isActive,
    };

    try {
      if (currentEdit) {
        await automationRepository.updateKeyword(currentEdit, payload);
        toast.success("Keyword automation updated successfully");
      } else {
        await automationRepository.createKeyword(payload);
        toast.success("Keyword automation created successfully");
      }
      
      setModalOpen(false);
      fetchKeywords();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this automated keyword?")) return;
    await automationRepository.deleteKeyword(id);
    toast.success("Keyword automation deleted");
    fetchKeywords();
  };

  const handleToggle = async (id, currentStatus) => {
    const updatedStatus = !currentStatus;
    setKeywords(keywords.map((k) => (k._id === id ? { ...k, isActive: updatedStatus } : k)));
    await automationRepository.patchKeyword(id, { isActive: updatedStatus });
  };

  const filteredKeywords = keywords.filter((k) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    if (k.key && k.key.toLowerCase().includes(q)) return true;
    if (Array.isArray(k.keywords)) {
      if (k.keywords.some((kw) => kw.toLowerCase().includes(q))) return true;
    }
    if (k.templateSid && k.templateSid.toLowerCase().includes(q)) return true;
    if (k.templateId?.name && k.templateId.name.toLowerCase().includes(q)) return true;
    return false;
  });

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f8fafc] overflow-hidden select-none">
      {/* Top Banner Header */}
      <div className="bg-white border-b border-slate-200/80 px-8 py-6 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#00a884] to-emerald-400 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
              <Zap size={24} className="fill-white/20" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                Keyword Automation
                <span className="text-[10px] uppercase font-bold tracking-widest px-2.5 py-0.5 rounded-full bg-emerald-50 text-[#00a884] border border-emerald-100/80">
                  Live Engine
                </span>
              </h1>
              <p className="text-xs font-semibold text-slate-400 mt-0.5">
                Automatically reply to customer messages with WhatsApp or CRM Templates
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Search keywords or templates..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-medium text-slate-700 outline-none focus:bg-white focus:border-[#00a884] focus:ring-4 focus:ring-emerald-500/10 transition-all w-64 shadow-xs"
              />
            </div>
            
            <button
              onClick={() => handleOpenModal()}
              className="flex items-center gap-2 bg-[#00a884] hover:bg-emerald-600 active:scale-95 text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-md shadow-emerald-600/20 transition-all"
            >
              <Plus size={16} />
              <span>Create Rule</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Table Content */}
      <main className="flex-1 p-8 overflow-y-auto custom-scrollbar">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
                    <th className="py-4 px-6">Trigger Keywords</th>
                    <th className="py-4 px-6">Template Type</th>
                    <th className="py-4 px-6">Template Target</th>
                    <th className="py-4 px-6 text-center">Status</th>
                    <th className="py-4 px-6 text-right pr-8">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-600">
                  {loading ? (
                    <tr>
                      <td colSpan="5" className="py-16 text-center text-slate-400">
                        <div className="flex flex-col items-center gap-2">
                          <Loader2 className="animate-spin text-[#00a884]" size={28} />
                          <span className="text-xs font-bold text-slate-500">Loading automations...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredKeywords.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="py-16 text-center text-slate-400">
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
                            <MessageSquareCode size={24} />
                          </div>
                          <span className="text-sm font-bold text-slate-600">No keyword rules found</span>
                          <span className="text-xs text-slate-400 max-w-xs">
                            Create a keyword automation rule to send automated templates to incoming chats.
                          </span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredKeywords.map((rule) => {
                      const isCrm = rule.templateType === "crm" || (rule.templateId && !rule.templateSid);
                      const list = Array.isArray(rule.keywords) && rule.keywords.length > 0 ? rule.keywords : [rule.key];
                      const firstFew = list.slice(0, 3);
                      const extraCount = list.length - firstFew.length;

                      return (
                        <tr key={rule._id} className="hover:bg-slate-50/80 transition-colors group">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-[#00a884]" />
                              <div className="text-sm font-bold text-slate-800 truncate">
                                {firstFew.join(", ")}
                                {extraCount > 0 && (
                                  <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded ml-1.5 border border-slate-200 inline-block font-extrabold align-middle">
                                    +{extraCount} more
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          <td className="px-6 py-4">
                            {isCrm ? (
                              <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-200">
                                <FileText size={11} /> CRM Template
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded border border-blue-200">
                                <Layers size={11} /> WhatsApp Template
                              </span>
                            )}
                          </td>

                          <td className="px-6 py-4">
                            {isCrm ? (
                              <div className="flex flex-col">
                                <span className="font-bold text-slate-800 text-xs">
                                  {rule.templateId?.name || "CRM Template"}
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  ID: {rule.templateId?._id || rule.templateId}
                                </span>
                              </div>
                            ) : (
                              <span className="font-mono text-[11px] text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200 selection:bg-emerald-200">
                                {rule.templateSid}
                              </span>
                            )}
                          </td>

                          <td className="px-6 py-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <span className={`text-[10px] font-bold uppercase tracking-wider ${rule.isActive ? 'text-emerald-600' : 'text-slate-400'}`}>
                                {rule.isActive ? 'Active' : 'Inactive'}
                              </span>
                              <button
                                onClick={() => handleToggle(rule._id, rule.isActive)}
                                className={`relative inline-flex items-center h-6 w-11 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#00a884]/20 focus:ring-offset-2 ${
                                  rule.isActive ? "bg-[#00a884]" : "bg-slate-300"
                                }`}
                              >
                                <span className={`inline-block w-4 h-4 transform bg-white rounded-full shadow-sm transition-transform ${
                                  rule.isActive ? "translate-x-6" : "translate-x-1"
                                }`} />
                              </button>
                            </div>
                          </td>

                          <td className="px-6 py-4 text-right pr-8">
                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={() => handleOpenModal(rule)} 
                                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Edit Automation"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button 
                                onClick={() => handleDelete(rule._id)} 
                                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                title="Delete Keyword"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {/* Modal */}
      {modalOpen && (
        <>
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 transition-opacity animate-in fade-in" onClick={() => setModalOpen(false)}></div>
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-[2rem] w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100 flex flex-col max-h-[90vh]">
              
              <div className="px-6 py-5 flex items-center justify-between border-b border-slate-100 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0 text-indigo-600 shadow-inner">
                    <Activity size={20} />
                  </div>
                  <div>
                    <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">
                      {currentEdit ? "Edit Automation" : "New Automation"}
                    </h2>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">Webhook Trigger Rule</p>
                  </div>
                </div>
                <button onClick={() => setModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors active:scale-95">
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-slate-50/30">
                {error && (
                  <div className="mb-5 flex items-start gap-2.5 p-3.5 bg-rose-50 border border-rose-100 rounded-xl text-rose-700 text-sm font-medium animate-in fade-in">
                    <AlertCircle size={18} className="shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}
                
                <form id="keyword-form" onSubmit={handleSave} className="space-y-5">
                  {/* Trigger Keywords */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">
                      Trigger Keywords <span className="text-rose-500">*</span>
                    </label>
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus-within:bg-white focus-within:ring-4 focus-within:ring-[#00a884]/10 focus-within:border-[#00a884] transition-all min-h-[96px] flex flex-col justify-between">
                      <div className="flex flex-wrap gap-1.5 mb-2 overflow-y-auto max-h-[120px] custom-scrollbar">
                        {formData.keywords.map((kw, index) => (
                          <span key={index} className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 text-xs font-bold px-2.5 py-1 rounded-lg border border-emerald-100 shadow-sm select-none animate-in fade-in zoom-in-95">
                            {kw}
                            <button
                              type="button"
                              onClick={() => {
                                setFormData(prev => ({
                                  ...prev,
                                  keywords: prev.keywords.filter((_, i) => i !== index)
                                }));
                              }}
                              className="text-emerald-500 hover:text-emerald-700 font-bold ml-1 transition-colors"
                            >
                              <X size={12} />
                            </button>
                          </span>
                        ))}
                      </div>
                      <input
                        type="text"
                        placeholder={formData.keywords.length === 0 ? "Type keyword and press Enter..." : "Add keyword..."}
                        className="w-full bg-transparent outline-none text-sm font-bold text-slate-800 placeholder:font-medium placeholder:text-slate-400"
                        value={keywordInput}
                        onChange={(e) => setKeywordInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === "," || e.key === "Tab") {
                            e.preventDefault();
                            addKeyword(keywordInput);
                          } else if (e.key === "Backspace" && !keywordInput) {
                            e.preventDefault();
                            if (formData.keywords.length > 0) {
                              setFormData(prev => ({
                                ...prev,
                                keywords: prev.keywords.slice(0, -1)
                              }));
                            }
                          }
                        }}
                        onBlur={() => {
                          if (keywordInput.trim()) {
                            addKeyword(keywordInput);
                          }
                        }}
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 font-semibold mt-1.5 ml-1 leading-normal">
                      Press Enter, Comma, or Tab to add keywords.
                    </p>
                  </div>
                  
                  {/* Template Type Selector */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">
                      Template Type <span className="text-rose-500">*</span>
                    </label>
                    <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, templateType: "crm" })}
                        className={`py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                          formData.templateType === "crm"
                            ? "bg-white text-slate-900 shadow-sm"
                            : "text-slate-500 hover:text-slate-900"
                        }`}
                      >
                        <FileText size={14} className={formData.templateType === "crm" ? "text-[#00a884]" : "text-slate-400"} />
                        CRM Template
                      </button>

                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, templateType: "whatsapp" })}
                        className={`py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                          formData.templateType === "whatsapp"
                            ? "bg-white text-slate-900 shadow-sm"
                            : "text-slate-500 hover:text-slate-900"
                        }`}
                      >
                        <Layers size={14} className={formData.templateType === "whatsapp" ? "text-blue-600" : "text-slate-400"} />
                        WhatsApp Approved
                      </button>
                    </div>
                  </div>

                  {/* Template Selection / SID */}
                  {formData.templateType === "crm" ? (
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">
                        Select CRM Template <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={formData.templateId}
                        onChange={(e) => setFormData({ ...formData, templateId: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-[#00a884] focus:bg-white text-slate-800"
                      >
                        <option value="">-- Choose a CRM Template --</option>
                        {crmTemplates.map((t) => (
                          <option key={t._id} value={t._id}>
                            {t.name} ({t.category || "General"})
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">
                        Twilio Template SID <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative group">
                        <div className="absolute left-3.5 top-3 text-slate-400 font-mono text-[10px] font-bold group-focus-within:text-[#00a884] transition-colors mt-0.5">SID</div>
                        <input
                          type="text"
                          required
                          placeholder="HXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                          value={formData.templateSid}
                          onChange={(e) => setFormData({ ...formData, templateSid: e.target.value })}
                          className="w-full pl-12 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-medium outline-none focus:border-[#00a884] focus:bg-white text-slate-800"
                        />
                      </div>
                    </div>
                  )}

                  {/* Status Toggle */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <div>
                      <span className="block text-xs font-bold text-slate-700">Enable Automation</span>
                      <span className="text-[10px] text-slate-400">Rule will trigger immediately on match</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                      className={`relative inline-flex items-center h-6 w-11 rounded-full transition-colors ${
                        formData.isActive ? "bg-[#00a884]" : "bg-slate-300"
                      }`}
                    >
                      <span className={`inline-block w-4 h-4 transform bg-white rounded-full shadow-sm transition-transform ${
                        formData.isActive ? "translate-x-6" : "translate-x-1"
                      }`} />
                    </button>
                  </div>
                </form>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200/60 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="keyword-form"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-[#00a884] hover:bg-emerald-600 active:scale-95 text-white text-xs font-bold rounded-xl transition shadow-sm"
                >
                  {isSubmitting ? "Saving..." : currentEdit ? "Update Rule" : "Create Rule"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}