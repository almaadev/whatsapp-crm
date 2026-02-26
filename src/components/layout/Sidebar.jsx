"use client";
import { useSession, signOut } from "next-auth/react";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import AlmaaLogo from "@/../public/logo/Almaa Herbal Logo.png";
import NotificationPanel from "./NotificationPanel";
import SignOutModal from "@/components/features/auth/SignOutModal";
import { useChatStore } from "@/store/chatStore";
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  LogOut,
  Menu,
  ChevronLeft,
  Bell,
  Share2,
  List
} from "lucide-react";

export default function Sidebar({ role, mobileOpen, setMobileOpen }) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [isDesktopExpanded, setIsDesktopExpanded] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSignOut, setShowSignOut] = useState(false);

  const notifications = useChatStore(s => s.notifications);
  const userName = session?.user?.name || "User";

  // FIX: Ensure role is always a string to prevent .replace() crashes during sign-out
  const displayRole = role

  useEffect(() => {
    const handleResize = () => { if (window.innerWidth >= 768) setMobileOpen(false); };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [setMobileOpen]);

  const isExpanded = mobileOpen || isDesktopExpanded;
  const toggleSidebar = () => window.innerWidth < 768 ? setMobileOpen(!mobileOpen) : setIsDesktopExpanded(!isDesktopExpanded);

  const handleConfirmSignOut = async () => {
    // FIX: Await sign out and force redirect to home to prevent race conditions
    await signOut({ callbackUrl: "/", redirect: true });
  };

  return (
    <>
      {mobileOpen && <div className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm" onClick={() => setMobileOpen(false)} />}

      <SignOutModal
        isOpen={showSignOut}
        onClose={() => setShowSignOut(false)}
        onConfirm={handleConfirmSignOut}
      />

      <aside className={`
          bg-[#0b8343] text-white flex flex-col border-r border-white/10 transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1.0)] z-50
          fixed inset-y-0 left-0 h-full shadow-2xl md:shadow-none
          ${mobileOpen ? "translate-x-0 w-72" : "-translate-x-full w-72"}
          md:relative md:translate-x-0 
          ${isDesktopExpanded ? "md:w-72" : "md:w-26"}
        `}>

        {/* Header */}
        <div className={`flex items-center h-20 px-4 shrink-0 border-b border-white/10 ${isExpanded ? "justify-between" : "justify-center"}`}>
          {isExpanded ? (
            <div className="flex items-center gap-3 overflow-hidden">
              <div className=" w-28 flex items-center justify-center shrink-0 p-1">
                <img src={AlmaaLogo.src} alt="Almaa" className="w-full h-full object-contain" draggable={false} />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-white text-lg leading-tight tracking-wide">Almaa</span>
                <span className="text-[10px] text-green-100 uppercase tracking-wider font-medium">Herbal Nature</span>
              </div>
            </div>
          ) : (
            <div className="w-24 h-18 flex items-center justify-center p-1">
              <img src={AlmaaLogo.src} alt="Almaa" className="w-full h-full object-contain" draggable={false} />
            </div>
          )}

          {isExpanded && (
            <button onClick={toggleSidebar} className="p-1.5 rounded-lg hover:bg-white/20 text-white transition">
              <ChevronLeft size={20} />
            </button>
          )}
        </div>

        {/* NOTIFICATION PANEL */}
        <div className={`px-4 py-2 mt-2 flex ${isExpanded ? "justify-end" : "justify-center"}`}>
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 bg-white/10 rounded-xl hover:bg-white/20 relative transition-all"
            >
              <Bell size={20} />
              {notifications.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-[#0b8343]">
                  {notifications.length}
                </span>
              )}
            </button>
            <NotificationPanel isOpen={showNotifications} onClose={() => setShowNotifications(false)} />
          </div>
        </div>

        {!isExpanded && (
          <div className="flex justify-center py-2">
            <button onClick={toggleSidebar} className="p-2 rounded-xl hover:bg-white/20 text-white transition">
              <Menu size={24} />
            </button>
          </div>
        )}

        {/* Nav Links */}
        <nav className="flex-1 flex flex-col gap-2 p-4 mt-0 overflow-y-auto custom-scrollbar">

          {displayRole === 'admin' && (
            <Link href="/dashboard/admin">
              <NavItem isOpen={isExpanded} active={pathname === "/dashboard/admin"} label="Admin Overview" icon={<LayoutDashboard size={22} />} />
            </Link>
          )}

          {displayRole !== 'admin' && (
            <Link href="/dashboard/associate">
              <NavItem isOpen={isExpanded} active={pathname === "/dashboard/associate"} label="My Dashboard" icon={<LayoutDashboard size={22} />} />
            </Link>
          )}

          <Link href="/dashboard/chat">
            <NavItem isOpen={isExpanded} active={pathname === "/dashboard/chat"} label="Chat Inbox" icon={<MessageSquare size={22} />} />
          </Link>

          <Link href="/dashboard/leads">
            <NavItem isOpen={isExpanded} active={pathname === "/dashboard/leads"} label="Leads" icon={<List size={22} />} />
          </Link>
          
          <Link href="/dashboard/customers">
            <NavItem isOpen={isExpanded} active={pathname.startsWith("/dashboard/customers")} label="Customers" icon={<Users size={22} />} />
          </Link>

          <Link href="/dashboard/forwarded-leads">
            <NavItem isOpen={isExpanded} active={pathname === "/dashboard/forwarded-leads"} label="Forwarded Leads" icon={<Share2 size={22} />} />
          </Link>


        </nav>

        {/* Footer */}
        <div className="border-t border-white/10 p-4 shrink-0 bg-[#148a4a]">
          <div className={`flex items-center gap-3 rounded-xl p-2 transition-all ${isExpanded ? "justify-start bg-black/10" : "justify-center"}`}>
            <div className="w-10 h-10 rounded-full bg-white text-[#1aa159] flex items-center justify-center font-bold text-lg shadow-sm shrink-0 border-2 border-white/20">
              {userName.charAt(0).toUpperCase()}
            </div>
            {isExpanded && (
              <div className="overflow-hidden flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">{userName}</p>
                {/* FIX: Use displayRole here instead of raw role */}
                <p className="text-[11px] text-green-100 uppercase tracking-wide truncate font-medium">{displayRole.replace('_', ' ')}</p>
              </div>
            )}
            {isExpanded && (
              <button
                onClick={() => setShowSignOut(true)}
                className="text-white/70 hover:text-white hover:bg-white/20 p-2 rounded-lg transition"
                title="Logout"
              >
                <LogOut size={20} />
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

function NavItem({ isOpen, icon, label, active }) {
  return (
    <div className={`
      flex items-center gap-4 p-3.5 rounded-xl transition-all duration-200 cursor-pointer group font-medium
      ${active
        ? "bg-white text-[#1aa159] shadow-lg shadow-black/10 translate-x-1"
        : "text-white hover:bg-white/20 hover:text-white hover:translate-x-1"} 
      ${isOpen ? "justify-start" : "justify-center"}
    `}>
      <span className={`shrink-0 transition-transform duration-200 ${active ? "scale-110" : "group-hover:scale-110"}`}>
        {icon}
      </span>

      {isOpen && (
        <span className={`text-[15px] tracking-wide animate-in fade-in slide-in-from-left-2 ${active ? "font-bold" : "font-medium"}`}>
          {label}
        </span>
      )}
    </div>
  );
} 