"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import Sidebar from "@/shared/components/layout/Sidebar";
import Topbar from "@/shared/components/layout/Topbar";
import { useUserStore } from "@/features/user/stores/userStore";
import { authRepository } from "@/shared/api/repositories/authRepository";

import { useQueryClient } from "@tanstack/react-query";
import { realtimeService } from "@/shared/services/realtimeService";

import { useAssociateSession } from "@/shared/hooks/useAssociateSession";

const CrmLayoutContext = createContext(null);

export function useCrmLayout() {
  const ctx = useContext(CrmLayoutContext);
  if (!ctx) {
    throw new Error("useCrmLayout must be used within CrmShell");
  }
  return ctx;
}

export default function CrmShell({ children }) {
  const { data: session, status } = useSession();
  const queryClient = useQueryClient();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isDesktopExpanded, setIsDesktopExpanded] = useState(false);

  const associateSessionState = useAssociateSession();

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("crm_sidebar_expanded");
      if (saved !== null) {
        setIsDesktopExpanded(saved === "true");
      } else {
        setIsDesktopExpanded(window.innerWidth >= 1440);
      }
    }
  }, []);

  const toggleDesktopSidebar = () => {
    setIsDesktopExpanded((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem("crm_sidebar_expanded", String(next));
      }
      return next;
    });
  };
  
  const fetchCurrentUser = useUserStore((state) => state.fetchCurrentUser);
  const isSuspended = useUserStore((state) => state.isSuspended);
  const user = useUserStore((state) => state.user);

  useEffect(() => {
    const effectiveUser = user || session?.user;
    if (effectiveUser && status === "authenticated") {
      realtimeService.init(queryClient, effectiveUser);
    }
  }, [user, session?.user, status, queryClient]);

  useEffect(() => {
    if (session && status === "authenticated") {
      fetchCurrentUser(authRepository).catch((err) => {
        const errStatus = err.status || err.response?.status;
        const errMsg = err.message || err.response?.data?.error;
        if (errStatus === 403 && errMsg === "Suspended") {
          // Do not automatically sign out! Keep session alive.
          return;
        }
        console.error("Session invalid or user inactive:", errMsg || err);
        signOut({ callbackUrl: "/" });
      });
    }
  }, [session, status, fetchCurrentUser]);

  // Disable escape key when suspended
  useEffect(() => {
    if (!isSuspended) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSuspended]);

  const handleLogout = async () => {
    useUserStore.getState().clearUser();
    await signOut({ callbackUrl: "/" });
  };

  if (isSuspended) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4 select-none">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-slate-200 text-center flex flex-col items-center gap-6 animate-scale-up">
          <div className="w-20 h-20 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-500 border border-rose-100 shadow-inner">
            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight mb-2">Account Inactive</h2>
            <p className="text-slate-500 text-sm font-medium leading-relaxed">
              Your account has been marked as Inactive by an administrator. Please contact your administrator to reactivate your account.
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full py-4 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-lg shadow-rose-200 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
          >
            <span>Logout</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <CrmLayoutContext.Provider
      value={{
        mobileOpen,
        setMobileOpen,
        session,
        status,
        role: session?.user?.role,
        setIsDesktopExpanded,
        isDesktopExpanded,
        toggleDesktopSidebar,
        associateSession: associateSessionState,
      }}
    >
      <div className="flex h-[100dvh] bg-[var(--background)] font-sans overflow-hidden">
        <Sidebar
          role={session?.user?.role}
          mobileOpen={mobileOpen}
          setMobileOpen={setMobileOpen}
          setIsDesktopExpanded={setIsDesktopExpanded}
          isDesktopExpanded={isDesktopExpanded}
          toggleDesktopSidebar={toggleDesktopSidebar}
        />
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          <Topbar />
          {children}
        </div>
      </div>
    </CrmLayoutContext.Provider>
  );
}
