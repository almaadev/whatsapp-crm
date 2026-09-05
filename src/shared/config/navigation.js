import {
  Gauge,
  MessagesSquare,
  Users,
  List,
  Send,
  History,
  LibraryBig,
  IdCardLanyard,
  Blocks,
  CardSim
} from "lucide-react";

export const NAVIGATION_CONFIG = [
  {
    id: "dashboard",
    type: "dropdown",
    label: "Dashboard",
    icon: Gauge,
    adminOnly: true,
    stateKey: "dashboard",
    paths: [
      "/crm/admin/dashboard/overview",
      "/crm/admin/dashboard/performance-monitor",
      "/crm/admin/dashboard/reports",
    ],
    items: [
      { label: "Overview", href: "/crm/admin/dashboard/overview" },
      { label: "Performance Monitor", href: "/crm/admin/dashboard/performance-monitor" },
      { label: "Reports & Export", href: "/crm/admin/dashboard/reports" },
    ],
  },
  {
    id: "associate-branch",
    type: "dropdown",
    label: "Associate and Branch",
    icon: IdCardLanyard,
    adminOnly: true,
    stateKey: "associate-branch",
    paths: [
      "/crm/admin/associate&branch/associate-management",
      "/crm/admin/whatsapp-number-assignment",
      "/crm/admin/associate&branch/associate-logs",
      "/crm/admin/associate&branch/branches",
    ],
    items: [
      { label: "Manage Associates", href: "/crm/admin/associate&branch/associate-management" },
      { label: "WhatsApp Number Assignment", href: "/crm/admin/whatsapp-number-assignment" },
      { label: "Associate Logs", href: "/crm/admin/associate&branch/associate-logs" },
      { label: "Manage Branches", href: "/crm/admin/associate&branch/branches", superAdminAndAdminDeptOnly: true },
    ],
  },
  {
    id: "automation-templates",
    type: "dropdown",
    label: "Automation & Templates",
    icon: Blocks,
    adminOnly: true,
    stateKey: "automation-templates",
    paths: [
      "/crm/admin/automation&templates/crm-templates",
      "/crm/admin/automation&templates/whatsapp-templates",
      "/crm/admin/keyword-automation",
    ],
    items: [
      { label: "CRM Templates", href: "/crm/admin/automation&templates/crm-templates" },
      { label: "WhatsApp Templates", href: "/crm/admin/automation&templates/whatsapp-templates" },
      { label: "Keyword Automation", href: "/crm/admin/automation&templates/keyword-automation" },
    ],
  },
  {
    id: "Media Management",
    type: "dropdown",
    label: "Media Management",
    icon: LibraryBig,
    adminOnly: true,
    stateKey: "media-management",
    paths: [
      "/crm/admin/media-management",
    ],
    items: [
      { label: "Media Management", href: "/crm/admin/media-management" },
    ],
  },
  {
    id: "twilio",
    type: "dropdown",
    label: "Twilio Control",
    icon: CardSim,
    adminOnly: true,
    stateKey: "twilio",
    paths: [
      "/crm/admin/twillio-control/twillio-center",
      "/crm/admin/twillio-control/twillio-numbers",
    ],
    items: [
      { label: "Twilio Center", href: "/crm/admin/twillio-control/twillio-center" },
      { label: "Twilio Numbers", href: "/crm/admin/twillio-control/twillio-numbers" },
    ],
  },
  {
    type: "link",
    label: "My Dashboard",
    icon: Gauge,
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
    hideForAdmin: true,
  },
  {
    type: "link",
    label: "Message Logs",
    icon: History,
    href: "/crm/message-logs",
    moduleName: "Messages log",
    hideForAdmin: true,
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
