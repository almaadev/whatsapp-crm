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

export function checkPermissions(userOrSession, config) {
  if (!userOrSession) return false;
  const user = userOrSession.user ? userOrSession.user : userOrSession;
  
  if (!user) return false;
  const { role, department, accessModules = [] } = user;
  const isAdmin = isAdminAuthorized(role, department);

  // Strict check for superAdmin role AND admin department
  if (config.superAdminAndAdminDeptOnly && (role !== "superAdmin" || department !== "admin")) {
    return false;
  }

  // 1. Role verification
  if (config.adminOnly && !isAdmin) return false;
  if (config.hideForAdmin && isAdmin) return false;

  // Admins automatically have access to all modules and requirements
  if (isAdmin) return true;

  // 2. Module verification
  if (config.moduleName && !accessModules.includes(config.moduleName)) {
    return false;
  }

  // 3. Access Requirements (any of the listed modules)
  if (config.accessRequirements) {
    const hasAny = config.accessRequirements.some((req) =>
      accessModules.includes(req)
    );
    if (!hasAny) return false;
  }

  return true;
}

const ROUTE_RULES = [
  { path: "/branches", superAdminAndAdminDeptOnly: true },
  { path: "/crm/admin", adminOnly: true },
  { path: "/crm/admin/associate-management", adminOnly: true },
  { path: "/crm/associate", hideForAdmin: true },
  { path: "/crm/chat/new-customer", moduleName: "Chat Inbox" },
  { path: "/crm/chat", moduleName: "Chat Inbox" },
  { path: "/crm/templates", moduleName: "Chat Inbox" },
  { path: "/crm/bulk-message", moduleName: "Bulk Messages" },
  { path: "/crm/message-logs", moduleName: "Messages log" },
  { path: "/crm/leads", moduleName: "Leads" },
  { path: "/crm/customers", moduleName: "Customers" },
  { path: "/crm/forwarded-leads", moduleName: "Leads" },
];

export function getRouteRule(pathname) {
  const sortedRules = [...ROUTE_RULES].sort((a, b) => b.path.length - a.path.length);
  return sortedRules.find(
    (rule) => pathname === rule.path || pathname.startsWith(rule.path + "/")
  );
}

export function isRouteAuthorized(session, pathname) {
  const rule = getRouteRule(pathname);
  if (!rule) return true; // Default allow if no rule matches
  return checkPermissions(session, rule);
}

const API_RULES = [ 
  { prefix: "/api/admin/twilio", accessRequirements: ["Chat Inbox", "Bulk Messages"] },
  { prefix: "/api/admin", adminOnly: true },
  { prefix: "/api/users", adminOnly: true },
  { prefix: "/api/associate", hideForAdmin: true },
  { prefix: "/api/bulk-message", moduleName: "Bulk Messages" },
  { prefix: "/api/message-logs", moduleName: "Messages log" },
  { prefix: "/api/leads", moduleName: "Leads" },
  { prefix: "/api/forward-lead", moduleName: "Leads" },
  { prefix: "/api/customers", moduleName: "Customers" },
  { prefix: "/api/chats", moduleName: "Chat Inbox" },
  { prefix: "/api/send-template", moduleName: "Chat Inbox" },
  { prefix: "/api/crm-templates", moduleName: "Chat Inbox" },
  { prefix: "/api/keyword-automation", adminOnly: true },
  { prefix: "/api/templates", moduleName: "Chat Inbox" },
  { prefix: "/api/branches", accessRequirements: ["Chat Inbox", "Customers", "Leads"] },
];

export function getAPIRule(pathname) {
  const sortedRules = [...API_RULES].sort((a, b) => b.prefix.length - a.prefix.length);
  return sortedRules.find(
    (rule) => pathname === rule.prefix || pathname.startsWith(rule.prefix + "/")
  );
}

export function isAPIAuthorized(session, pathname) {
  const rule = getAPIRule(pathname);
  if (!rule) return true; // Default allow if no rule exists
  return checkPermissions(session, rule);
}

