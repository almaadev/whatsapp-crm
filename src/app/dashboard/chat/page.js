"use client";

import { useState, useEffect, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { useChatStore } from "@/store/chatStore";
import { useChat } from "@/hooks/useChat";
import AlmaaLogo from "@/../public/logo/Almaa Herbal Logo.png";

import Sidebar from "@/components/layout/Sidebar";
import ChatList from "@/components/features/chat/ChatList";
import ChatArea from "@/components/features/chat/ChatArea";

function ChatPageContent() {
  const { data: session } = useSession();
  const login = useAuthStore((s) => s.login);

  const selectedChat = useChatStore((s) => s.selectedChat);
  const setSelectedChat = useChatStore((s) => s.setSelectedChat);
  const messages = useChatStore((s) => s.messages);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const searchParams = useSearchParams();

  const userRole = session?.user?.role;

  const { loading } = useChat(userRole);

  useEffect(() => {
    if (session?.user) {
      login(session.user.name, userRole);
    }
  }, [session, login, userRole]);

  useEffect(() => {
    const phoneParam = searchParams.get("phone");
    if (phoneParam && messages.length > 0 && !selectedChat) {
      const targetChat = messages.find(c => c.phone.includes(phoneParam) || c.phone === phoneParam);
      if (targetChat) {
        setSelectedChat(targetChat);
      }
    }
  }, [searchParams, messages, selectedChat, setSelectedChat]);

  if (!session) return null;

  return (
    <div className="flex h-[100dvh] bg-gray-100 overflow-hidden relative">
      <div className="flex-shrink-0 z-40">
        <Sidebar role={userRole} mobileOpen={mobileMenuOpen} setMobileOpen={setMobileMenuOpen} />
      </div>

      <div className="flex flex-1 w-full h-full relative overflow-hidden flex-col">
        <div className="md:hidden h-14 bg-white border-b flex items-center px-4 shrink-0 justify-between z-30 shadow-sm">
          <button onClick={() => setMobileMenuOpen(true)} className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-md">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          {/* FIX: Changed <span> to <div> to prevent Turbopack crash */}
          <div className="font-semibold text-gray-700">
            <div className=" w-20 flex items-center justify-center shrink-0 p-1">
              <img src={AlmaaLogo.src} alt="Almaa" className="w-full h-full object-contain" />
            </div>
          </div>
          <div className="w-8"></div>
        </div>

        <div className="flex flex-1 overflow-hidden relative">
          <div className={`
              flex flex-col bg-white border-r h-full z-10 
              ${selectedChat ? 'hidden md:flex' : 'flex w-full'}
              md:w-[400px] lg:w-[450px] flex-shrink-0 transition-all
          `}>
            <ChatList role={userRole} loading={loading} />
          </div>

          <div className={`
              flex flex-col bg-[#efeae2] h-full transition-all
              ${selectedChat ? 'fixed inset-0 z-50 md:static md:z-auto flex w-full' : 'hidden md:flex flex-1'}
          `}>
            <div className="absolute inset-0 opacity-30 pointer-events-none z-0"
              style={{ backgroundImage: "url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')", backgroundSize: "400px" }}>
            </div>
            <div className="relative z-10 h-full flex flex-col">
              <ChatArea />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="flex h-[100dvh] bg-gray-100 items-center justify-center">Loading Chat...</div>}>
      <ChatPageContent />
    </Suspense>
  );
}