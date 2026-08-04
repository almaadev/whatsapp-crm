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
import api from "@/shared/lib/axios";
import SenderSelector from "@/shared/components/layout/SenderSelector";

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
  const availableNumbers = useChatStore((s) => s.availableNumbers);
  const selectedSender = useChatStore((s) => s.selectedSender);
  const setAvailableNumbers = useChatStore((s) => s.setAvailableNumbers);
  const setSelectedSender = useChatStore((s) => s.setSelectedSender);

  // Get user from store and clearUser function
  const user = useUserStore((state) => state.user);
  const clearUser = useUserStore((state) => state.clearUser);

  // States
  const [showSignOut, setShowSignOut] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [sendersLoading, setSendersLoading] = useState(false);

  const userId = user?._id || user?.id;

  useEffect(() => {
    if (userId) {
      setSendersLoading(true);
      api
        .get("/api/admin/twilio")
        .then(({ data }) => {
          if (data?.numbers && Array.isArray(data.numbers)) {
            setAvailableNumbers(data.numbers);
            const stored =
              typeof window !== "undefined"
                ? localStorage.getItem("selected_whatsapp_sender")
                : null;
            const match = data.numbers.find(
              (n) =>
                n.phoneNumber === stored ||
                `whatsapp:${n.phoneNumber}` === stored,
            );
            if (match) {
              setSelectedSender(match.phoneNumber);
            } else if (data.numbers.length > 0) {
              setSelectedSender(data.numbers[0].phoneNumber);
            }
          }
        })
        .catch((err) =>
          console.error("Failed to load twilio senders in Topbar:", err),
        )
        .finally(() => setSendersLoading(false));
    }
  }, [userId, setAvailableNumbers, setSelectedSender]);
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
          </div>
          <div className="hidden sm:block w-px h-8 bg-slate-200 mx-1"></div>
          {/* NOTIFICATION PANEL */}
          <div className="relative">
            <button
              onClick={() => {
                const nextState = !showNotifications;
                if (nextState) {
                  console.log("[Bell] Notification opened");
                }
                setShowNotifications(nextState);
              }}
              className="p-2 text-slate-500 hover:text-[#00a884] hover:bg-slate-50 rounded-xl relative transition-all cursor-pointer focus:outline-none"
            >
              <Bell size={20} />
              {notifications.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center border border-white">
                  {notifications.length}
                </span>
              )}
            </button>

            <NotificationPanel
              isOpen={showNotifications}
              onClose={() => setShowNotifications(false)}
            />
          </div>
          <div className="hidden sm:block w-px h-8 bg-slate-200 mx-1"></div>
          {/* WhatsApp Sender Selector */}
          <SenderSelector layout="default" className="hidden sm:flex" />
          <div className="hidden sm:block w-px h-8 bg-slate-200 mx-1"></div>
        </div>

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

              {/* Mobile WhatsApp Sender Selector */}
              <SenderSelector
                layout="overflow"
                className="md:hidden"
                onCloseParent={() => setShowDropdown(false)}
              />

              <button
                onClick={() => {
                  setShowDropdown(false);
                  setShowSignOut(true);
                }}
                className="w-full flex items-center gap-2 px-4 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 transition-colors text-left font-sans"
              >
                <LogOut size={16} /> Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
