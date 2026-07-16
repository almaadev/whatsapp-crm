import {
  LayoutDashboard,
  MessagesSquare,
  Users,
<<<<<<< HEAD
=======
  Share2,
>>>>>>> 11ffb49e9c4b9bb7d6e6f9c45923b32f6d216d32
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
<<<<<<< HEAD
      "/crm/admin/keyword-automation",
      "/crm/admin/branches",
=======
      "/crm/admin/keyword-automation"
>>>>>>> 11ffb49e9c4b9bb7d6e6f9c45923b32f6d216d32
    ],
    items: [
      { label: "Dashboard", href: "/crm/admin" },
      { label: "Manage Associates", href: "/crm/associate-management" },
<<<<<<< HEAD
      { label: "Manage Branches", href: "/crm/admin/branches", superAdminAndAdminDeptOnly: true },
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
=======
      { label: "Template Manager", href: "/crm/admin/template-manager" },
      { label: "Automatic-reply", href: "/crm/admin/keyword-automation" },
      { label: "Twilio Center", href: "/crm/admin/twilio" },
      { label: "Reports", href: "/crm/admin/reports", icon: FileBarChart, iconSize: 14 }
    ]
>>>>>>> 11ffb49e9c4b9bb7d6e6f9c45923b32f6d216d32
  },
  {
    type: "link",
    label: "My Dashboard",
    icon: LayoutDashboard,
    href: "/crm/associate",
<<<<<<< HEAD
    hideForAdmin: true,
=======
    hideForAdmin: true
>>>>>>> 11ffb49e9c4b9bb7d6e6f9c45923b32f6d216d32
  },
  {
    type: "dropdown",
    label: "Communications",
    icon: MessagesSquare,
    stateKey: "chatDropdownOpen",
<<<<<<< HEAD
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
=======
    paths: [
      "/crm/chat",
      "/crm/product-lead",
      "/crm/md-camp",
      "/crm/therapy"
    ],
    accessRequirements: ["Chat Inbox", "Product Lead", "MD Camp", "Therapy"], 
    items: [
      { label: "Chat Inbox", href: "/crm/chat", moduleName: "Chat Inbox" },
      { label: "Product Lead", href: "/crm/product-lead", moduleName: "Product Lead" },
      { label: "MD Camp", href: "/crm/md-camp", moduleName: "MD Camp" },
      { label: "Therapy", href: "/crm/therapy", moduleName: "Therapy" }
    ]
>>>>>>> 11ffb49e9c4b9bb7d6e6f9c45923b32f6d216d32
  },
  {
    type: "link",
    label: "Bulk Messages",
    icon: Send,
    href: "/crm/bulk-message",
<<<<<<< HEAD
    moduleName: "Bulk Messages",
=======
    moduleName: "Bulk Messages"
>>>>>>> 11ffb49e9c4b9bb7d6e6f9c45923b32f6d216d32
  },
  {
    type: "link",
    label: "Message Logs",
    icon: History,
    href: "/crm/message-logs",
<<<<<<< HEAD
    moduleName: "Messages log",
=======
    moduleName: "logs"
>>>>>>> 11ffb49e9c4b9bb7d6e6f9c45923b32f6d216d32
  },
  {
    type: "link",
    label: "Leads",
    icon: List,
    href: "/crm/leads",
<<<<<<< HEAD
    moduleName: "Leads",
=======
    moduleName: "Leads"
>>>>>>> 11ffb49e9c4b9bb7d6e6f9c45923b32f6d216d32
  },
  {
    type: "link",
    label: "Customers",
    icon: Users,
    href: "/crm/customers",
    moduleName: "Customers",
<<<<<<< HEAD
    matchStartsWith: true,
=======
    matchStartsWith: true
>>>>>>> 11ffb49e9c4b9bb7d6e6f9c45923b32f6d216d32
  },
  // {
  //   type: "link",
  //   label: "Forwarded Leads",
  //   icon: Share2,
  //   href: "/crm/forwarded-leads",
  //   moduleName: "Leads"
  // }
];
