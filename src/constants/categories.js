import { Package, Tent, HeartPulse } from "lucide-react";

export const CATEGORY_SLUGS = ["product", "mdcamp", "therapy"];

export const CATEGORY_CONFIG = {
  
  product: {
    slug: "product",
    chatType: "Product Lead",
    moduleName: "Product Lead",
    socketEvent: "new_product_message",
    leadCategory: "product",
    title: "Product Leads",
    emptyTitle: "Product Leads Inbox",
    emptyFallback: "No product messages yet",
    loadingLabel: "Loading Product Leads...",
    Icon: Package,
    headerIconBg: "bg-blue-600",
    accentText: "text-blue-500",
    themeGradient: "from-blue-500 to-cyan-400",
    themeBadgeClasses: "bg-blue-50 text-blue-800 hover:bg-blue-100",
    themeIconHoverClasses: "hover:text-blue-700 hover:bg-blue-50",
    borderAccent: "border-blue-500",
  },
  mdcamp: {
    slug: "mdcamp",
    chatType: "MD Camp",
    moduleName: "MD Camp",
    socketEvent: "new_mdcamp_message",
    leadCategory: "mdcamp",
    title: "MD Camp Leads",
    emptyTitle: "MD Camp Inbox",
    emptyFallback: "No MD Camp messages yet",
    loadingLabel: "Loading MD Camp Leads...",
    Icon: Tent,
    headerIconBg: "bg-amber-600",
    accentText: "text-amber-500",
    themeGradient: "from-amber-500 to-yellow-400",
    themeBadgeClasses: "bg-amber-50 text-amber-800 hover:bg-amber-100",
    themeIconHoverClasses: "hover:text-amber-700 hover:bg-amber-50",
    borderAccent: "border-amber-500",
  },
  therapy: {
    slug: "therapy",
    chatType: "Therapy",
    moduleName: "Therapy",
    socketEvent: "new_therapy_message",
    leadCategory: "therapy",
    title: "Therapy Leads",
    emptyTitle: "Therapy Inbox",
    emptyFallback: "No therapy messages yet",
    loadingLabel: "Loading Therapy Leads...",
    Icon: HeartPulse,
    headerIconBg: "bg-purple-600",
    accentText: "text-purple-500",
    themeGradient: "from-purple-500 to-fuchsia-400",
    themeBadgeClasses: "bg-purple-50 text-purple-800 hover:bg-purple-100",
    themeIconHoverClasses: "hover:text-purple-700 hover:bg-purple-50",
    borderAccent: "border-purple-500",
  },
};

export function getCategoryConfig(slug) {
  return CATEGORY_CONFIG[slug] ?? null;
}

export function isValidCategorySlug(slug) {
  return CATEGORY_SLUGS.includes(slug);
}
