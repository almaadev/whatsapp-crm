"use client";
import { Calendar, Check, Copy, Eye, History, MapPin, MessageSquare,  } from "lucide-react";
import Link from "next/link";
import { useHumanDate } from "@/hooks/useHumanDate";
import { getStatusColor } from "@/utils/colorUtils";

export default function LeadCard({ lead, handleCustomerRedirect, handleCopyPhone, copiedPhone, handleChatSelect }) {
    const formattedDate = useHumanDate(lead.date);

    return (
        <tr className="hover:bg-slate-50/80 transition-colors group cursor-pointer" onClick={() => handleCustomerRedirect(lead.phone)}>
            <td className="px-4 md:px-6 py-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center text-emerald-700 font-bold shadow-inner shrink-0">
                        {lead.name && lead.name !== "Unknown" ? lead.name.charAt(0).toUpperCase() : "#"}
                    </div>
                    <div>
                        <div className="font-bold text-slate-900 line-clamp-1">{lead.name || "Unknown"}</div>
                        <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                            <MapPin size={10} /> {lead.city || "N/A"}
                        </div>
                    </div>
                </div>
            </td>
            <td className="px-4 md:px-6 py-4">
                <div className="flex items-center gap-2 group/phone">
                    <div className="font-mono font-medium text-slate-700">{lead.phone}</div>
                    <button
                        onClick={(e) => handleCopyPhone(e, lead.phone)}
                        className="opacity-0 md:group-hover/phone:opacity-100 transition-opacity text-slate-400 hover:text-emerald-600 p-1"
                        title="Copy Phone"
                    >
                        {copiedPhone === lead.phone ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} className="cursor-pointer" />}
                    </button>
                </div>
            </td>
            <td className="px-6 py-4 text-slate-600 max-w-[200px] truncate hidden md:table-cell">
                {lead.enquiredFor || "-"}
            </td>
            <td className="px-6 py-4 hidden md:table-cell">
                <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border ${getStatusColor(lead.status)}`}>
                        {lead.status}
                    </span>
                    {lead.history?.length > 1 && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-100 text-slate-600 border border-slate-200 flex items-center gap-1" title={`${lead.history.length} Interactions`}>
                            <History size={10} /> {lead.history.length}
                        </span>
                    )}
                </div>
            </td>
            <td className="px-6 py-4 text-xs text-slate-500 font-medium hidden lg:table-cell">
                <div className="flex items-center gap-1.5">
                    <Calendar size={12} className="text-slate-400"/>
                    {formattedDate}
                </div>
            </td>
            <td className="px-4 md:px-6 py-4 text-right">
                <div className="flex items-center justify-end gap-2">
                    <button className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all hidden sm:block" title="View Profile">
                        <Eye size={18} />
                    </button>
                    <Link
                        href="/crm/chat"
                        onClick={(e) => { e.stopPropagation(); handleChatSelect(lead); }}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white p-2 rounded-xl transition-all shadow-sm shadow-emerald-200 active:scale-95 flex items-center justify-center"
                        title="Open Chat"
                    >
                        <MessageSquare size={16} />
                    </Link>
                </div>
            </td>
        </tr>
    );
}