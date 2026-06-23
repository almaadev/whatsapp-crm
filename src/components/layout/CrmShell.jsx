"use client";

import { createContext, useContext, useState } from "react";
import { useSession } from "next-auth/react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

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
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isDesktopExpanded, setIsDesktopExpanded] = useState(false);
  return (
    <CrmLayoutContext.Provider
      value={{
        mobileOpen,
        setMobileOpen,
        session,
        status,
        role: session?.user?.role,
        setIsDesktopExpanded,
        isDesktopExpanded
      }}
    >
      <div className="flex h-[100dvh] bg-[var(--background)] font-sans overflow-hidden ">
        <Sidebar
          role={session?.user?.role}
          mobileOpen={mobileOpen}
          setMobileOpen={setMobileOpen}
          setIsDesktopExpanded = {setIsDesktopExpanded}
          isDesktopExpanded = {isDesktopExpanded}
        />
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          <Topbar />
          {children}
        </div>
      </div>
    </CrmLayoutContext.Provider>
  );
}
