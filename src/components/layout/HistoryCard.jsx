"use client";
import { Calendar, FileText, Tag, MessageSquare } from "lucide-react";
import { useHumanDate } from "@/hooks/useHumanDate";
import { getStatusColor } from "@/utils/colorUtils";

export default function HistoryCard({ entry }) {
    const formattedDate = useHumanDate(entry.date);
    
    // Check if any follow-up remarks exist for this specific entry
    const hasFollowUpRemarks = entry.day1Remarks || entry.day2Remarks || entry.day3Remarks;
    
    return (
        <div className="relative">
            <div className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md hover:border-emerald-200 transition-all duration-300 group">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-100 group-hover:bg-emerald-50 group-hover:text-emerald-700 group-hover:border-emerald-100 transition-colors">
                            <Calendar size={12} /> {formattedDate}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 border-l border-slate-200">
                          Source: {entry.source || "N/A"}
                        </span>
                    </div>
                    {entry.status && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getStatusColor(entry.status)}`}>
                            {entry.status}
                        </span>
                    )}
                </div>

                <div className="grid gap-3">
                    {/* General Enquiry & Remarks */}
                    <div className="grid gap-2">
                        {entry.enquiredFor && (
                            <div className="flex items-start gap-2.5">
                                <div className="mt-0.5 p-1 bg-slate-50 rounded text-slate-400"><Tag size={10} /></div>
                                <div className="text-sm">
                                    <span className="text-xs font-bold text-slate-400 uppercase pr-2">Enquired For :</span>
                                    <span className="text-slate-700 font-medium">{entry.enquiredFor}</span>
                                </div>
                            </div>
                        )}
                        {entry.remarks && (
                            <div className="flex items-start gap-2.5">
                                <div className="mt-0.5 p-1 bg-slate-50 rounded text-slate-400"><FileText size={10} /></div>
                                <div className="text-sm">
                                    <span className="text-xs font-bold text-slate-400 uppercase pr-2">Overall Remarks :</span>
                                    <span className="text-slate-600 italic">"{entry.remarks}"</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Daily Follow-Up Notes Section */}
                    {hasFollowUpRemarks && (
                        <div className="mt-2 pt-3 border-t border-slate-100/60 border-dashed">
                            <div className="flex items-center gap-1.5 mb-2">
                                <MessageSquare size={12} className="text-emerald-500" />
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Follow-Up Notes</span>
                            </div>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                {entry.day1Remarks && (
                                    <div className="bg-emerald-50/50 rounded-lg p-2.5 border border-emerald-100/50">
                                        <div className="text-[9px] font-bold text-emerald-600 uppercase mb-1">Day 1</div>
                                        <div className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">{entry.day1Remarks}</div>
                                    </div>
                                )}
                                {entry.day2Remarks && (
                                    <div className="bg-emerald-50/50 rounded-lg p-2.5 border border-emerald-100/50">
                                        <div className="text-[9px] font-bold text-emerald-600 uppercase mb-1">Day 2</div>
                                        <div className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">{entry.day2Remarks}</div>
                                    </div>
                                )}
                                {entry.day3Remarks && (
                                    <div className="bg-emerald-50/50 rounded-lg p-2.5 border border-emerald-100/50">
                                        <div className="text-[9px] font-bold text-emerald-600 uppercase mb-1">Day 3</div>
                                        <div className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">{entry.day3Remarks}</div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
                
            </div>
        </div>
    );
}