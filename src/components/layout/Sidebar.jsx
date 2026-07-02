"use client";
import { useSession, signOut } from "next-auth/react";
import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import AlmaaLogo from "@/../public/logo/Almaa Herbal Logo.png";
import SignOutModal from "@/components/modals/SignOutModal";

import {
  LayoutDashboard,
  MessagesSquare,
  Users,
  Share2,
  List,
  Send,
  ChevronDown,
  History,
  FileBarChart,
} from "lucide-react";
import { isAdminAuthorized, hasModuleAccess } from "@/utils/auth";

/**
 * Renders the sidebar navigation for the CRM layout.
 * Controls access to various modules (Admin, Chat, Leads, etc.) based on user roles and session data.
 *
 * @param {Object} props
 * @param {string} props.role - The role of the user (e.g., 'admin', 'associate').
 * @param {boolean} props.mobileOpen - State controlling if the mobile sidebar is open.
 * @param {Function} props.setMobileOpen - Setter to toggle mobile sidebar state.
 * @param {Function} props.setIsDesktopExpanded - Setter to toggle desktop sidebar expansion.
 * @param {boolean} props.isDesktopExpanded - State indicating if desktop sidebar is expanded.
 * @returns {JSX.Element} The Sidebar component
 */
export default function Sidebar({
  role,
  mobileOpen = false,
  setMobileOpen = () => {},
  setIsDesktopExpanded,
  isDesktopExpanded,
}) {
  const { data: session } = useSession();
  const pathname = usePathname();

  const [showSignOut, setShowSignOut] = useState(false);

  // Added Twilio to Admin Checks
  const [adminDropdownOpen, setAdminDropdownOpen] = useState(
    pathname === "/crm/admin" ||
      pathname.startsWith("/crm/associate-management") ||
      pathname.startsWith("/crm/admin/template-manager") ||
      pathname.startsWith("/crm/admin/twilio") ||
      pathname.startsWith("/crm/admin/reports"),
  );

  const [chatDropdownOpen, setChatDropdownOpen] = useState(
    pathname === "/crm/chat" ||
      pathname.startsWith("/crm/product-lead") ||
      pathname.startsWith("/crm/md-camp") ||
      pathname.startsWith("/crm/therapy"),
  );

  const displayRole = role || "";
  const department = session?.user?.department || "";

  const isAdmin = isAdminAuthorized(displayRole, department);
  const hasAccess = (moduleName) => hasModuleAccess(session, moduleName);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) setMobileOpen(false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [setMobileOpen]);

  const isExpanded = mobileOpen || isDesktopExpanded;

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
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <SignOutModal
        isOpen={showSignOut}
        onClose={() => setShowSignOut(false)}
        onConfirm={handleConfirmSignOut}
      />

      <aside
        className={`
          bg-[var(--brand-sidebar)] text-white flex flex-col border-r border-white/10 transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1.0)] z-50
          fixed inset-y-0 left-0 h-full shadow-2xl md:shadow-none select-none
          ${mobileOpen ? "translate-x-0 w-72" : "-translate-x-full w-72"}
          md:relative md:translate-x-0 
          ${isDesktopExpanded ? "md:w-72" : "md:w-[72px]"}
        `}
      >
        {/* Header */}
        <div
          className={`flex items-center h-20  ${isExpanded ? "px-4" : "px-2"} shrink-0 border-b border-white/10 ${isExpanded ? "justify-between" : "justify-center"}`}
        >
          {isExpanded ? (
            <div className="flex items-center gap-3 overflow-hidden">
              <div className=" w-28 flex items-center justify-center shrink-0 p-1">
                <Image
                  src={AlmaaLogo.src}
                  alt="Almaa"
                  width={100}
                  height={100}
                  className="w-full h-full object-contain"
                  draggable={false}
                />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-white text-lg leading-tight tracking-wide">
                  Almaa
                </span>
                <span className="text-[10px] text-green-100 uppercase tracking-wider font-medium">
                  Herbal Nature
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center">
              <Image
                src={AlmaaLogo.src}
                alt="Almaa"
                height={100}
                width={100}
                className="w-full h-full object-contain"
                draggable={false}
              />
            </div>
          )}
        </div>

        {/* Nav Links */}
        <nav className="flex-1 flex flex-col gap-2 p-4 mt-0 overflow-y-auto custom-scrollbar">
          {isAdmin && (
            <div className="flex flex-col gap-1">
              <div
                onClick={() => {
                  if (!isExpanded) {
                    if (window.innerWidth < 768) setMobileOpen(true);
                    else setIsDesktopExpanded(true);
                    setAdminDropdownOpen(true);
                  } else {
                    setAdminDropdownOpen(!adminDropdownOpen);
                  }
                }}
                className={`flex items-center gap-4 p-3.5 rounded-xl transition-all duration-200 cursor-pointer group font-medium ${
                  (pathname === "/crm/admin" ||
                    pathname.startsWith("/crm/associate-management") ||
                    pathname.startsWith("/crm/admin/template-manager") ||
                    pathname.startsWith("/crm/admin/twilio")) &&
                  !adminDropdownOpen
                    ? "bg-white/10 text-white"
                    : "text-white hover:bg-white/20"
                } ${isExpanded ? "justify-between" : "justify-center"}`}
              >
                <div className="flex items-center gap-4">
                  <span className="shrink-0 transition-transform duration-200 group-hover:scale-110">
                    <LayoutDashboard size={22} />
                  </span>
                  {isExpanded && (
                    <span className="text-[15px] tracking-wide crm-fade-in font-medium">
                      Admin Overview
                    </span>
                  )}
                </div>
                {isExpanded && (
                  <ChevronDown
                    size={16}
                    className={`transition-transform duration-200 ${adminDropdownOpen ? "rotate-180" : ""}`}
                  />
                )}
              </div>

              {isExpanded && adminDropdownOpen && (
                <div className="flex flex-col gap-1 ml-[22px] pl-4 border-l-2 border-white/20 mt-1 mb-2 crm-slide-in-top">
                  <Link href="/crm/admin">
                    <div
                      className={`py-2 px-3 rounded-lg text-sm transition-all duration-200 ${
                        pathname === "/crm/admin"
                          ? "bg-white text-[var(--brand-sidebar-active)] font-bold shadow-sm translate-x-1"
                          : "text-white/80 hover:text-white hover:bg-white/10 hover:translate-x-1"
                      }`}
                    >
                      Dashboard
                    </div>
                  </Link>
                  <Link href="/crm/associate-management">
                    <div
                      className={`py-2 px-3 rounded-lg text-sm transition-all duration-200 ${
                        pathname === "/crm/associate-management"
                          ? "bg-white text-[var(--brand-sidebar-active)] font-bold shadow-sm translate-x-1"
                          : "text-white/80 hover:text-white hover:bg-white/10 hover:translate-x-1"
                      }`}
                    >
                      Manage Associates
                    </div>
                  </Link>

                  <Link href="/crm/admin/template-manager">
                    <div
                      className={`py-2 px-3 rounded-lg text-sm transition-all duration-200 ${
                        pathname === "/crm/admin/template-manager"
                          ? "bg-white text-[var(--brand-sidebar-active)] font-bold shadow-sm translate-x-1"
                          : "text-white/80 hover:text-white hover:bg-white/10 hover:translate-x-1"
                      }`}
                    >
                      Template Manager
                    </div>
                  </Link>

                                    <Link
                    href="/crm/admin/keyword-automation"
                    className={`py-2 px-3 rounded-lg text-sm transition-all duration-200 flex items-center  gap-2  ${
                      pathname === "/crm/admin/keyword-automation"
                        ? "bg-white text-[var(--brand-sidebar-active)] font-bold shadow-sm translate-x-1"
                          : "text-white/80 hover:text-white hover:bg-white/10 hover:translate-x-1"
                    }`}
                  >
                    
                    <span>Automatic-reply</span>
                  </Link>
                  
                  {/* 👇 Twilio Logs is now here */}
                  <Link href="/crm/admin/twilio">
                    <div
                      className={`py-2 px-3 rounded-lg text-sm transition-all duration-200 flex items-center  gap-2 ${
                        pathname === "/crm/admin/twilio"
                          ? "bg-white text-[var(--brand-sidebar-active)] font-bold shadow-sm translate-x-1"
                          : "text-white/80 hover:text-white hover:bg-white/10 hover:translate-x-1"
                      }`}
                    >
                      <span>Twilio Center</span>
                    </div>
                  </Link>

                  <Link href="/crm/admin/reports">
                    <div
                      className={`py-2 px-3 rounded-lg text-sm transition-all duration-200 flex items-center gap-2 ${
                        pathname === "/crm/admin/reports"
                          ? "bg-white text-[var(--brand-sidebar-active)] font-bold shadow-sm translate-x-1"
                          : "text-white/80 hover:text-white hover:bg-white/10 hover:translate-x-1"
                      }`}
                    >
                      <FileBarChart size={14} />
                      Reports
                    </div>
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* Normal User Dashboard */}
          {!isAdmin && (
            <Link href="/crm/associate">
              <NavItem
                isOpen={isExpanded}
                active={pathname === "/crm/associate"}
                label="My Dashboard"
                icon={<LayoutDashboard size={22} />}
              />
            </Link>
          )}

          {(hasAccess("Chat Inbox") ||
            hasAccess("Product Lead") ||
            hasAccess("MD Camp") ||
            hasAccess("Therapy")) && (
            <div className="flex flex-col gap-1">
              <div
                onClick={() => {
                  if (!isExpanded) {
                    if (window.innerWidth < 768) setMobileOpen(true);
                    else setIsDesktopExpanded(true);
                    setChatDropdownOpen(true);
                  } else {
                    setChatDropdownOpen(!chatDropdownOpen);
                  }
                }}
                className={`flex items-center gap-4 p-3.5 rounded-xl transition-all duration-200 cursor-pointer group font-medium ${
                  (pathname === "/crm/chat" ||
                    pathname.startsWith("/crm/product-lead") ||
                    pathname.startsWith("/crm/md-camp") ||
                    pathname.startsWith("/crm/therapy")) &&
                  !chatDropdownOpen
                    ? "bg-white/10 text-white"
                    : "text-white hover:bg-white/20"
                } ${isExpanded ? "justify-between" : "justify-center"}`}
              >
                <div className="flex items-center gap-4">
                  <span className="shrink-0 transition-transform duration-200 group-hover:scale-110">
                    <MessagesSquare size={22} />
                  </span>
                  {isExpanded && (
                    <span className="text-[15px] tracking-wide crm-fade-in font-medium">
                      Communications
                    </span>
                  )}
                </div>
                {isExpanded && (
                  <ChevronDown
                    size={16}
                    className={`transition-transform duration-200 ${chatDropdownOpen ? "rotate-180" : ""}`}
                  />
                )}
              </div>

              {isExpanded && chatDropdownOpen && (
                <div className="flex flex-col gap-1 ml-[22px] pl-4 border-l-2 border-white/20 mt-1 mb-2 crm-slide-in-top">
                  {hasAccess("Chat Inbox") && (
                    <Link href="/crm/chat">
                      <div
                        className={`py-2 px-3 rounded-lg text-sm transition-all duration-200 ${
                          pathname === "/crm/chat"
                            ? "bg-white text-[var(--brand-sidebar-active)] font-bold shadow-sm translate-x-1"
                            : "text-white/80 hover:text-white hover:bg-white/10 hover:translate-x-1"
                        }`}
                      >
                        Chat Inbox
                      </div>
                    </Link>
                  )}
                  {hasAccess("Product Lead") && (
                    <Link href="/crm/product-lead">
                      <div
                        className={`py-2 px-3 rounded-lg text-sm transition-all duration-200 ${
                          pathname === "/crm/product-lead"
                            ? "bg-white text-[var(--brand-sidebar-active)] font-bold shadow-sm translate-x-1"
                            : "text-white/80 hover:text-white hover:bg-white/10 hover:translate-x-1"
                        }`}
                      >
                        Product Lead
                      </div>
                    </Link>
                  )}
                  {hasAccess("MD Camp") && (
                    <Link href="/crm/md-camp">
                      <div
                        className={`py-2 px-3 rounded-lg text-sm transition-all duration-200 ${
                          pathname === "/crm/md-camp"
                            ? "bg-white text-[var(--brand-sidebar-active)] font-bold shadow-sm translate-x-1"
                            : "text-white/80 hover:text-white hover:bg-white/10 hover:translate-x-1"
                        }`}
                      >
                        MD Camp
                      </div>
                    </Link>
                  )}
                  {hasAccess("Therapy") && (
                    <Link href="/crm/therapy">
                      <div
                        className={`py-2 px-3 rounded-lg text-sm transition-all duration-200 ${
                          pathname === "/crm/therapy"
                            ? "bg-white text-[var(--brand-sidebar-active)] font-bold shadow-sm translate-x-1"
                            : "text-white/80 hover:text-white hover:bg-white/10 hover:translate-x-1"
                        }`}
                      >
                        Therapy
                      </div>
                    </Link>
                  )}
                </div>
              )}
            </div>
          )}

          {hasAccess("Bulk Messages") && (
            <Link href="/crm/bulk-message">
              <NavItem
                isOpen={isExpanded}
                active={pathname === "/crm/bulk-message"}
                label="Bulk Messages"
                icon={<Send size={22} />}
              />
            </Link>
          )}

          {hasAccess("logs") && (
            <Link href="/crm/message-logs">
              <NavItem
                isOpen={isExpanded}
                active={pathname === "/crm/message-logs"}
                label="Message Logs"
                icon={<History size={22} />}
              />
            </Link>
          )}

          {hasAccess("Leads") && (
            <Link href="/crm/leads">
              <NavItem
                isOpen={isExpanded}
                active={pathname === "/crm/leads"}
                label="Leads"
                icon={<List size={22} />}
              />
            </Link>
          )}

          {hasAccess("Customers") && (
            <Link href="/crm/customers">
              <NavItem
                isOpen={isExpanded}
                active={pathname.startsWith("/crm/customers")}
                label="Customers"
                icon={<Users size={22} />}
              />
            </Link>
          )}

          {hasAccess("Leads") && (
            <Link href="/crm/forwarded-leads">
              <NavItem
                isOpen={isExpanded}
                active={pathname === "/crm/forwarded-leads"}
                label="Forwarded Leads"
                icon={<Share2 size={22} />}
              />
            </Link>
          )}
        </nav>

        {/* Footer */}

        {isExpanded && (
          <div className="border-t border-white/10 px-4 py-4 shrink-0 bg-(--brand-sidebar-footer)">
            <div className="space-y-1 text-white/80 text-xs">
              <p className="font-semibold text-white">Almaa Whatsapp CRM</p>
              <p className="leading-relaxed">
                Managed by Almaa Software Systems
              </p>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}

function NavItem({ isOpen, icon, label, active }) {
  return (
    <div
      className={`
      flex items-center gap-4 p-3.5 rounded-xl transition-all duration-200 cursor-pointer group font-medium
      ${
        active
          ? "bg-white text-[var(--brand-sidebar-active)] shadow-lg shadow-black/10 translate-x-1"
          : "text-white hover:bg-white/20 hover:text-white hover:translate-x-1"
      } 
      ${isOpen ? "justify-start" : "justify-center"}
    `}
    >
      <span
        className={`shrink-0 transition-transform duration-200 ${active ? "scale-110" : "group-hover:scale-110"}`}
      >
        {icon}
      </span>

      {isOpen && (
        <span
          className={`text-[15px] tracking-wide crm-fade-in ${active ? "font-bold" : "font-medium"}`}
        >
          {label}
        </span>
      )}
    </div>
  );
}
