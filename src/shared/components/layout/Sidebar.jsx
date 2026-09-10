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
import { checkPermissions } from "@/shared/utils/auth";
import { NAVIGATION_CONFIG } from "@/shared/config/navigation";
import { useUserStore } from "@/features/user/stores/userStore";

export default function Sidebar({
  role,
  mobileOpen = false,
  setMobileOpen = () => {},
  setIsDesktopExpanded,
  isDesktopExpanded,
  toggleDesktopSidebar,
}) {
  const { data: session } = useSession();
  const user = useUserStore((state) => state.user);
  const pathname = usePathname();

  const [showSignOut, setShowSignOut] = useState(false);
  const [hoveredNav, setHoveredNav] = useState(null);

  // Helper to determine active dropdown menu based on current route
  const isPathMatchingNav = (path, nav) => {
    if (!nav || !path) return false;
    if (nav.paths?.includes(path)) return true;
    if (nav.items?.some((item) => item.href === path)) return true;
    // Specific sub-path match without greedy root prefix matching
    if (
      nav.items?.some(
        (item) =>
          item.href !== "/crm/admin" && path.startsWith(item.href + "/"),
      )
    ) {
      return true;
    }
    if (
      nav.paths?.some((p) => p !== "/crm/admin" && path.startsWith(p + "/"))
    ) {
      return true;
    }
    return false;
  };

  const getActiveMenuFromPath = (path) => {
    for (const nav of NAVIGATION_CONFIG) {
      if (nav.type === "dropdown") {
        const menuKey = nav.id || nav.stateKey || nav.label;
        if (isPathMatchingNav(path, nav)) {
          return menuKey;
        }
      }
    }
    return null;
  };

  // Accordion state: only one parent menu key can be open at a time (or null if all closed)
  const [openMenu, setOpenMenu] = useState(() =>
    getActiveMenuFromPath(pathname),
  );

  // Keep accordion open for the active route when navigating
  useEffect(() => {
    const active = getActiveMenuFromPath(pathname);
    if (active) {
      setOpenMenu(active);
    }
  }, [pathname]);

  const toggleMenu = (menuKey) => {
    setOpenMenu((current) => (current === menuKey ? null : menuKey));
  };

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
      {/* Mobile Backdrop Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm transition-opacity duration-300"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <SignOutModal
        isOpen={showSignOut}
        onClose={() => setShowSignOut(false)}
        onConfirm={handleConfirmSignOut}
      />

      <aside
        role="navigation"
        aria-expanded={isExpanded}
        className={`
          bg-[var(--brand-sidebar)] text-white flex flex-col border-r border-white/10
          transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1.0)] z-50
          fixed inset-y-0 left-0 h-full shadow-2xl md:shadow-none select-none shrink-0 relative
          ${mobileOpen ? "translate-x-0 w-[272px]" : "-translate-x-full w-[272px]"}
          md:relative md:translate-x-0
          ${isExpanded ? "md:w-[272px]" : "md:w-[70px]"}
        `}
      >
        {/* Header / Logo Section */}
        <div
          className={`flex items-center h-16 shrink-0 border-b border-white/10 transition-all duration-300 ${
            isExpanded ? "px-4 justify-between" : "px-0 justify-center"
          }`}
        >
          {isExpanded ? (
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-10 h-10 flex items-center justify-center shrink-0 p-0.5">
                <Image
                  src={AlmaaLogo.src}
                  alt="Almaa Logo"
                  width={36}
                  height={36}
                  className="w-full h-full object-contain"
                  draggable={false}
                />
              </div>
              <div className="flex flex-col truncate">
                <span className="font-extrabold text-white text-base leading-tight tracking-wide truncate">
                  Almaa
                </span>
                <span className="text-[10px] text-emerald-200 uppercase tracking-widest font-bold truncate">
                  Herbal Nature
                </span>
              </div>
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Image
                src={AlmaaLogo.src}
                alt="Almaa Logo"
                width={36}
                height={36}
                className="w-9 h-9 object-contain"
                draggable={false}
              />
            </div>
          )}
        </div>

        {/* Navigation Items Scroll Container */}
        <nav className="flex-1 flex flex-col gap-1.5 p-2.5 overflow-y-auto custom-scrollbar overflow-x-hidden">
          {NAVIGATION_CONFIG.map((nav, index) => {
            if (!checkPermissions(user || session, nav)) return null;
            if (nav.hideForAdmin && (user?.role === "superAdmin" || user?.department === "admin")) return null;
            const Icon = nav.icon;
            const isHovered = hoveredNav === index;

            if (nav.type === "dropdown") {
              const menuKey = nav.id || nav.stateKey || nav.label;
              const isOpen = openMenu === menuKey;
              const isActiveRoute = isPathMatchingNav(pathname, nav);

              return (
                <div
                  key={index}
                  className="flex flex-col gap-1 relative"
                  onMouseEnter={() => setHoveredNav(index)}
                  onMouseLeave={() => setHoveredNav(null)}
                >
                  <button
                    type="button"
                    tabIndex={0}
                    aria-label={nav.label}
                    aria-expanded={isOpen}
                    onClick={() => {
                      if (!isExpanded) {
                        if (window.innerWidth < 768) setMobileOpen(true);
                        else if (toggleDesktopSidebar) toggleDesktopSidebar();
                        else setIsDesktopExpanded(true);
                        setOpenMenu(menuKey);
                      } else {
                        toggleMenu(menuKey);
                      }
                    }}
                    className={`
                      relative flex items-center rounded-xl transition-all duration-200 cursor-pointer group outline-none font-medium w-full
                      ${
                        isActiveRoute
                          ? "bg-white/15 text-white font-bold before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1.5 before:bg-emerald-400 before:rounded-r-full"
                          : "text-white/80 hover:text-white hover:bg-white/10"
                      }
                      ${isExpanded ? "px-3.5 py-2.5 justify-between" : "h-11 w-11 mx-auto justify-center"}
                    `}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <span className="shrink-0 transition-transform duration-200 group-hover:scale-110">
                        {Icon && <Icon size={20} />}
                      </span>
                      {isExpanded && (
                        <span className="text-sm font-semibold tracking-wide truncate">
                          {nav.label}
                        </span>
                      )}
                    </div>
                    {isExpanded && (
                      <ChevronDown
                        size={16}
                        className={`shrink-0 transition-transform duration-200 ${
                          isOpen ? "rotate-180 text-white" : "text-white/60"
                        }`}
                      />
                    )}
                  </button>

                  {/* Collapsed Hover Tooltip */}
                  {!isExpanded && isHovered && (
                    <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-lg shadow-2xl border border-slate-700 pointer-events-none whitespace-nowrap z-[100] animate-in fade-in zoom-in-95">
                      {nav.label}
                    </div>
                  )}

                  {/* Expanded Dropdown Items */}
                  {isExpanded && isOpen && (
                    <div className="flex flex-col gap-1 ml-4 pl-3.5 border-l-2 border-white/15 my-1 crm-slide-in-top">
                      {nav.items.map((item, i) => {
                        if (!checkPermissions(user || session, item))
                          return null;
                        const ItemIcon = item.icon;
                        const isItemActive =
                          pathname === item.href ||
                          (item.href !== "/crm/admin" &&
                            pathname.startsWith(item.href + "/"));

                        return (
                          <Link
                            key={i}
                            href={item.href}
                            className="outline-none"
                          >
                            <div
                              tabIndex={0}
                              className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all duration-200 flex items-center gap-2.5 ${
                                isItemActive
                                  ? "bg-white text-[var(--brand-sidebar-active)] font-bold shadow-sm translate-x-1"
                                  : "text-white/75 hover:text-white hover:bg-white/10 hover:translate-x-1"
                              }`}
                            >
                              {ItemIcon && (
                                <ItemIcon
                                  size={item.iconSize || 14}
                                  className="shrink-0"
                                />
                              )}
                              <span className="truncate">{item.label}</span>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            // Regular Link
            const isActive = nav.matchStartsWith
              ? pathname.startsWith(nav.href)
              : pathname === nav.href;

            return (
              <div
                key={index}
                className="relative"
                onMouseEnter={() => setHoveredNav(index)}
                onMouseLeave={() => setHoveredNav(null)}
              >
                <Link href={nav.href} className="outline-none">
                  <div
                    tabIndex={0}
                    aria-label={nav.label}
                    className={`
                      relative flex items-center rounded-xl transition-all duration-200 cursor-pointer group font-medium w-full
                      ${
                        isActive
                          ? "bg-white text-[var(--brand-sidebar-active)] font-bold shadow-md shadow-black/10 before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1.5 before:bg-emerald-500 before:rounded-r-full"
                          : "text-white/80 hover:text-white hover:bg-white/10"
                      }
                      ${isExpanded ? "px-3.5 py-2.5 justify-start gap-3.5" : "h-11 w-11 mx-auto justify-center"}
                    `}
                  >
                    <span className="shrink-0 transition-transform duration-200 group-hover:scale-110">
                      {Icon && <Icon size={20} />}
                    </span>
                    {isExpanded && (
                      <span className="text-sm font-semibold tracking-wide truncate">
                        {nav.label}
                      </span>
                    )}
                  </div>
                </Link>

                {/* Collapsed Hover Tooltip */}
                {!isExpanded && isHovered && (
                  <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-lg shadow-2xl border border-slate-700 pointer-events-none whitespace-nowrap z-[100] animate-in fade-in zoom-in-95">
                    {nav.label}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Footer */}
        {isExpanded ? (
          <div className="border-t border-white/10 px-4 py-3.5 shrink-0 bg-white/5">
            <div className="space-y-0.5 text-white/80 text-xs">
              <p className="font-extrabold text-white truncate">
                Almaa Whatsapp CRM
              </p>
              <p className="text-[10px] text-white/60 truncate">
                Enterprise Management System
              </p>
            </div>
          </div>
        ) : (
          <div className="border-t border-white/10 py-3 flex justify-center shrink-0">
            <span
              className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"
              title="System Online"
            />
          </div>
        )}
      </aside>
    </>
  );
}
