"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import Sidebar from "@/components/layout/Sidebar";
import AlmaaLogo from "@/../public/logo/Almaa Herbal Logo.png";
import { Megaphone, ShieldAlert, Menu } from "lucide-react";

export default function AdsLeadPage() {
  const { data: session, status } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const userRole = session?.user?.role;
  const displayRole = userRole || "";
  const department = session?.user?.department || "";
  const accessModules = session?.user?.accessModules || [];

  const isAdminAuthorized =
    displayRole === 'superAdmin' ||
    (displayRole === 'sales' && department === 'admin') ||
    (displayRole === 'doctor' && department === 'admin');

  // Check if user has 'Ads Lead' module access
  const hasAccess = (moduleName) => {
    if (isAdminAuthorized) return true;
    return accessModules.includes(moduleName);
  };

  const isAuthorized = hasAccess("Ads Lead");

  if (status === "loading") {
    return <div className="flex h-[100dvh] items-center justify-center text-slate-500 font-medium">Loading Ads Lead...</div>;
  }
  
  if (!session) return null;

  // Access Denied Screen
  if (!isAuthorized) {
      return (
          <div className="flex h-[100dvh] bg-gray-100 overflow-hidden relative">
              <div className="flex-shrink-0 z-40">
                  <Sidebar role={userRole} mobileOpen={mobileMenuOpen} setMobileOpen={setMobileMenuOpen} />
              </div>

              <div className="flex flex-1 w-full h-full relative overflow-hidden flex-col">
                  <div className="md:hidden h-14 bg-white border-b flex items-center px-4 shrink-0 justify-between z-30 shadow-sm">
                      <button onClick={() => setMobileMenuOpen(true)} className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-md">
                          <Menu size={24} />
                      </button>
                  </div>
                  <div className="flex flex-col items-center justify-center h-full p-4 text-center">
                      <ShieldAlert size={60} className="text-red-400 mb-4" />
                      <h2 className="text-2xl font-bold text-slate-800">Access Denied</h2>
                      <p className="text-slate-500 mt-2">You do not have permission to access the Ads Lead module.</p>
                  </div>
              </div>
          </div>
      );
  }

  return (
    <div className="flex h-[100dvh] bg-slate-50 overflow-hidden relative">
      <div className="flex-shrink-0 z-40">
        <Sidebar role={userRole} mobileOpen={mobileMenuOpen} setMobileOpen={setMobileMenuOpen} />
      </div>

      <div className="flex flex-1 w-full h-full relative overflow-hidden flex-col">
        {/* Mobile Header */}
        <div className="md:hidden h-14 bg-white border-b flex items-center px-4 shrink-0 justify-between z-30 shadow-sm">
          <button onClick={() => setMobileMenuOpen(true)} className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-md">
             <Menu size={24} />
          </button>
          <div className="font-semibold text-gray-700">
            <div className=" w-20 flex items-center justify-center shrink-0 p-1">
              <img src={AlmaaLogo.src} alt="Almaa" className="w-full h-full object-contain" />
            </div>
          </div>
          <div className="w-8"></div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 w-full">
            <div className="max-w-7xl mx-auto">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl shadow-sm">
                        <Megaphone size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Ads Lead</h1>
                        <p className="text-sm text-slate-500">Manage all your advertisement generated leads here.</p>
                    </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center text-slate-500">
                     Start building your Ads Lead table or UI here...
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}