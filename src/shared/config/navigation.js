import {
  LayoutDashboard,
  MessagesSquare,
  Users,
  List,
  Send,
  History,
  FileBarChart,
} from "lucide-react";

export const NAVIGATION_CONFIG = [
  {
    type: "dropdown",
    label: "Admin Overview",
    icon: LayoutDashboard,
    adminOnly: true,
    stateKey: "adminDropdownOpen",
    paths: [
      "/crm/admin",
      "/crm/admin/performance-monitor",
      "/crm/admin/reports",
      "/crm/admin/associate-management",
      "/crm/admin/template-manager",
      "/crm/admin/twilio",
      "/crm/admin/keyword-automation",
      "/crm/admin/branches",
      "/crm/admin/twillio-numbers"
    ],
    items: [
      { label: "Dashboard", href: "/crm/admin" },
      { label: "Reports & Export", href: "/crm/admin/reports" },
      { label: "Manage Associates", href: "/crm/admin/associate-management" },
      { label: "Manage Branches", href: "/crm/admin/branches", superAdminAndAdminDeptOnly: true },
      { label: "Template Manager", href: "/crm/admin/template-manager" },
      { label: "Automatic Reply", href: "/crm/admin/keyword-automation" },
      { label: "Twilio Center", href: "/crm/admin/twilio" },
      { label: "Twilio Numbers", href: "/crm/admin/twillio-numbers" },
    ],
  },
  {
    type: "link",
    label: "My Dashboard",
    icon: LayoutDashboard,
    href: "/crm/associate",
    hideForAdmin: true,
  },
  {
    type: "link",
    label: "Chat Inbox",
    icon: MessagesSquare,
    href: "/crm/chat",
    moduleName: "Chat Inbox",
    matchStartsWith: true,
  },
  {
    type: "link",
    label: "Bulk Messages",
    icon: Send,
    href: "/crm/bulk-message",
    moduleName: "Bulk Messages",
  },
  {
    type: "link",
    label: "Message Logs",
    icon: History,
    href: "/crm/message-logs",
    moduleName: "Messages log",
  },
  {
    type: "link",
    label: "Leads",
    icon: List,
    href: "/crm/leads",
    moduleName: "Leads",
  },
  {
    type: "link",
    label: "Customers",
    icon: Users,
    href: "/crm/customers",
    moduleName: "Customers",
    matchStartsWith: true,
  },
  // {
  //   type: "link",
  //   label: "Forwarded Leads",
  //   icon: Share2,
  //   href: "/crm/forwarded-leads",
  //   moduleName: "Leads"
  // }
];
