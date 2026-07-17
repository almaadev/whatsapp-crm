"use client";

import React, { useState, useRef, useEffect } from "react";
import { signOut } from "next-auth/react";
import { LayoutGrid, Bell, Menu, LogOut, ChevronDown } from "lucide-react";
import { useCrmLayout } from "@/shared/components/layout/CrmShell";
import SignOutModal from "@/shared/components/modals/SignOutModal";
import NotificationPanel from "@/shared/components/layout/NotificationPanel";
import { useChatStore } from "@/features/chat/stores/chatStore";
import { authRepository } from "@/shared/api/repositories/authRepository";
import { useUserStore } from "@/features/user/stores/userStore";

/**
 * Renders the top navigation bar of the CRM layout.
 * Includes toggles for the sidebar (mobile/desktop), notifications panel,
 * and user profile dropdown for signing out.
 *
 * @returns {JSX.Element} The Topbar component
 */
export default function Topbar() {
  const { setMobileOpen, isDesktopExpanded, setIsDesktopExpanded } =
    useCrmLayout();

  const notifications = useChatStore((s) => s.notifications);

  // Get user from store and clearUser function
  const user = useUserStore((state) => state.user);
  const clearUser = useUserStore((state) => state.clearUser);

  // States
  const [showSignOut, setShowSignOut] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const dropdownRef = useRef(null);

  const userName = user?.name || "User";
  const displayRole = user?.role || "";

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
      await authRepository.logout();
    } catch (error) {
      console.error("Secure logout API failed:", error);
    } finally {
      clearUser();
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
          <div
            className={`relative transition-all duration-200 border border-transparent ${
              showDropdown
                ? "md:bg-white md:border-slate-200 md:shadow-lg md:rounded-t-xl"
                : ""
            }`}
            ref={dropdownRef}
          >
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className={`flex items-center gap-2 sm:gap-3 p-1 rounded-xl transition-colors focus:outline-none ${
                showDropdown ? "md:bg-slate-50/50" : "hover:bg-slate-50"
              }`}
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
              <div className="absolute top-full right-[-1px] md:left-[-1px] mt-0 md:w-auto w-48 bg-white border border-slate-200 md:border-t-0 rounded-b-xl md:rounded-t-none rounded-t-xl shadow-lg py-1.5 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                <div className="px-4 py-2 border-b border-slate-100 md:hidden">
                  <p className="text-sm font-bold text-slate-800 truncate">
                    {userName}
                  </p>
                  <p className="text-[10px] font-bold text-[#00a884] uppercase tracking-wider truncate">
                    {displayRole.replace("_", " ")}
                  </p>
                </div>

                {/* <button className="w-full flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors text-left">
                                    <User size={16} className="text-slate-400" /> My Profile
                    </button>
                                
                                <div className="h-px bg-slate-100 my-1"></div> */}

                <button
                  onClick={() => {
                    setShowDropdown(false);
                    setShowSignOut(true);
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 transition-colors text-left"
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
