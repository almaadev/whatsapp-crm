"use client";
import { useSession, signOut } from "next-auth/react";
import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import AlmaaLogo from "@/../public/logo/Almaa Herbal Logo.png";
import SignOutModal from "@/shared/components/modals/SignOutModal";
import { authRepository } from "@/shared/api/repositories/authRepository";
import { ChevronDown } from "lucide-react";
import { isAdminAuthorized, hasModuleAccess } from "@/shared/utils/auth";
import { NAVIGATION_CONFIG } from "@/shared/config/navigation";

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

  // Manage dropdown states generically
  const [dropdowns, setDropdowns] = useState(() => {
    const initialState = {};
    NAVIGATION_CONFIG.forEach((nav) => {
      if (nav.type === "dropdown" && nav.stateKey) {
        initialState[nav.stateKey] =
          nav.paths?.some(
            (p) => pathname === p || pathname.startsWith(p + "/"),
          ) || false;
      }
    });
    return initialState;
  });

  const toggleDropdown = (key) => {
    setDropdowns((prev) => ({ ...prev, [key]: !prev[key] }));
  };

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
      await authRepository.logout();
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
          {NAVIGATION_CONFIG.map((nav, index) => {
            // Permission checks
            if (nav.adminOnly && !isAdmin) return null;
            if (nav.hideForAdmin && isAdmin) return null;
            if (nav.moduleName && !hasAccess(nav.moduleName)) return null;
            if (
              nav.accessRequirements &&
              !nav.accessRequirements.some((req) => hasAccess(req))
            )
              return null;

            const Icon = nav.icon;

            if (nav.type === "dropdown") {
              const isOpen = dropdowns[nav.stateKey];
              const isActiveRoute = nav.paths?.some(
                (p) => pathname === p || pathname.startsWith(p + "/"),
              );

              return (
                <div key={index} className="flex flex-col gap-1">
                  <div
                    onClick={() => {
                      if (!isExpanded) {
                        if (window.innerWidth < 768) setMobileOpen(true);
                        else setIsDesktopExpanded(true);
                        setDropdowns((prev) => ({
                          ...prev,
                          [nav.stateKey]: true,
                        }));
                      } else {
                        toggleDropdown(nav.stateKey);
                      }
                    }}
                    className={`flex items-center gap-4 p-3.5 rounded-xl transition-all duration-200 cursor-pointer group font-medium ${
                      isActiveRoute && !isOpen
                        ? "bg-white/10 text-white"
                        : "text-white hover:bg-white/20"
                    } ${isExpanded ? "justify-between" : "justify-center"}`}
                  >
                    <div className="flex items-center gap-4">
                      <span className="shrink-0 transition-transform duration-200 group-hover:scale-110">
                        {Icon && <Icon size={22} />}
                      </span>
                      {isExpanded && (
                        <span className="text-[15px] tracking-wide crm-fade-in font-medium">
                          {nav.label}
                        </span>
                      )}
                    </div>
                    {isExpanded && (
                      <ChevronDown
                        size={16}
                        className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                      />
                    )}
                  </div>

                  {isExpanded && isOpen && (
                    <div className="flex flex-col gap-1 ml-[22px] pl-4 border-l-2 border-white/20 mt-1 mb-2 crm-slide-in-top">
                      {nav.items.map((item, i) => {
                        if (item.moduleName && !hasAccess(item.moduleName))
                          return null;
                        const ItemIcon = item.icon;
                        const isItemActive = pathname === item.href;

                        return (
                          <Link key={i} href={item.href}>
                            <div
                              className={`py-2 px-3 rounded-lg text-sm transition-all duration-200 flex items-center gap-2 ${
                                isItemActive
                                  ? "bg-white text-[var(--brand-sidebar-active)] font-bold shadow-sm translate-x-1"
                                  : "text-white/80 hover:text-white hover:bg-white/10 hover:translate-x-1"
                              }`}
                            >
                              {ItemIcon && (
                                <ItemIcon size={item.iconSize || 14} />
                              )}
                              <span>{item.label}</span>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            // Regular link
            const isActive = nav.matchStartsWith
              ? pathname.startsWith(nav.href)
              : pathname === nav.href;
            return (
              <Link key={index} href={nav.href}>
                <NavItem
                  isOpen={isExpanded}
                  active={isActive}
                  label={nav.label}
                  icon={Icon ? <Icon size={22} /> : null}
                />
              </Link>
            );
          })}
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
