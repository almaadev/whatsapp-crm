import { useSession } from "next-auth/react";
import { useUserStore } from "@/features/user/stores/userStore";
import {
  isAdminAuthorized,
  hasModuleAccess as checkModuleAccess,
  isSuperAdmin as checkSuperAdmin,
} from "@/shared/utils/auth";

export function useAuth() {
  const { data: session, status } = useSession();
  const storeUser = useUserStore((state) => state.user);
  const storeIsLoading = useUserStore((state) => state.isLoading);
  const isInitialized = useUserStore((state) => state.isInitialized);

  const effectiveUser = storeUser || session?.user || null;
  const isSessionLoading = status === "loading";
  
  // Auth is loading if NextAuth is loading, OR if store is actively fetching without a known user
  const isAuthLoading = isSessionLoading || (storeIsLoading && !storeUser && !session?.user);
  
  const isAuthenticated = status === "authenticated" || !!effectiveUser;
  const isUnauthenticated = status === "unauthenticated" && !effectiveUser && !isSessionLoading;

  const isAdmin = effectiveUser
    ? isAdminAuthorized(effectiveUser.role, effectiveUser.department)
    : false;

  const isSuperAdmin = effectiveUser
    ? checkSuperAdmin(effectiveUser.role)
    : false;

  const hasModuleAccess = (moduleName) => {
    if (!effectiveUser) return false;
    return checkModuleAccess(effectiveUser, moduleName);
  };

  /**
   * Deterministic state-aware module access status:
   * - "INITIALIZING_AUTH": NextAuth session is loading or resolving.
   * - "UNAUTHENTICATED": Explicitly not logged in.
   * - "AUTHORIZED": Effective user is Admin or has the canonical/aliased permission.
   * - "CHECKING_PERMISSION": Effective user from JWT lacks permission, but fresh user is still fetching from /api/auth/me.
   * - "UNAUTHORIZED": Auth & store have settled, and user lacks permission.
   */
  const checkModuleAccessStatus = (moduleName) => {
    if (isAuthLoading) return "INITIALIZING_AUTH";
    if (isUnauthenticated) return "UNAUTHENTICATED";
    
    // If effective user is already authorized
    if (effectiveUser && hasModuleAccess(moduleName)) {
      return "AUTHORIZED";
    }

    // If session.user lacks permission, but user store is still initializing from DB
    if (storeIsLoading || (!isInitialized && !storeUser)) {
      return "CHECKING_PERMISSION";
    }

    return "UNAUTHORIZED";
  };

  return {
    user: effectiveUser,
    isLoading: isAuthLoading,
    isAuthLoading,
    isInitialized,
    storeIsLoading,
    isAuthenticated,
    isUnauthenticated,
    isAdmin,
    hasModuleAccess,
    checkModuleAccessStatus,
    isSuperAdmin,
    status,
    session,
  };
}

