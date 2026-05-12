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
<<<<<<< HEAD

      if (role === "admin" || role === "superAdmin") {
=======
      const department = session.user.department;
      if (department === "admin" || role === "superAdmin") {
>>>>>>> c1be5bc (Initial commit from new system)
        // Admin goes to Admin Panel by default
        router.replace("/crm/admin");
      } else {
        // Associates go straight to Chat
        router.replace("/crm/associate");
      }
    }
  }, [status, session, router]);

  return <div className="h-screen flex items-center justify-center text-gray-500">Redirecting...</div>;
}