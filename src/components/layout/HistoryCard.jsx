"use client";
import { Calendar, FileText, Tag } from "lucide-react";
import { useHumanDate } from "@/hooks/useHumanDate";
import { getStatusColor } from "@/utils/colorUtils";

export default function HistoryCard({ entry }) {
    const formattedDate = useHumanDate(entry.date);
    
    return (
        <div className="relative">
            <div className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md hover:border-emerald-200 transition-all duration-300 group">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-100 group-hover:bg-emerald-50 group-hover:text-emerald-700 group-hover:border-emerald-100 transition-colors">
                            <Calendar size={12} /> {formattedDate}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2">
                          Source:   {entry.source}
                        </span>
                    </div>
                    {entry.status && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getStatusColor(entry.status)}`}>
                            {entry.status}
                        </span>
                    )}
                </div>

                <div className="grid gap-2">
                    {entry.enquiredFor && (
                        <div className="flex items-start gap-2.5">
                            <div className="mt-0.5 p-1 bg-slate-50 rounded text-slate-400"><Tag size={10} /></div>
                            <div className="text-sm ">
                                <span className="text-xs font-bold text-slate-400 uppercase pr-2">Enquired For :</span>
                                <span className="text-slate-700 font-medium">{entry.enquiredFor}</span>
                            </div>
                        </div>
                    )}
                    {entry.remarks && (
                        <div className="flex items-start gap-2.5">
                            <div className="mt-0.5 p-1 bg-slate-50 rounded text-slate-400"><FileText size={10} /></div>
                            <div className="text-sm">
                                <span className="text-xs font-bold text-slate-400 uppercase pr-2">Remarks :</span>
                                <span className="text-slate-600 italic">"{entry.remarks}"</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}