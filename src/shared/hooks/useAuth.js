import { useUserStore } from "@/features/user/stores/userStore";
import { isAdminAuthorized } from "@/shared/utils/auth";

export function useAuth() {
  const user = useUserStore((state) => state.user);
  const isLoading = useUserStore((state) => state.isLoading);

  const hasModuleAccess = (moduleName) => {
    if (!user) return false;
    const { accessModules = [] } = user;
    return accessModules.includes(moduleName);
  };

  const isAdmin = user ? isAdminAuthorized(user.role, user.department) : false;

  return {
    user,
    isLoading,
    isAdmin,
    hasModuleAccess,
    isSuperAdmin: user?.role === "superAdmin",
  };
}
