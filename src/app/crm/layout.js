"use client";

import { useEffect } from "react";
import CrmShell from "@/shared/components/layout/CrmShell";
import { useAuth } from "@/shared/hooks/useAuth";
import { presenceService } from "@/features/presence/services/presenceService";

export default function CrmLayout({ children }) {
  const { user } = useAuth();

  useEffect(() => {
    if (user && user.id) {
      presenceService.init(user);
    }
    return () => {
      presenceService.destroy();
    };
  }, [user]);

  return <CrmShell>{children}</CrmShell>;
}
