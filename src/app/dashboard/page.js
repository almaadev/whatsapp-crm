"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function DashboardRoot() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated" && session?.user) {
      const role = session.user.role;

      if (role === "admin" || role === "superAdmin") {
        // Admin goes to Admin Panel by default
        router.replace("/dashboard/admin");
      } else {
        // Associates go straight to Chat
        router.replace("/dashboard/chat");
      }
    }
  }, [status, session, router]);

  return <div className="h-screen flex items-center justify-center text-gray-500">Redirecting...</div>;
}