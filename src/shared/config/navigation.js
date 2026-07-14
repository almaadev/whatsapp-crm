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
      "/crm/associate-management",
      "/crm/admin/template-manager",
      "/crm/admin/twilio",
      "/crm/admin/reports",
      "/crm/admin/keyword-automation",
    ],
    items: [
      { label: "Dashboard", href: "/crm/admin" },
      { label: "Manage Associates", href: "/crm/associate-management" },
      { label: "Template Manager", href: "/crm/admin/template-manager" },
      { label: "Automatic Reply", href: "/crm/admin/keyword-automation" },
      { label: "Twilio Center", href: "/crm/admin/twilio" },
      {
        label: "Reports",
        href: "/crm/admin/reports",
        icon: FileBarChart,
        iconSize: 14,
      },
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
    type: "dropdown",
    label: "Communications",
    icon: MessagesSquare,
    stateKey: "chatDropdownOpen",
    paths: ["/crm/chat", "/crm/product-lead", "/crm/md-camp", "/crm/therapy"],
    accessRequirements: ["Chat Inbox", "Product Lead", "MD Camp", "Therapy"],
    items: [
      { label: "Chat Inbox", href: "/crm/chat", moduleName: "Chat Inbox" },
      {
        label: "Product Lead",
        href: "/crm/product-lead",
        moduleName: "Product Lead",
      },
      { label: "MD Camp", href: "/crm/md-camp", moduleName: "MD Camp" },
      { label: "Therapy", href: "/crm/therapy", moduleName: "Therapy" },
    ],
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
