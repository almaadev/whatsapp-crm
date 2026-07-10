"use client";
import { useState, useEffect } from "react";
import { 
  Search, Plus, Edit2, Trash2, Zap, 
  Loader2, MessageSquareCode, Check, X, 
  AlertCircle, Activity
} from "lucide-react";
import { automationRepository } from "@/shared/api/repositories/automationRepository";
import { toast } from "react-toastify";

export default function KeywordAutomationPage() {
  const [keywords, setKeywords] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [currentEdit, setCurrentEdit] = useState(null);
  const [formData, setFormData] = useState({ key: "", templateSid: "", isActive: true });
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

  useEffect(() => {
    fetchKeywords();
  }, []);

  const handleOpenModal = (automationRule = null) => {
    setError("");
    if (automationRule) {
      setCurrentEdit(automationRule._id);
      setFormData({ key: automationRule.key, templateSid: automationRule.templateSid, isActive: automationRule.isActive });
    } else {
      setCurrentEdit(null);
      setFormData({ key: "", templateSid: "", isActive: true });
    }
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);
    
    if (!formData.key.trim() || !formData.templateSid.trim()) {
      setIsSubmitting(false);
      return setError("Keyword and Template SID are required.");
    }

    try {
      let result;
      if (currentEdit) {
        const { data } = await automationRepository.updateKeyword(currentEdit, formData);
        result = data;
      } else {
        const { data } = await automationRepository.createKeyword(formData);
        result = data;
      }
      
      setModalOpen(false);
      fetchKeywords();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this automated keyword?")) return;
    await automationRepository.deleteKeyword(id);
    fetchKeywords();
  };

  const handleToggle = async (id, currentStatus) => {
    const updatedStatus = !currentStatus;
    // Optimistic UI update
    setKeywords(keywords.map(k => k._id === id ? { ...k, isActive: updatedStatus } : k));
    await automationRepository.patchKeyword(id, { isActive: updatedStatus });
  };

  const filteredKeywords = keywords.filter((k) =>
    k.key.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-slate-50 relative">
      {/* Page Header */}
      <header className="px-6 py-8 bg-white border-b border-slate-200 shrink-0 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>
        <div className="max-w-[1400px] mx-auto relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center border border-emerald-100 shrink-0">
              <Zap className="text-emerald-600" size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Keyword Auto-Reply</h1>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">System Automations</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 w-full md:w-auto mt-2 md:mt-0">
            <div className="relative flex-1 md:w-64 group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#00a884] transition-colors" size={16} />
              <input
                type="text"
                placeholder="Search keywords..."
                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:bg-white focus:border-[#00a884] focus:ring-4 focus:ring-[#00a884]/10 transition-all placeholder:text-slate-400"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button 
              onClick={() => handleOpenModal()} 
              className="px-5 py-2.5 bg-[#00a884] hover:bg-emerald-600 text-white rounded-xl font-bold text-sm transition-all shadow-md shadow-emerald-200/50 flex items-center gap-2 shrink-0 active:scale-95"
            >
              <Plus size={16} /> <span className="hidden sm:inline">Add Keyword</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6 lg:p-8">
        <div className="max-w-[1400px] mx-auto w-full">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead className="bg-slate-50/80 text-slate-500 text-[10px] uppercase font-black tracking-widest border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 pl-8 rounded-tl-2xl">Trigger Keyword</th>
                    <th className="px-6 py-4">Twilio Template SID</th>
                    <th className="px-6 py-4 text-center">Status</th>
                    <th className="px-6 py-4 text-right pr-8 rounded-tr-2xl">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm font-medium text-slate-700">
                  {loading ? (
                    <tr>
                      <td colSpan="4" className="px-6 py-12">
                        <div className="flex flex-col items-center justify-center text-slate-400 gap-3">
                          <Loader2 size={32} className="animate-spin text-[#00a884]" />
                          <span className="text-xs font-bold tracking-widest uppercase">Loading Automations...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredKeywords.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="px-6 py-16 text-center">
                        <div className="flex flex-col items-center justify-center">
                          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4 shadow-inner border border-slate-100">
                            <MessageSquareCode size={32} className="text-slate-300" />
                          </div>
                          <h3 className="text-lg font-extrabold text-slate-800">No Automations Found</h3>
                          <p className="text-sm font-medium text-slate-500 mt-1 max-w-sm">
                            {search ? "No keywords match your search query." : "You haven't set up any keyword auto-replies yet. Click 'Add Keyword' to start automating."}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredKeywords.map((automationRule) => (
                      <tr key={automationRule._id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-6 py-4 pl-8">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs border border-emerald-100">
                              <Zap size={14} />
                            </div>
                            <span className="font-bold text-slate-800">{automationRule.key}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-mono text-[11px] text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200 selection:bg-emerald-200">
                            {automationRule.templateSid}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <span className={`text-[10px] font-bold uppercase tracking-wider ${automationRule.isActive ? 'text-emerald-600' : 'text-slate-400'}`}>
                              {automationRule.isActive ? 'Active' : 'Inactive'}
                            </span>
                            <button
                              onClick={() => handleToggle(automationRule._id, automationRule.isActive)}
                              className={`relative inline-flex items-center h-6 w-11 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#00a884]/20 focus:ring-offset-2 ${
                                automationRule.isActive ? "bg-[#00a884]" : "bg-slate-300"
                              }`}
                            >
                              <span className={`inline-block w-4 h-4 transform bg-white rounded-full shadow-sm transition-transform ${
                                automationRule.isActive ? "translate-x-6" : "translate-x-1"
                              }`} />
                            </button>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right pr-8">
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => handleOpenModal(automationRule)} 
                              className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-100"
                              title="Edit Automation"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button 
                              onClick={() => handleDelete(automationRule._id)} 
                              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-transparent hover:border-rose-100"
                              title="Delete Keyword"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {/* Premium Create/Edit Modal */}
      {modalOpen && (
        <>
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 transition-opacity animate-in fade-in" onClick={() => setModalOpen(false)}></div>
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100 flex flex-col max-h-[90vh]">
              
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
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">
                      Trigger Keyword <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative group">
                      <MessageSquareCode className="absolute left-3.5 top-3 text-slate-400 group-focus-within:text-[#00a884] transition-colors" size={16} />
                      <input
                        type="text"
                        required
                        autoFocus
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:ring-4 focus:ring-[#00a884]/10 focus:border-[#00a884] transition-all text-sm font-bold text-slate-800 placeholder:font-medium placeholder:text-slate-400"
                        value={formData.key}
                        onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                        placeholder="e.g., book now, pricing"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">
                      Twilio Template SID <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative group">
                      <div className="absolute left-3.5 top-3 text-slate-400 font-mono text-[10px] font-bold group-focus-within:text-[#00a884] transition-colors mt-0.5">SID</div>
                      <input
                        type="text"
                        required
                        className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:ring-4 focus:ring-[#00a884]/10 focus:border-[#00a884] transition-all text-sm font-mono text-slate-800 placeholder:font-sans placeholder:font-medium placeholder:text-slate-400"
                        value={formData.templateSid}
                        onChange={(e) => setFormData({ ...formData, templateSid: e.target.value })}
                        placeholder="HX1234567890abcdef..."
                      />
                    </div>
                  </div>

                  <div className="pt-2">
                    <label className="flex items-center gap-3 p-4 border border-slate-200 rounded-xl bg-white cursor-pointer hover:bg-slate-50 transition-colors group">
                      <div className="flex-1">
                        <span className="block text-sm font-bold text-slate-800">Automation Status</span>
                        <span className="block text-xs text-slate-500 mt-0.5">Enable or disable this auto-reply instantly.</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                        className={`relative inline-flex items-center h-6 w-11 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#00a884]/20 focus:ring-offset-2 shrink-0 ${
                          formData.isActive ? "bg-[#00a884]" : "bg-slate-300"
                        }`}
                      >
                        <span className={`inline-block w-4 h-4 transform bg-white rounded-full shadow-sm transition-transform ${
                          formData.isActive ? "translate-x-6" : "translate-x-1"
                        }`} />
                      </button>
                    </label>
                  </div>
                </form>
              </div>

              <div className="p-6 bg-white border-t border-slate-100 flex flex-col sm:flex-row gap-3 sm:justify-end shrink-0">
                <button 
                  type="button" 
                  onClick={() => setModalOpen(false)} 
                  disabled={isSubmitting}
                  className="px-6 py-3 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 hover:text-slate-900 transition-all disabled:opacity-50 order-2 sm:order-1"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  form="keyword-form"
                  disabled={isSubmitting}
                  className="px-8 py-3 text-sm font-bold text-white bg-[#00a884] rounded-xl shadow-md shadow-emerald-200/50 hover:bg-emerald-600 transition-all active:scale-95 disabled:opacity-70 disabled:active:scale-100 flex items-center justify-center gap-2 order-1 sm:order-2"
                >
                  {isSubmitting ? (
                    <><Loader2 size={16} className="animate-spin" /> Saving...</>
                  ) : (
                    <><Check size={16} /> Save Rule</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}