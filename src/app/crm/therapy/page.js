"use client";
import { useState, useEffect, useRef, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import AlmaaLogo from "@/../public/logo/Almaa Herbal Logo.png";
import { toast } from "react-toastify";
import { io } from "socket.io-client";
import { useTherapyChatStore } from "@/store/therapyChatStore";
import { useTherapyChat } from "@/hooks/useTherapyChat";
import CustomerInfoPanel from "@/components/features/chat/CustomerInfoPanel";
import { HeartPulse, ShieldAlert, Menu, Send, User, ChevronLeft, Check, CheckCheck, Clock, X, MapPin, FileText, Search, Info, Lock } from "lucide-react";

const formatSafeTime = (timeStr) => {
    if (!timeStr) return '';
    try {
        const d = new Date(timeStr);
        if (isNaN(d.getTime())) return '';
        return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } catch(e) { return ''; }
};

function TherapyContent() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  
  const selectedChat = useTherapyChatStore((s) => s.selectedChat);
  const setSelectedChat = useTherapyChatStore((s) => s.setSelectedChat);
  const messages = useTherapyChatStore((s) => s.messages);
  
  const { fetchChats, sendMessage, updateStatus, loading, sending } = useTherapyChat();

  const [replyText, setReplyText] = useState("");
  const messagesEndRef = useRef(null);
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);
  const statusMenuRef = useRef(null);

  const userRole = session?.user?.role;
  const displayRole = userRole || "";
  const department = session?.user?.department || "";
  const accessModules = session?.user?.accessModules || [];

  const isAdminAuthorized = displayRole === 'superAdmin' || (displayRole === 'sales' && department === 'admin') || (displayRole === 'doctor' && department === 'admin');
  const hasAccess = (moduleName) => {
    if (isAdminAuthorized) return true;
    return accessModules.includes(moduleName);
  };
  const isAuthorized = hasAccess("Therapy");

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  useEffect(() => { scrollToBottom(); }, [selectedChat?.history]);

  useEffect(() => {
    const phoneParam = searchParams.get("phone");
    if (phoneParam && messages.length > 0 && !selectedChat) {
      const targetChat = messages.find(c => c.phone.includes(phoneParam) || c.phone === phoneParam);
      if (targetChat) setSelectedChat(targetChat);
    }
  }, [searchParams, messages, selectedChat, setSelectedChat]);

  useEffect(() => {
      function handleClickOutside(event) {
          if (statusMenuRef.current && !statusMenuRef.current.contains(event.target)) setIsStatusMenuOpen(false);
      }
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
      if (isAuthorized) {
          fetchChats();
          const socketUrl = process.env.NODE_ENV === "production" ? "https://crm.almaaerp.in" : "";
          const socket = io(socketUrl, { path: "/socket.io/", transports: ["websocket", "polling"] });
          socket.on("new_therapy_message", () => fetchChats(false));
          socket.on("message_status_update", () => fetchChats(false));
          return () => socket.disconnect();
      }
  }, [isAuthorized, fetchChats]);

  const handleSend = async () => {
      if (!replyText.trim() || !selectedChat) return;
      const msgText = replyText; setReplyText("");
      const success = await sendMessage(selectedChat.phone, msgText);
      if (success) setTimeout(scrollToBottom, 50);
  };

  const handleStatusChange = async (newStatus) => {
      setIsStatusMenuOpen(false);
      if (!selectedChat) return;
      await updateStatus(selectedChat.phone, newStatus);
  };

  const getStatusIcon = (status) => {
      if (!status) return <Check size={14} className="text-slate-400" />;
      const s = status.toUpperCase();
      if (s === "READ") return <CheckCheck size={15} className="text-[#53bdeb]" />;
      if (s === "DELIVERED") return <CheckCheck size={15} className="text-slate-400" />;
      if (s === "SENT") return <Check size={14} className="text-slate-400" />;
      if (s === "FAILED") return <X size={14} className="text-red-500" />;
      return <Clock size={12} className="text-slate-400" />;
  };

  if (status === "loading") return <div className="flex h-[100dvh] items-center justify-center text-slate-500 font-medium">Loading Therapy Leads...</div>;
  if (!session) return null;

  if (!isAuthorized) {
      return (
          <div className="flex h-[100dvh] bg-gray-100 overflow-hidden relative">
              <div className="flex-shrink-0 z-40">
                  <Sidebar role={userRole} mobileOpen={mobileMenuOpen} setMobileOpen={setMobileMenuOpen} />
              </div>
              <div className="flex flex-1 w-full h-full relative overflow-hidden flex-col">
                  <div className="md:hidden h-14 bg-white border-b flex items-center px-4 shrink-0 justify-between z-30 shadow-sm">
                      <button onClick={() => setMobileMenuOpen(true)} className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-md">
                          <Menu size={24} />
                      </button>
                      <div className="font-semibold text-gray-700">
                          <div className=" w-20 flex items-center justify-center shrink-0 p-1">
                              <img src={AlmaaLogo.src} alt="Almaa" className="w-full h-full object-contain" />
                          </div>
                      </div>
                      <div className="w-8"></div>
                  </div>
                  <div className="flex flex-col items-center justify-center h-full p-4 text-center">
                      <ShieldAlert size={60} className="text-red-400 mb-4" />
                      <h2 className="text-2xl font-bold text-slate-800">Access Denied</h2>
                      <p className="text-slate-500 mt-2">You do not have permission to access Therapy Leads.</p>
                  </div>
              </div>
          </div>
      );
  }

  return (
    <div className="flex h-[100dvh] bg-gray-100 overflow-hidden relative">
      <div className="flex-shrink-0 z-40">
        <Sidebar role={userRole} mobileOpen={mobileMenuOpen} setMobileOpen={setMobileMenuOpen} />
      </div>

      <div className="flex flex-1 w-full h-full relative overflow-hidden flex-col">
        <div className="md:hidden h-14 bg-white border-b flex items-center px-4 shrink-0 justify-between z-30 shadow-sm">
          <button onClick={() => setMobileMenuOpen(true)} className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-md"><Menu size={24} /></button>
          <div className="font-semibold text-gray-700">
            <div className=" w-20 flex items-center justify-center shrink-0 p-1"><img src={AlmaaLogo.src} alt="Almaa" className="w-full h-full object-contain" /></div>
          </div>
          <div className="w-8"></div>
        </div>

        <div className="flex flex-1 overflow-hidden relative">
            <div className={`flex flex-col bg-white border-r h-full z-10 ${selectedChat ? 'hidden md:flex' : 'flex w-full'} md:w-[400px] lg:w-[450px] flex-shrink-0 transition-all`}>
                <div className="bg-[#f0f2f5] px-4 py-3 flex items-center justify-between border-b border-slate-200 h-[60px] shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center text-white shadow-sm shrink-0"><HeartPulse size={20}/></div>
                        <h2 className="font-bold text-[#111b21] text-[16px]">Therapy Leads</h2>
                    </div>
                </div>
                <div className="p-2 border-b border-slate-200 bg-white">
                    <div className="bg-[#f0f2f5] rounded-lg flex items-center px-3 py-1.5 gap-3"><Search size={18} className="text-[#54656f]" /><input type="text" placeholder="Search leads..." className="bg-transparent border-none outline-none text-sm w-full py-1 text-[#111b21] placeholder:text-[#54656f]" /></div>
                </div>
                <div className="flex-1 overflow-y-auto bg-white custom-scrollbar">
                    {loading ? <p className="text-center text-slate-400 mt-10 text-sm">Loading chats...</p> : 
                        messages?.map(chat => {
                            const lastHistoryMsg = chat.history?.length > 0 ? chat.history[chat.history.length - 1] : null;
                            const displayMsg = chat.message || lastHistoryMsg?.message || "No messages";
                            const displayTime = chat.lastSeenAt || lastHistoryMsg?.createdAt || lastHistoryMsg?.timestamp || chat.createdAt;

                            return (
                                <div key={chat.phone} onClick={() => setSelectedChat(chat)} className={`flex items-center px-3 py-2.5 cursor-pointer hover:bg-[#f5f6f6] transition-colors ${selectedChat?.phone === chat.phone ? 'bg-[#f0f2f5]' : ''}`}>
                                    <div className="w-12 h-12 bg-slate-300 rounded-full flex items-center justify-center text-white shrink-0 overflow-hidden mr-3"><User size={28} className="mt-2 opacity-80" /></div>
                                    <div className="flex-1 min-w-0 border-b border-slate-100 pb-3 pt-1">
                                        <div className="flex justify-between items-center mb-0.5">
                                            <h3 className="font-semibold text-[#111b21] text-[16px] leading-tight line-clamp-1">{chat.name || chat.phone}</h3>
                                            <span className="text-[12px] text-[#667781]">{formatSafeTime(displayTime)}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <p className="text-[13px] text-[#667781] line-clamp-1 pr-2">{displayMsg}</p>
                                            {chat.status && <span className="bg-purple-100 text-purple-800 text-[10px] px-2 py-0.5 rounded-md font-bold shrink-0">{chat.status}</span>}
                                        </div>
                                    </div>
                                </div>
                            )
                        })
                    }
                </div>
            </div>

            <div className={`flex flex-col bg-[#efeae2] h-full transition-all ${selectedChat ? 'fixed inset-0 z-50 md:static md:z-auto flex w-full' : 'hidden md:flex flex-1'}`}>
                <div className="absolute inset-0 opacity-30 pointer-events-none z-0" style={{ backgroundImage: "url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')", backgroundSize: "400px" }}></div>
                
                <div className="relative z-10 h-full flex flex-col">
                    {selectedChat ? (
                        <>
                            <div className="bg-[#f0f2f5] px-4 py-2.5 border-b border-slate-200 flex items-center justify-between shrink-0 shadow-sm h-[60px]">
                                <div className="flex items-center gap-3">
                                    <button onClick={() => setSelectedChat(null)} className="md:hidden p-1.5 -ml-1.5 text-[#54656f] hover:bg-slate-200 rounded-full"><ChevronLeft size={24}/></button>
                                    <div className="w-10 h-10 bg-slate-300 rounded-full flex items-center justify-center text-white shrink-0 overflow-hidden cursor-pointer" onClick={() => setIsInfoOpen(true)}><User size={24} className="mt-2 opacity-80" /></div>
                                    <div className="flex flex-col cursor-pointer" onClick={() => setIsInfoOpen(true)}>
                                        <h3 className="font-semibold text-[#111b21] text-[15px] leading-tight">{selectedChat.name || selectedChat.phone}</h3>
                                        <p className="text-[13px] text-[#667781] mt-0.5 truncate">{selectedChat.phone}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 sm:gap-3">
                                    {selectedChat.city && <div className="hidden sm:flex items-center gap-1 text-xs font-semibold text-slate-500 bg-white px-3 py-1 rounded-full border border-slate-200"><MapPin size={12}/> {selectedChat.city}</div>}
                                    
                                    <div className="relative" ref={statusMenuRef}>
                                        <button onClick={() => setIsStatusMenuOpen(!isStatusMenuOpen)} className="flex items-center gap-1.5 bg-purple-100 text-purple-800 hover:bg-purple-200 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors shadow-sm">
                                            <FileText size={16} />
                                            <span className="hidden sm:inline">{selectedChat.status || "New"}</span>
                                        </button>
                                        {isStatusMenuOpen && (
                                            <div className="absolute right-0 mt-2 w-40 bg-white rounded-lg shadow-xl border border-slate-100 py-1 z-50 animate-in fade-in zoom-in-95">
                                                {["New", "Follow Up", "Closed", "Not Interested"].map((st) => (
                                                    <button key={st} onClick={() => handleStatusChange(st)} className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 text-slate-700">{st}</button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <button onClick={() => setIsInfoOpen(true)} className="flex items-center justify-center p-2 text-slate-500 hover:text-purple-700 hover:bg-purple-100 rounded-full transition-all" title="Customer Info"><Info size={22} /></button>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-2 custom-scrollbar">
                                {selectedChat?.history?.map((msg, i) => {
                                    const isOutbound = msg.direction === 'OUTBOUND';
                                    return (
                                        <div key={i} className={`flex ${isOutbound ? 'justify-end' : 'justify-start'} w-full`}>
                                            <div className={`max-w-[85%] md:max-w-[65%] rounded-lg px-3 py-1.5 shadow-[0_1px_0.5px_rgba(11,20,26,.13)] relative flex flex-col ${isOutbound ? 'bg-[#d9fdd3] rounded-tr-none text-[#111b21]' : 'bg-white rounded-tl-none text-[#111b21]'}`}>
                                                <p className="text-[14.5px] leading-relaxed whitespace-pre-wrap break-words">{msg.message}</p>
                                                <div className={`flex items-center justify-end gap-1 mt-1 -mb-0.5 pl-4`}>
                                                    <span className="text-[10px] text-[#667781] font-medium">{formatSafeTime(msg.createdAt || msg.timestamp)}</span>
                                                    {isOutbound && getStatusIcon(msg.status || msg.messageStatus)}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                                <div ref={messagesEndRef} />
                            </div>

                            <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="bg-[#f0f2f5] px-4 py-3 flex items-end gap-3 shrink-0">
                                <div className="flex-1 bg-white rounded-xl flex items-end shadow-sm">
                                    <textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="Type a message" className="w-full max-h-32 bg-transparent px-4 py-3 outline-none resize-none text-[15px] text-[#111b21] custom-scrollbar min-h-[44px]" rows={1} onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); handleSend(); } }} />
                                </div>
                                <button type="submit" disabled={!replyText.trim() || sending} className="bg-[#00a884] text-white p-2.5 rounded-full hover:bg-[#008f6f] disabled:opacity-50 transition-all shadow-sm shrink-0 mb-0.5 flex items-center justify-center w-[44px] h-[44px]">
                                    <Send size={20} className={sending ? "opacity-50" : "ml-0.5"} />
                                </button>
                            </form>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center border-b-[6px] border-purple-500">
                            <div className="w-24 h-24 bg-white shadow-sm rounded-full flex items-center justify-center mb-6 text-purple-500"><HeartPulse size={40} /></div>
                            <h2 className="text-3xl font-light text-[#41525d] mb-4">Therapy Inbox</h2>
                            <p className="text-[#8696a0] text-sm text-center max-w-[400px]">Select a customer from the left to start messaging.</p>
                            <div className="mt-10 flex items-center gap-1.5 text-xs text-[#8696a0] font-medium bg-white px-4 py-2 rounded-full shadow-sm"><Lock size={12} /> End-to-end encrypted CRM integration</div>
                        </div>
                    )}
                </div>
            </div>
            <CustomerInfoPanel isOpen={isInfoOpen} onClose={() => setIsInfoOpen(false)} leadCategory="therapy" activeChat={selectedChat} />
        </div>
      </div>
    </div>
  );
}

export default function TherapyPage() {
  return (
    <Suspense fallback={<div className="flex h-[100dvh] bg-gray-100 items-center justify-center text-slate-500 font-medium">Loading Workspace...</div>}>
      <TherapyContent />
    </Suspense>
  );
}