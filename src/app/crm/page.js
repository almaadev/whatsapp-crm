"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/shared/hooks/useAuth";

export default function DashboardRoot() {
  const { data: session, status } = useSession();
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading" || isLoading) return;

    const activeUser = user || session?.user;
    if (activeUser) {
      const role = activeUser.role;
      const department = activeUser.department;
      if (department === "admin" || role === "superAdmin") {
        // Admin goes to Admin Panel by default
        router.replace("/crm/admin");
      } else {
        // Associates go straight to Chat
        router.replace("/crm/associate");
      }
    }
  }, [status, isLoading, user, session, router]);

  return <div className="h-screen flex items-center justify-center text-gray-500">Redirecting...</div>;
}