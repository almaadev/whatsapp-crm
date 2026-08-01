"use client";

import { useState } from "react";
import { Download, FileSpreadsheet, FileText, Loader2, Share2 } from "lucide-react";
import { toast } from "react-toastify";

export default function ExportCenter({ roster = [], loading }) {
  const [exportingCsv, setExportingCsv] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);

  const triggerExport = async (type) => {
    if (roster.length === 0) {
      toast.warning("No records found in current filtered query to export.");
      return;
    }

    if (type === "csv") {
      setExportingCsv(true);
    } else {
      setExportingExcel(true);
    }

    try {
      // Simulate file compiling
      await new Promise((resolve) => setTimeout(resolve, 800));

      const headers = [
        "Associate Name",
        "Role",
        "Department",
        "Branch",
        "Total Customers",
        "Follow Ups",
        "Closed Leads",
        "Revenue Generated",
        "Avg Response Time",
        "Presence Status",
        "Performance Score",
      ];

      const rows = roster.map((item) => [
        `"${item.name}"`,
        `"${item.role}"`,
        `"${item.department}"`,
        `"${item.branch}"`,
        item.customersCount,
        item.followUpsCount,
        item.closedCount,
        item.revenue,
        `"${item.avgResponseText}"`,
        `"${item.presenceStatus}"`,
        `"${item.performanceScore}%"`,
      ]);

      const content = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
      const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `Almaa_Performance_Report_${new Date().toISOString().split("T")[0]}.${
          type === "csv" ? "csv" : "xls"
        }`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success(`${type.toUpperCase()} exported successfully.`);
    } catch (err) {
      console.error(err);
      toast.error(`Failed to compile ${type.toUpperCase()} file.`);
    } finally {
      setExportingCsv(false);
      setExportingExcel(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-[12px] p-4 shadow-sm select-none print:hidden w-full">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h4 className="font-extrabold text-slate-800 text-[13px] leading-tight flex items-center gap-1.5">
            <Share2 size={14} className="text-[#00a884]" /> Operations Export Center
          </h4>
          <p className="text-[10px] text-slate-450 font-bold uppercase tracking-wider mt-0.5">
            Compile performance databases into offline files
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* CSV */}
          <button
            onClick={() => triggerExport("csv")}
            disabled={loading || exportingCsv}
            className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 px-3.5 py-2 rounded-lg text-xs font-bold transition-all border border-slate-200 disabled:opacity-50"
          >
            {exportingCsv ? (
              <Loader2 size={13} className="animate-spin text-[#00a884]" />
            ) : (
              <Download size={13} />
            )}
            Export CSV
          </button>

          {/* Excel */}
          <button
            onClick={() => triggerExport("excel")}
            disabled={loading || exportingExcel}
            className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 px-3.5 py-2 rounded-lg text-xs font-bold transition-all border border-slate-200 disabled:opacity-50"
          >
            {exportingExcel ? (
              <Loader2 size={13} className="animate-spin text-[#00a884]" />
            ) : (
              <FileSpreadsheet size={13} />
            )}
            Export Excel
          </button>

        </div>
      </div>
    </div>
  );
}
