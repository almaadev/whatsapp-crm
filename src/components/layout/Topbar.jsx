"use client";

import React, { useState, useRef, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { LayoutGrid, Bell, Menu, LogOut, ChevronDown } from "lucide-react";
import { useCrmLayout } from "./CrmShell";
import SignOutModal from "@/components/modals/SignOutModal";
import NotificationPanel from "./NotificationPanel";
import { useChatStore } from "@/stores/chatStore";

export default function Topbar() {
  const { setMobileOpen, isDesktopExpanded, setIsDesktopExpanded } =
    useCrmLayout();
  const { data: session } = useSession();

  const notifications = useChatStore((s) => s.notifications);

  // States
  const [showSignOut, setShowSignOut] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const dropdownRef = useRef(null);

  const userName = session?.user?.name || "User";
  const displayRole = session?.user?.role || "";

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleConfirmSignOut = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (error) {
      console.error("Secure logout API failed:", error);
    } finally {
      await signOut({ redirect: false });
      window.location.href = "/";
    }
  };

  return (
    <>
      <SignOutModal
        isOpen={showSignOut}
        onClose={() => setShowSignOut(false)}
        onConfirm={handleConfirmSignOut}
      />

      <div className="h-14 bg-white border-b border-slate-200 shrink-0 flex items-center justify-between px-4 lg:px-6 z-30 relative shadow-[0_1px_2px_rgba(0,0,0,0.02)] select-none">
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setMobileOpen(true)}
            className="md:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <Menu size={20} />
          </button>

          {/* Routings / Workspace Area */}
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-bold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              onClick={() => setIsDesktopExpanded(!isDesktopExpanded)}
            >
              <LayoutGrid size={16} className="text-[#00a884]" />
              <span className="hidden sm:inline">
                {!isDesktopExpanded ? "Open" : "Close"} Menu
              </span>
            </button>

            <div className="hidden sm:block w-px h-8 bg-slate-200 mx-1"></div>
            {/* NOTIFICATION PANEL */}

            
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2  bg-white/10 rounded-xl hover:bg-white/20 relative transition-all"
              >
                <Bell size={20} />
                {notifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-[var(--brand-sidebar-border)]">
                    {notifications.length}
                  </span>
                )}
              </button>
            
            <NotificationPanel
              isOpen={showNotifications}
              onClose={() => setShowNotifications(false)}
            />
          </div>
        </div>

        {/* Right Side: Search, Add Widget, User Profile */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* <div className="w-px h-12 bg-slate-200 mx-1 hidden sm:block"></div> */}

          {/* --- USER PROFILE & DROPDOWN --- */}
          <div className="relative " ref={dropdownRef}>
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-2 sm:gap-3 p-1 rounded-xl hover:bg-slate-50 transition-colors focus:outline-none"
            >
              <div className="flex flex-col text-right hidden md:flex">
                <span className="text-[13px] font-bold text-slate-800 leading-tight">
                  {userName}
                </span>
                <span className="text-[10px] font-bold text-[#00a884] uppercase tracking-wider">
                  {displayRole.replace("_", " ")}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-emerald-50 text-[#00a884] flex items-center justify-center font-bold text-sm shadow-sm shrink-0 border border-emerald-100">
                  {userName.charAt(0).toUpperCase()}
                </div>
                <ChevronDown
                  size={14}
                  className={`text-slate-400 transition-transform duration-200 ${showDropdown ? "rotate-180" : ""}`}
                />
              </div>
            </button>

            {/* Dropdown Menu */}
            {showDropdown && (
              <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="px-4 py-2 border-b border-slate-100 md:hidden">
                  <p className="text-sm font-bold text-slate-800 truncate">
                    {userName}
                  </p>
                  <p className="text-[10px] font-bold text-[#00a884] uppercase tracking-wider truncate">
                    {displayRole.replace("_", " ")}
                  </p>
                </div>

                {/* <button 
                                    className="w-full flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors text-left"
                                >
                                    <User size={16} className="text-slate-400" /> My Profile
                                </button>
                                
                                <div className="h-px bg-slate-100 my-1"></div> */}

                <button
                  onClick={() => {
                    setShowDropdown(false);
                    setShowSignOut(true);
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm font-bold text-rose-600 hover:bg-rose-50 transition-colors text-left"
                >
                  <LogOut size={16} /> Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
