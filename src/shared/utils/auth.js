export function isAdminAuthorized(role, department = "") {
  return (
    role === "superAdmin" ||
    (role === "sales" && department === "admin") ||
    (role === "doctor" && department === "admin")
  );
}

export function hasModuleAccess(session, moduleName) {
  if (!session?.user) return false;
  const { role, department, accessModules = [] } = session.user;
  if (isAdminAuthorized(role, department)) return true;
  return accessModules.includes(moduleName);
}

export function isSuperAdmin(role) {
  return role === "superAdmin";
}
