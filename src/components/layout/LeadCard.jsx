import { Calendar, Check, Copy, Eye, History, MapPin, MessageSquare, Phone, Tag } from "lucide-react";
import Link from "next/link";
import { useHumanDate } from "@/hooks/useHumanDate";
import { getStatusColor } from "@/utils/colorUtils";

export default function LeadCard({ lead, handleCustomerRedirect, handleCopyPhone, copiedPhone, handleChatSelect }) {

    const formattedDate = useHumanDate(lead.date);

    return (
        <div className="group bg-white p-5 rounded-2xl border border-slate-200 hover:border-emerald-400 hover:shadow-xl  transition-all duration-300 relative flex flex-col h-full">

            {/* Header: Link to Detail Page */}
            <div className="flex justify-between items-start mb-4">
                <div className="block flex-1 min-w-0 cursor-pointer" onClick={() => handleCustomerRedirect(lead.phone)} >
                    <div>
                        <h4 className="font-bold text-slate-800 text-base line-clamp-1 hover:text-emerald-600 transition-colors" title={lead.name}>{lead.name || "Unknown"}</h4>
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                            <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase border ${getStatusColor(lead.status)}`}>{lead.status}</span>
                            {lead.history?.length > 1 && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-100 text-slate-600 border border-slate-200 flex items-center gap-1">
                                    <History size={10} /> {lead.history.length}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                <Link
                    href={`/dashboard/leads/${lead.phone?.replace(/\D/g, '')}`}
                    className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors bg-slate-50"
                    title="View Full Profile"
                >
                    <Eye size={18} />
                </Link>
            </div>

            {/* Body: Link to Detail Page */}
            <div onClick={() => handleCustomerRedirect(lead.phone)} className="space-y-3 mb-4 flex-1 block cursor-pointer">
                <div className="flex items-center justify-between text-xs text-slate-600 group/phone">
                    <div className="flex items-center gap-2">
                        <Phone size={14} className="text-slate-400 shrink-0" />
                        <span className="font-medium tracking-wide">{lead.phone}</span>
                    </div>
                    <button
                        onClick={(e) => handleCopyPhone(e, lead.phone)}
                        className="opacity-0 group-hover/phone:opacity-100 transition-opacity text-slate-400 hover:text-emerald-600 p-1"
                        title="Copy Phone"
                    >
                        {copiedPhone === lead.phone ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} className="cursor-pointer" />}
                    </button>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-600">
                    <MapPin size={14} className="text-slate-400 shrink-0" />
                    <span className="truncate">{lead.city || "N/A"}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-600">
                    <Tag size={14} className="text-slate-400 shrink-0" />
                    <span className="truncate" title={lead.enquiredFor}>{lead.enquiredFor || "General Inquiry"}</span>
                </div>
            </div>

            {/* Footer: Date & Chat Action */}
            <div className="pt-4 border-t border-slate-50 flex items-center justify-between mt-auto">
                <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5"><Calendar size={12} /> {formattedDate}</span>
                <Link
                    href="/dashboard/chat"
                    onClick={(e) => { e.stopPropagation(); handleChatSelect(lead); }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white p-2.5 rounded-xl transition-all shadow-sm shadow-emerald-200 active:scale-95"
                    title="Open Chat"
                >
                    <MessageSquare size={16} />
                </Link>
            </div>
        </div>
    );
}