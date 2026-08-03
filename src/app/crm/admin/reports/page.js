"use client";

import { useState, useEffect, useMemo, useCallback, Fragment } from "react";
import { useSession } from "next-auth/react";
import { useAuth } from "@/shared/hooks/useAuth";
import DashboardPage from "@/shared/components/layout/DashboardPage";
import LoadingScreen from "@/shared/components/ui/LoadingScreen";
import AccessDenied from "@/shared/components/ui/AccessDenied";
import DashboardTabs from "@/shared/components/ui/DashboardTabs";
import Pagination from "@/shared/components/ui/Pagination";
import { branchService } from "@/features/branches/services/branchService";
import { userRepository } from "@/shared/api/repositories/userRepository";
import { toast } from "react-toastify";
import Link from "next/link";
import {
  Search,
  RefreshCw,
  Download,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  FileText
} from "lucide-react";

export default function ReportsPage() {
  const { data: session, status } = useSession();
  const { user, isLoading, isAdmin, isSuperAdmin: isSuperAdminUser } = useAuth();
  const isAuthorized = isAdmin;

  // 1. Tab State: "customer" | "associate"
  const [activeTab, setActiveTab] = useState("customer");

  // 2. "Include Me" Filter State (OFF by default)
  const [includeMe, setIncludeMe] = useState(false);

  // 3. Operational Filters State (Clean variables)
  const [customerReportFilters, setCustomerReportFilters] = useState({
    dateRange: "thisMonth",
    startDate: "",
    endDate: "",
    branchId: "all",
    department: "all",
    role: "all",
    associateId: "all",
    search: ""
  });

  const [associateReportFilters, setAssociateReportFilters] = useState({
    dateRange: "thisMonth",
    startDate: "",
    endDate: "",
    branchId: "all",
    department: "all",
    role: "all",
    associateId: "all",
    search: ""
  });

  // 4. Data Rows State (Clean variables)
  const [customerReportRows, setCustomerReportRows] = useState([]);
  const [associatePerformanceSummary, setAssociatePerformanceSummary] = useState([]);

  // 5. Customer Pagination, Sorting & Expand States
  const [customerPage, setCustomerPage] = useState(1);
  const [customerLimit, setCustomerLimit] = useState("25");
  const [customerSortBy, setCustomerSortBy] = useState("date");
  const [customerSortOrder, setCustomerSortOrder] = useState("desc");
  const [customerPagination, setCustomerPagination] = useState({ total: 0, page: 1, limit: 25, pages: 1 });
  const [expandedCustomerId, setExpandedCustomerId] = useState(null);

  // 6. Associate Pagination, Sorting & Expand States
  const [associatePage, setAssociatePage] = useState(1);
  const [associateLimit, setAssociateLimit] = useState("25");
  const [associateSortBy, setAssociateSortBy] = useState("associateName");
  const [associateSortOrder, setAssociateSortOrder] = useState("asc");
  const [associatePagination, setAssociatePagination] = useState({ total: 0, page: 1, limit: 25, pages: 1 });
  const [expandedAssociateId, setExpandedAssociateId] = useState(null);

  // 7. DB Options Lists
  const [availableBranches, setAvailableBranches] = useState([]);
  const [allAssociatesList, setAllAssociatesList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Force Admin to their assigned branch
  useEffect(() => {
    if (user && !isSuperAdminUser && user.branch) {
      const userBranchId = user.branch.toString();
      setCustomerReportFilters(prev => ({ ...prev, branchId: userBranchId }));
      setAssociateReportFilters(prev => ({ ...prev, branchId: userBranchId }));
    }
  }, [user, isSuperAdminUser]);

  // Load branches & users list
  useEffect(() => {
    async function loadConfig() {
      try {
        const branchRes = await branchService.getBranches({ limit: 1000 });
        if (branchRes.success) {
          setAvailableBranches(branchRes.branches || []);
        }
        const userRes = await userRepository.getUsers();
        if (userRes && userRes.data) {
          setAllAssociatesList(userRes.data || []);
        }
      } catch (err) {
        console.error("Failed to load setup filters:", err);
      }
    }
    if (isAuthorized) {
      loadConfig();
    }
  }, [isAuthorized]);

  // Real-time branch filtering of associate dropdown option list
  const filteredAssociatesDropdown = useMemo(() => {
    if (!Array.isArray(allAssociatesList)) return [];
    const activeFilters = activeTab === "customer" ? customerReportFilters : associateReportFilters;
    
    // Get logged-in user ID
    const loggedInUserId = user?._id?.toString() || user?.id?.toString() || session?.user?.id?.toString();

    return allAssociatesList.filter((assoc) => {
      // Exclude the current logged-in user if Include Me is OFF (only applies when Include Me is available on Associate tab)
      if (activeTab === "associate" && !includeMe && loggedInUserId && (assoc.id?.toString() === loggedInUserId || assoc._id?.toString() === loggedInUserId)) {
        return false;
      }

      if (activeFilters.branchId !== "all") {
        const matchedBranch = availableBranches.find(b => b._id === activeFilters.branchId);
        const branchName = matchedBranch ? matchedBranch.name : activeFilters.branchId;
        if (assoc.branch !== branchName && assoc.branch !== activeFilters.branchId) return false;
      }
      return true;
    });
  }, [allAssociatesList, customerReportFilters, associateReportFilters, activeTab, availableBranches, user, session, includeMe]);

  // Fetch Customer Report Rows
  const fetchCustomerReportRows = useCallback(async () => {
    if (!isAuthorized) return;
    setLoading(true);
    try {
      const { dateRange, startDate, endDate, branchId, department, role, associateId, search } = customerReportFilters;
      let query = `action=customerReport&page=${customerPage}&limit=${customerLimit}&dateRange=${dateRange}&branchId=${branchId}&department=${department}&role=${role}&associateId=${associateId}&search=${search}&sortBy=${customerSortBy}&sortOrder=${customerSortOrder}`;
      if (dateRange === "custom") {
        if (startDate) query += `&startDate=${startDate}`;
        if (endDate) query += `&endDate=${endDate}`;
      }
      const res = await fetch(`/api/admin/reports?${query}`);
      const payload = await res.json();
      if (payload.success) {
        setCustomerReportRows(payload.customerReportRows || []);
        setCustomerPagination(payload.pagination || { total: 0, page: 1, limit: 25, pages: 1 });
      } else {
        toast.error(payload.error || "Failed to fetch customer ledger.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load customer records.");
    } finally {
      setLoading(false);
    }
  }, [isAuthorized, customerPage, customerLimit, customerSortBy, customerSortOrder, customerReportFilters]);

  // Fetch Associate Performance Summary
  const fetchAssociatePerformanceSummary = useCallback(async () => {
    if (!isAuthorized) return;
    setLoading(true);
    try {
      const { dateRange, startDate, endDate, branchId, department, role, associateId, search } = associateReportFilters;
      let query = `action=associateReport&page=${associatePage}&limit=${associateLimit}&dateRange=${dateRange}&branchId=${branchId}&department=${department}&role=${role}&associateId=${associateId}&search=${search}&sortBy=${associateSortBy}&sortOrder=${associateSortOrder}&includeMe=${includeMe}`;
      if (dateRange === "custom") {
        if (startDate) query += `&startDate=${startDate}`;
        if (endDate) query += `&endDate=${endDate}`;
      }
      const res = await fetch(`/api/admin/reports?${query}`);
      const payload = await res.json();
      if (payload.success) {
        setAssociatePerformanceSummary(payload.associatePerformanceSummary || []);
        setAssociatePagination(payload.pagination || { total: 0, page: 1, limit: 25, pages: 1 });
      } else {
        toast.error(payload.error || "Failed to fetch associate performance summaries.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load associate summaries.");
    } finally {
      setLoading(false);
    }
  }, [isAuthorized, associatePage, associateLimit, associateSortBy, associateSortOrder, associateReportFilters, includeMe]);

  // Load active tab data on filter/page/sort change
  useEffect(() => {
    if (activeTab === "customer") {
      fetchCustomerReportRows();
    } else {
      fetchAssociatePerformanceSummary();
    }
  }, [activeTab, fetchCustomerReportRows, fetchAssociatePerformanceSummary]);

  const handleCustomerSort = (columnKey) => {
    if (customerSortBy === columnKey) {
      setCustomerSortOrder(customerSortOrder === "asc" ? "desc" : "asc");
    } else {
      setCustomerSortBy(columnKey);
      setCustomerSortOrder("desc");
    }
    setCustomerPage(1);
  };

  const handleAssociateSort = (columnKey) => {
    if (associateSortBy === columnKey) {
      setAssociateSortOrder(associateSortOrder === "asc" ? "desc" : "asc");
    } else {
      setAssociateSortBy(columnKey);
      setAssociateSortOrder("asc");
    }
    setAssociatePage(1);
  };

  const handleResetFilters = () => {
    const defaultBranch = isSuperAdminUser ? "all" : (user?.branch?.toString() || "all");
    const defaultFilters = {
      dateRange: "thisMonth",
      startDate: "",
      endDate: "",
      branchId: defaultBranch,
      department: "all",
      role: "all",
      associateId: "all",
      search: ""
    };
    if (activeTab === "customer") {
      setCustomerReportFilters(defaultFilters);
      setCustomerSortBy("date");
      setCustomerSortOrder("desc");
      setCustomerPage(1);
    } else {
      setAssociateReportFilters(defaultFilters);
      setAssociateSortBy("associateName");
      setAssociateSortOrder("asc");
      setAssociatePage(1);
    }
    setIncludeMe(false);
    toast.success("Filters reset to default.");
  };

  // Helper function to trigger client download
  const downloadFile = (content, fileName, mimeType) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper function to build clean Excel HTML template
  const generateExcelHTML = (title, headers, rowsHTML) => {
    return `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="utf-8"/><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Sheet1</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head>
      <body>
        <h2>${title}</h2>
        <table border="1">
          <thead>
            <tr style="background-color: #0f172a; color: white; font-weight: bold;">
              ${headers.map(h => `<th>${h}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${rowsHTML.join("")}
          </tbody>
        </table>
      </body>
      </html>
    `;
  };

  // Combined cleaner report exporter service
  const reportExportService = async (reportType, exportMode, formatType) => {
    try {
      toast.info(`Preparing ${reportType} report export...`);
      const isCustomer = reportType === "customer";
      const filters = isCustomer ? customerReportFilters : associateReportFilters;
      const { dateRange, startDate, endDate, branchId, department, role, associateId, search } = filters;

      let query = "";
      if (exportMode === "all") {
        const targetBranch = isSuperAdminUser ? "all" : (user?.branch?.toString() || "all");
        query = `action=${reportType}Report&page=1&limit=all&dateRange=all&branchId=${targetBranch}&department=all&role=all&associateId=all&search=`;
      } else {
        const pageValue = isCustomer ? customerPage : associatePage;
        const limitValue = isCustomer ? customerLimit : associateLimit;
        const sortBy = isCustomer ? customerSortBy : associateSortBy;
        const sortOrder = isCustomer ? customerSortOrder : associateSortOrder;
        
        query = `action=${reportType}Report&page=${pageValue}&limit=all&dateRange=${dateRange}&branchId=${branchId}&department=${department}&role=${role}&associateId=${associateId}&search=${search}&sortBy=${sortBy}&sortOrder=${sortOrder}`;
        if (dateRange === "custom") {
          if (startDate) query += `&startDate=${startDate}`;
          if (endDate) query += `&endDate=${endDate}`;
        }
      }

      if (reportType === "associate" && includeMe) {
        query += `&includeMe=true`;
      }

      const res = await fetch(`/api/admin/reports?${query}`);
      const payload = await res.json();
      if (!payload.success) {
        toast.error(payload.error || "Failed to download report.");
        return;
      }

      const data = isCustomer ? payload.customerReportRows : payload.associatePerformanceSummary;
      if (!data || data.length === 0) {
        toast.warning("No records found to export.");
        return;
      }

      let assocSuffix = "";
      if (associateId !== "all") {
        const selectedAssoc = allAssociatesList.find(a => (a.id === associateId || a._id === associateId));
        if (selectedAssoc && selectedAssoc.name) {
          const sanitized = selectedAssoc.name
            .toLowerCase()
            .replace(/\s+/g, "-")
            .replace(/[^a-z0-9-_]/g, "");
          if (sanitized) {
            assocSuffix = `-${sanitized}`;
          }
        }
      }

      const dateStr = new Date().toISOString().split("T")[0];
      const filename = `${reportType}-report${assocSuffix}-${dateStr}`;

      if (isCustomer) {
        const headers = [
          "Customer Name", "Phone Number", "First Enquiry Date", "Enquired For",
          "City", "Assigned Branch", "Handled By Associates", "Current Lead Status",
          "Current Lead Owner", "Latest Remark", "Last Follow Up Date"
        ];
        const rows = data.map(row => [
          `"${row.customerName}"`,
          `"${row.phone}"`,
          `"${row.firstEnquiryDate}"`,
          `"${row.enquiredFor}"`,
          `"${row.city}"`,
          `"${row.assignedBranch}"`,
          `"${row.handledByAssociates}"`,
          `"${row.currentLeadStatus}"`,
          `"${row.currentLeadOwner}"`,
          `"${(row.latestRemark || "-").replace(/"/g, '""').replace(/\n/g, ' ')}"`,
          `"${row.lastFollowUpDate}"`
        ]);

        if (formatType === "csv") {
          const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
          downloadFile(csvContent, `${filename}.csv`, "text/csv;charset=utf-8;");
        } else {
          const rowsHTML = data.map(row => `
            <tr>
              <td>${row.customerName}</td>
              <td>${row.phone}</td>
              <td>${row.firstEnquiryDate}</td>
              <td>${row.enquiredFor}</td>
              <td>${row.city}</td>
              <td>${row.assignedBranch}</td>
              <td>${row.handledByAssociates}</td>
              <td>${row.currentLeadStatus}</td>
              <td>${row.currentLeadOwner}</td>
              <td>${row.latestRemark}</td>
              <td>${row.lastFollowUpDate}</td>
            </tr>
          `);
          const excelContent = generateExcelHTML("Customer Report", headers, rowsHTML);
          downloadFile(excelContent, `${filename}.xls`, "application/vnd.ms-excel;charset=utf-8;");
        }
      } else {
        const headers = [
          "Date & Time", "Associate Name", "Employee ID", "Branch", "Role", "Department",
          "Customer Name", "Phone", "Action / Status", "Lead Status", "Remark"
        ];
        const rows = [];
        data.forEach(assoc => {
          const history = assoc.associateCustomerHistory || [];
          history.forEach(inter => {
            rows.push([
              `"${inter.date ? new Date(inter.date).toLocaleString() : "-"}"`,
              `"${assoc.associateName}"`,
              `"${assoc.employeeId}"`,
              `"${assoc.branch}"`,
              `"${assoc.role}"`,
              `"${assoc.department}"`,
              `"${inter.customerName}"`,
              `"${inter.phone}"`,
              `"${inter.leadStatus}"`, // Action
              `"${inter.leadStatus}"`, // Lead Status
              `"${(inter.remark || "-").replace(/"/g, '""').replace(/\n/g, ' ')}"` // Remark
            ]);
          });
        });

        if (formatType === "csv") {
          const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
          downloadFile(csvContent, `${filename}.csv`, "text/csv;charset=utf-8;");
        } else {
          const rowsHTML = [];
          data.forEach(assoc => {
            const history = assoc.associateCustomerHistory || [];
            history.forEach(inter => {
              rowsHTML.push(`
                <tr>
                  <td>${inter.date ? new Date(inter.date).toLocaleString() : "-"}</td>
                  <td>${assoc.associateName}</td>
                  <td>${assoc.employeeId}</td>
                  <td>${assoc.branch}</td>
                  <td>${assoc.role}</td>
                  <td>${assoc.department}</td>
                  <td>${inter.customerName}</td>
                  <td>${inter.phone}</td>
                  <td>${inter.leadStatus}</td>
                  <td>${inter.leadStatus}</td>
                  <td>${inter.remark}</td>
                </tr>
              `);
            });
          });
          const excelContent = generateExcelHTML("Associate Report", headers, rowsHTML);
          downloadFile(excelContent, `${filename}.xls`, "application/vnd.ms-excel;charset=utf-8;");
        }
      }
      toast.success("File downloaded successfully.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate spreadsheet.");
    }
  };

  if (isLoading || status === "loading") return <LoadingScreen />;
  if (!isAuthorized) return <AccessDenied />;

  const activeFilters = activeTab === "customer" ? customerReportFilters : associateReportFilters;
  const setActiveFilters = activeTab === "customer" ? setCustomerReportFilters : setAssociateReportFilters;
  const isFilteredExport = activeFilters.associateId !== "all";

  return (
    <DashboardPage
      title="Reports & Analytics"
      subtitle="Operational insights, performance audits and record exports"
    >
      <DashboardTabs activeTab="reports" />

      {/* HORIZONTAL COMPACT FILTER BAR */}
      <div className="max-w-[1800px] mx-auto px-6 pt-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow-md flex flex-col gap-3">
          
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Top Tabs inside filter bar block */}
            <div className="flex bg-slate-800/80 p-1 rounded-lg border border-slate-700 max-w-sm">
              <button
                onClick={() => setActiveTab("customer")}
                className={`py-1.5 px-4 font-bold text-xs uppercase tracking-wider rounded-md cursor-pointer transition-all ${
                  activeTab === "customer"
                    ? "bg-[#00a884] text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Customer Report
              </button>
              <button
                onClick={() => setActiveTab("associate")}
                className={`py-1.5 px-4 font-bold text-xs uppercase tracking-wider rounded-md cursor-pointer transition-all ${
                  activeTab === "associate"
                    ? "bg-[#00a884] text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Associate Report
              </button>
            </div>

            {/* General Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-300 font-bold text-xs rounded-lg transition-all cursor-pointer"
              >
                <RefreshCw size={12} /> Reset
              </button>

              <div className="h-6 w-px bg-slate-800 mx-1"></div>

              {/* Exports */}
              {isFilteredExport ? (
                <>
                  <button
                    onClick={() => reportExportService(activeTab, "filter", "csv")}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#00a884] hover:bg-[#008f70] text-white font-bold text-xs rounded-lg transition-all shadow-sm cursor-pointer"
                  >
                    <Download size={12} /> Filtered (CSV)
                  </button>
                  <button
                    onClick={() => reportExportService(activeTab, "filter", "excel")}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-200 font-bold text-xs rounded-lg transition-all shadow-sm cursor-pointer"
                  >
                    <Download size={12} /> Filtered (Excel)
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => reportExportService(activeTab, "all", "csv")}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-200 font-black text-xs rounded-lg transition-all shadow-sm cursor-pointer"
                  >
                    Export All (CSV)
                  </button>
                  <button
                    onClick={() => reportExportService(activeTab, "all", "excel")}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-200 font-black text-xs rounded-lg transition-all shadow-sm cursor-pointer"
                  >
                    Export All (Excel)
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3.5 pt-2 border-t border-slate-800">
            {/* Date Selector */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Date Preset</span>
              <select
                value={activeFilters.dateRange}
                onChange={(e) => {
                  setActiveFilters(prev => ({ ...prev, dateRange: e.target.value }));
                  if (activeTab === "customer") setCustomerPage(1); else setAssociatePage(1);
                }}
                className="bg-slate-800 border border-slate-700 rounded-lg py-1.5 px-2.5 text-xs font-semibold text-slate-200 outline-none cursor-pointer focus:border-[#00a884]"
              >
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="thisWeek">This Week</option>
                <option value="thisMonth">This Month</option>
                <option value="lastMonth">Last Month</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>

            {/* Branch Selector (Super Admin only) */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Branch</span>
              <select
                value={activeFilters.branchId}
                disabled={!isSuperAdminUser}
                onChange={(e) => {
                  setActiveFilters(prev => ({ ...prev, branchId: e.target.value, associateId: "all" }));
                  if (activeTab === "customer") setCustomerPage(1); else setAssociatePage(1);
                }}
                className="bg-slate-800 border border-slate-700 rounded-lg py-1.5 px-2.5 text-xs font-semibold text-slate-200 outline-none cursor-pointer disabled:bg-slate-850 disabled:text-slate-500 focus:border-[#00a884]"
              >
                {isSuperAdminUser && <option value="all">All Branches</option>}
                {availableBranches.map((b) => (
                  <option key={b._id} value={b._id}>{b.name}</option>
                ))}
              </select>
            </div>

            {/* Department Selector */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Department</span>
              <select
                value={activeFilters.department}
                onChange={(e) => {
                  setActiveFilters(prev => ({ ...prev, department: e.target.value, associateId: "all" }));
                  if (activeTab === "customer") setCustomerPage(1); else setAssociatePage(1);
                }}
                className="bg-slate-800 border border-slate-700 rounded-lg py-1.5 px-2.5 text-xs font-semibold text-slate-200 outline-none cursor-pointer focus:border-[#00a884]"
              >
                <option value="all">All Departments</option>
                <option value="telecalling">Telecalling</option>
                <option value="support">Support</option>
                {isSuperAdminUser && <option value="admin">Admin</option>}
              </select>
            </div>

            {/* Role Selector */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Role</span>
              <select
                value={activeFilters.role}
                onChange={(e) => {
                  setActiveFilters(prev => ({ ...prev, role: e.target.value, associateId: "all" }));
                  if (activeTab === "customer") setCustomerPage(1); else setAssociatePage(1);
                }}
                className="bg-slate-800 border border-slate-700 rounded-lg py-1.5 px-2.5 text-xs font-semibold text-slate-200 outline-none cursor-pointer focus:border-[#00a884]"
              >
                <option value="all">All Roles</option>
                <option value="doctor">Doctor</option>
                {isSuperAdminUser && (
                  <>
                    <option value="sales">Sales</option>
                    <option value="superAdmin">SuperAdmin</option>
                  </>
                )}
              </select>
            </div>

            {/* Associate Dropdown */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Associate</span>
              <select
                value={activeFilters.associateId}
                onChange={(e) => {
                  setActiveFilters(prev => ({ ...prev, associateId: e.target.value }));
                  if (activeTab === "customer") setCustomerPage(1); else setAssociatePage(1);
                }}
                className="bg-slate-800 border border-slate-700 rounded-lg py-1.5 px-2.5 text-xs font-semibold text-slate-200 outline-none cursor-pointer focus:border-[#00a884]"
              >
                <option value="all">All Associates</option>
                {filteredAssociatesDropdown.map((assoc) => (
                  <option key={assoc.id} value={assoc.id}>{assoc.name}</option>
                ))}
              </select>
            </div>

            {/* Instant Search Input */}
            <div className="flex flex-col gap-1 relative">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Instant Search</span>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                  <Search size={12} />
                </span>
                <input
                  type="text"
                  placeholder={activeTab === "customer" ? "Name, Phone, City..." : "Name, ID, Phone..."}
                  value={activeFilters.search}
                  onChange={(e) => {
                    setActiveFilters(prev => ({ ...prev, search: e.target.value }));
                    if (activeTab === "customer") setCustomerPage(1); else setAssociatePage(1);
                  }}
                  className="w-full pl-7 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs font-semibold text-slate-200 outline-none focus:border-[#00a884]"
                />
              </div>
            </div>
          </div>

          {/* Custom Date Bounds Panel */}
          {activeFilters.dateRange === "custom" && (
            <div className="flex flex-wrap items-center gap-4 bg-slate-800/50 border border-slate-800 rounded-lg p-2.5 animate-in slide-in-from-top duration-150">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase">From</span>
                <input
                  type="date"
                  value={activeFilters.startDate}
                  onChange={(e) => {
                    setActiveFilters(prev => ({ ...prev, startDate: e.target.value }));
                    if (activeTab === "customer") setCustomerPage(1); else setAssociatePage(1);
                  }}
                  className="bg-slate-800 border border-slate-700 rounded-lg py-1 px-2.5 text-xs font-semibold text-slate-200 outline-none focus:border-[#00a884]"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase">To</span>
                <input
                  type="date"
                  value={activeFilters.endDate}
                  onChange={(e) => {
                    setActiveFilters(prev => ({ ...prev, endDate: e.target.value }));
                    if (activeTab === "customer") setCustomerPage(1); else setAssociatePage(1);
                  }}
                  className="bg-slate-800 border border-slate-700 rounded-lg py-1 px-2.5 text-xs font-semibold text-slate-200 outline-none focus:border-[#00a884]"
                />
              </div>
            </div>
          )}

          {/* "Include Me" Filter checkbox (Associate report tab only) */}
          {activeTab === "associate" && (
            <div className="flex items-center border-t border-slate-800/80 pt-2.5">
              <label className="inline-flex items-center gap-2 cursor-pointer bg-slate-800/40 border border-slate-800 hover:border-slate-700 py-1.5 px-3 rounded-lg transition-all">
                <input
                  type="checkbox"
                  checked={includeMe}
                  onChange={(e) => {
                    setIncludeMe(e.target.checked);
                    setAssociatePage(1);
                  }}
                  className="rounded text-[#00a884] focus:ring-[#00a884] cursor-pointer bg-slate-900 border-slate-700"
                />
                <span className="text-xs font-bold text-slate-300 select-none">Include Me</span>
              </label>
            </div>
          )}

        </div>
      </div>

      <div className="max-w-[1800px] mx-auto px-6 py-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 bg-white border border-slate-200 rounded-xl shadow-sm">
            <RefreshCw className="animate-spin text-[#00a884] mb-3" size={28} />
            <p className="text-xs text-slate-450 font-bold uppercase tracking-widest">Loading Analytics Ledger...</p>
          </div>
        ) : (
          <>
            {/* ======================================================== */}
            {/* TABS 1: CUSTOMER REPORT TABLE */}
            {/* ======================================================== */}
            {activeTab === "customer" && (
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden select-none animate-in fade-in duration-150 flex flex-col">
                {customerReportRows.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20">
                    <FileText className="text-slate-300 mb-2" size={36} />
                    <h4 className="font-bold text-slate-750 text-sm">No customer records found</h4>
                    <p className="text-[11px] text-slate-450 mt-0.5">No customer lifecycle logs match your active filters or search terms.</p>
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto overflow-y-auto max-h-[620px]">
                      <table className="w-full text-left border-collapse min-w-[2100px]">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-widest sticky top-0 bg-slate-50 z-10">
                            <th className="py-2.5 px-3.5 select-none w-10"></th>
                            <th className="py-2.5 px-3 select-none cursor-pointer hover:bg-slate-100" onClick={() => handleCustomerSort("customerName")}>
                              Customer Name {customerSortBy === "customerName" ? (customerSortOrder === "asc" ? "▲" : "▼") : ""}
                            </th>
                            <th className="py-2.5 px-3 select-none">Phone Number</th>
                            <th className="py-2.5 px-3 select-none cursor-pointer hover:bg-slate-100" onClick={() => handleCustomerSort("date")}>
                              First Enquiry Date {customerSortBy === "date" ? (customerSortOrder === "asc" ? "▲" : "▼") : ""}
                            </th>
                            <th className="py-2.5 px-3 select-none">Enquired For</th>
                            <th className="py-2.5 px-3 select-none">City</th>
                            <th className="py-2.5 px-3 select-none cursor-pointer hover:bg-slate-100" onClick={() => handleCustomerSort("branch")}>
                              Assigned Branch {customerSortBy === "branch" ? (customerSortOrder === "asc" ? "▲" : "▼") : ""}
                            </th>
                            <th className="py-2.5 px-3 select-none">Handled By Associates</th>
                            <th className="py-2.5 px-3 select-none cursor-pointer hover:bg-slate-100" onClick={() => handleCustomerSort("status")}>
                              Current Lead Status {customerSortBy === "status" ? (customerSortOrder === "asc" ? "▲" : "▼") : ""}
                            </th>
                            <th className="py-2.5 px-3 select-none cursor-pointer hover:bg-slate-100" onClick={() => handleCustomerSort("associate")}>
                              Current Lead Owner {customerSortBy === "associate" ? (customerSortOrder === "asc" ? "▲" : "▼") : ""}
                            </th>
                            <th className="py-2.5 px-3.5 select-none max-w-xs">Latest Remark</th>
                            <th className="py-2.5 px-3 select-none">Last Follow Up Date</th>
                            <th className="py-2.5 px-3 select-none">Last Activity</th>
                            <th className="py-2.5 px-3 select-none">Created Date</th>
                            <th className="py-2.5 px-3.5 text-center select-none w-20">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-150 text-xs font-medium text-slate-700">
                          {customerReportRows.map((row) => {
                            const isExpanded = expandedCustomerId === row.id;
                            return (
                              <Fragment key={row.id}>
                                <tr className="hover:bg-slate-50/60 transition-colors border-b border-slate-100">
                                  <td className="py-2.5 px-3.5 text-center">
                                    <button
                                      onClick={() => setExpandedCustomerId(isExpanded ? null : row.id)}
                                      className="p-0.5 rounded hover:bg-slate-200 text-slate-500 cursor-pointer"
                                    >
                                      {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                    </button>
                                  </td>
                                  <td className="py-2.5 px-3 font-bold text-slate-900 whitespace-nowrap">{row.customerName}</td>
                                  <td className="py-2.5 px-3 font-mono text-slate-500 whitespace-nowrap">{row.phone}</td>
                                  <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">{row.firstEnquiryDate}</td>
                                  <td className="py-2.5 px-3 whitespace-nowrap">{row.enquiredFor}</td>
                                  <td className="py-2.5 px-3 whitespace-nowrap">{row.city}</td>
                                  <td className="py-2.5 px-3 whitespace-nowrap">{row.assignedBranch}</td>
                                  <td className="py-2.5 px-3 whitespace-nowrap text-slate-650 max-w-[200px] truncate" title={row.handledByAssociates}>{row.handledByAssociates}</td>
                                  <td className="py-2.5 px-3 whitespace-nowrap">
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                      row.currentLeadStatus === "Closed" ? "bg-emerald-50 text-emerald-600 border border-emerald-100" :
                                      row.currentLeadStatus === "Follow Up" ? "bg-amber-50 text-amber-600 border border-amber-100" :
                                      row.currentLeadStatus === "Not Interested" ? "bg-slate-150 text-slate-550 border border-slate-200" : "bg-blue-50 text-blue-550 border border-blue-100"
                                    }`}>
                                      {row.currentLeadStatus}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3 font-bold text-[#00a884] whitespace-nowrap">{row.currentLeadOwner}</td>
                                  <td className="py-2.5 px-3.5 max-w-sm truncate text-slate-500" title={row.latestRemark}>{row.latestRemark}</td>
                                  <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">{row.lastFollowUpDate}</td>
                                  <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                                    {row.lastActivity ? new Date(row.lastActivity).toLocaleDateString() : "-"}
                                  </td>
                                  <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                                    {row.createdDate ? new Date(row.createdDate).toLocaleDateString() : "-"}
                                  </td>
                                  <td className="py-2.5 px-3.5 text-center whitespace-nowrap">
                                    <div className="inline-flex gap-1.5">
                                      <Link
                                        href={`/crm/chat?phone=${row.phone.replace("whatsapp:", "")}`}
                                        target="_blank"
                                        className="inline-flex items-center gap-0.5 bg-[#00a884] hover:bg-[#008f70] text-white font-bold py-0.5 px-2 rounded text-[10px] transition-colors shadow-sm"
                                      >
                                        Chat <ExternalLink size={9} />
                                      </Link>
                                      <Link
                                        href={`/crm/leads/${row.phone.replace("whatsapp:", "")}`}
                                        target="_blank"
                                        className="inline-flex items-center gap-0.5 bg-slate-900 hover:bg-black text-white font-bold py-0.5 px-2 rounded text-[10px] transition-colors shadow-sm"
                                      >
                                        Lead <ExternalLink size={9} />
                                      </Link>
                                    </div>
                                  </td>
                                </tr>

                                {/* COLLAPSIBLE ROW: CUSTOMER TIMELINE HISTORY */}
                                {isExpanded && (
                                  <tr className="bg-slate-50/40">
                                    <td colSpan="15" className="p-3 border-l-4 border-[#00a884] bg-slate-50/20">
                                      <div className="bg-white border border-slate-200 rounded-lg p-3 max-w-3xl shadow-inner">
                                        <h5 className="font-bold text-[#00a884] text-xs uppercase tracking-wider mb-2.5">
                                          Interaction Timeline - {row.customerName}
                                        </h5>
                                        {row.timeline.length === 0 ? (
                                          <p className="text-xs text-slate-400 italic">No interaction logs recorded.</p>
                                        ) : (
                                          <div className="relative pl-4 border-l border-slate-200 space-y-3.5">
                                            {row.timeline.map((hist, tIdx) => (
                                              <div key={tIdx} className="relative flex flex-col gap-0.5">
                                                <span className="absolute -left-[21px] top-1.5 bg-[#00a884] h-2.5 w-2.5 rounded-full border border-white"></span>
                                                <div className="flex items-center gap-2">
                                                  <span className="font-bold text-xs text-slate-800">{hist.associate}</span>
                                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase bg-slate-100 border border-slate-200 text-slate-500">
                                                    {hist.action}
                                                  </span>
                                                  <span className="text-[10px] text-slate-450 font-semibold ml-auto">{hist.date}</span>
                                                </div>
                                                <p className="text-[11px] text-slate-500 font-medium">{hist.remark}</p>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <Pagination
                      currentPage={customerPage}
                      totalPages={customerPagination.pages}
                      totalRecords={customerPagination.total}
                      pageSize={Number(customerLimit)}
                      onPageChange={setCustomerPage}
                      onPageSizeChange={(val) => {
                        setCustomerLimit(val);
                        setCustomerPage(1);
                      }}
                    />
                  </>
                )}
              </div>
            )}

            {/* ======================================================== */}
            {/* TABS 2: ASSOCIATE REPORT TABLE */}
            {/* ======================================================== */}
            {activeTab === "associate" && (
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden select-none animate-in fade-in duration-150 flex flex-col">
                {associatePerformanceSummary.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20">
                    <FileText className="text-slate-300 mb-2" size={36} />
                    <h4 className="font-bold text-slate-750 text-sm">No associates found</h4>
                    <p className="text-[11px] text-slate-450 mt-0.5">No associates match your branch or department/role filters.</p>
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto overflow-y-auto max-h-[620px]">
                      <table className="w-full text-left border-collapse min-w-[1500px]">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-widest sticky top-0 bg-slate-50 z-10">
                            <th className="py-2.5 px-3.5 select-none w-10"></th>
                            <th className="py-2.5 px-3 select-none cursor-pointer hover:bg-slate-100" onClick={() => handleAssociateSort("associateName")}>
                              Associate Name {associateSortBy === "associateName" ? (associateSortOrder === "asc" ? "▲" : "▼") : ""}
                            </th>
                            <th className="py-2.5 px-3 select-none">Branch</th>
                            <th className="py-2.5 px-3 select-none">Role</th>
                            <th className="py-2.5 px-3 select-none">Department</th>
                            <th className="py-2.5 px-3 text-center select-none cursor-pointer hover:bg-slate-100" onClick={() => handleAssociateSort("customersHandled")}>
                              Customers Handled {associateSortBy === "customersHandled" ? (associateSortOrder === "asc" ? "▲" : "▼") : ""}
                            </th>
                            <th className="py-2.5 px-3 text-center select-none">Follow Ups</th>
                            <th className="py-2.5 px-3 text-center select-none">Closed</th>
                            <th className="py-2.5 px-3 text-center select-none">Not Interested</th>
                            <th className="py-2.5 px-3 text-center select-none">Pending</th>
                            <th className="py-2.5 px-3 text-center select-none">New Leads Closed</th>
                            <th className="py-2.5 px-3 text-center select-none">Existing Leads Closed</th>
                            <th className="py-2.5 px-3 select-none">Avg Response Time</th>
                            <th className="py-2.5 px-3 select-none">Last Activity</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-150 text-xs font-medium text-slate-700">
                          {associatePerformanceSummary.map((row) => {
                            const isExpanded = expandedAssociateId === row.associateId;
                            return (
                              <Fragment key={row.associateId}>
                                <tr className="hover:bg-slate-50/60 transition-colors border-b border-slate-100">
                                  <td className="py-2.5 px-3.5 text-center">
                                    <button
                                      onClick={() => setExpandedAssociateId(isExpanded ? null : row.associateId)}
                                      className="p-0.5 rounded hover:bg-slate-200 text-slate-500 cursor-pointer"
                                    >
                                      {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                    </button>
                                  </td>
                                  <td className="py-2.5 px-3 font-bold text-slate-900 whitespace-nowrap">{row.associateName}</td>
                                  <td className="py-2.5 px-3 whitespace-nowrap">{row.branch}</td>
                                  <td className="py-2.5 px-3 uppercase text-[10px] text-slate-500 whitespace-nowrap">{row.role}</td>
                                  <td className="py-2.5 px-3 uppercase text-[10px] text-slate-500 whitespace-nowrap">{row.department}</td>
                                  <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-800 whitespace-nowrap">{row.customersHandled}</td>
                                  <td className="py-2.5 px-3 text-center font-mono text-slate-600 whitespace-nowrap">{row.followUps}</td>
                                  <td className="py-2.5 px-3 text-center font-mono text-emerald-600 whitespace-nowrap">{row.closed}</td>
                                  <td className="py-2.5 px-3 text-center font-mono text-slate-500 whitespace-nowrap">{row.notInterested}</td>
                                  <td className="py-2.5 px-3 text-center font-mono text-blue-600 whitespace-nowrap">{row.pending}</td>
                                  <td className="py-2.5 px-3 text-center font-mono text-emerald-600 whitespace-nowrap">{row.newLeadsClosed}</td>
                                  <td className="py-2.5 px-3 text-center font-mono text-[#00a884] whitespace-nowrap">{row.existingLeadsClosed}</td>
                                  <td className="py-2.5 px-3 font-mono font-bold text-indigo-600 whitespace-nowrap">{row.averageResponseTime}</td>
                                  <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                                    {row.lastActivity ? new Date(row.lastActivity).toLocaleDateString() : "-"}
                                  </td>
                                </tr>

                                {/* COLLAPSIBLE ROW: ASSOCIATE HANDLED CUSTOMERS */}
                                {isExpanded && (
                                  <tr className="bg-slate-50/40">
                                    <td colSpan="15" className="p-3 border-l-4 border-[#00a884] bg-slate-50/20">
                                      <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-inner max-w-full">
                                        <h5 className="font-bold text-[#00a884] text-xs uppercase tracking-wider mb-2.5">
                                          Customers handled by {row.associateName}
                                        </h5>
                                        <div className="overflow-x-auto">
                                          <table className="w-full text-left border-collapse min-w-[1100px]">
                                            <thead>
                                              <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                <th className="py-2 px-3">Customer Name</th>
                                                <th className="py-2 px-3">Phone</th>
                                                <th className="py-2 px-3">Enquired For</th>
                                                <th className="py-2 px-3">Lead Status</th>
                                                <th className="py-2 px-3">Remark</th>
                                                <th className="py-2 px-3">Latest Activity Date</th>
                                                <th className="py-2 px-3">Date</th>
                                                <th className="py-2 px-3 text-center w-20">Links</th>
                                              </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                                              {(row.associateCustomerHistory || []).map((cust, cIdx) => (
                                                <tr key={cIdx} className="hover:bg-slate-50/40">
                                                  <td className="py-1.5 px-3 text-slate-900 font-bold">{cust.customerName}</td>
                                                  <td className="py-1.5 px-3 font-mono text-slate-500">{cust.phone}</td>
                                                  <td className="py-1.5 px-3">{cust.enquiredFor}</td>
                                                  <td className="py-1.5 px-3">
                                                    <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                                                      cust.leadStatus === "Closed" ? "bg-emerald-50 text-emerald-600 border border-emerald-100" :
                                                      cust.leadStatus === "Follow Up" ? "bg-amber-50 text-amber-600 border border-amber-100" :
                                                      cust.leadStatus === "Not Interested" ? "bg-slate-100 text-slate-500 border border-slate-200" : "bg-blue-50 text-blue-500 border border-blue-105"
                                                    }`}>
                                                      {cust.leadStatus}
                                                    </span>
                                                  </td>
                                                  <td className="py-1.5 px-3 max-w-xs truncate text-slate-500" title={cust.remark}>{cust.remark}</td>
                                                  <td className="py-1.5 px-3 text-slate-500">
                                                    {cust.latestActivityDate ? new Date(cust.latestActivityDate).toLocaleString() : "-"}
                                                  </td>
                                                  <td className="py-1.5 px-3 text-slate-500">
                                                    {cust.date ? new Date(cust.date).toLocaleDateString() : "-"}
                                                  </td>
                                                  <td className="py-1.5 px-3 text-center whitespace-nowrap">
                                                    <div className="inline-flex gap-1">
                                                      <Link
                                                        href={`/crm/chat?phone=${cust.phone.replace("whatsapp:", "")}`}
                                                        target="_blank"
                                                        className="inline-flex items-center gap-0.5 bg-[#00a884] hover:bg-[#008f70] text-white font-bold py-0.5 px-1.5 rounded text-[9px] transition-colors shadow-sm"
                                                      >
                                                        Chat <ExternalLink size={8} />
                                                      </Link>
                                                      <Link
                                                        href={`/crm/leads/${cust.phone.replace("whatsapp:", "")}`}
                                                        target="_blank"
                                                        className="inline-flex items-center gap-0.5 bg-slate-900 hover:bg-black text-white font-bold py-0.5 px-1.5 rounded text-[9px] transition-colors shadow-sm"
                                                      >
                                                        Lead <ExternalLink size={8} />
                                                      </Link>
                                                    </div>
                                                  </td>
                                                </tr>
                                              ))}
                                              {(row.associateCustomerHistory || []).length === 0 && (
                                                <tr>
                                                  <td colSpan="8" className="py-3 text-center text-slate-400 italic">
                                                    No handled customer records logged.
                                                  </td>
                                                </tr>
                                              )}
                                            </tbody>
                                          </table>
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <Pagination
                      currentPage={associatePage}
                      totalPages={associatePagination.pages}
                      totalRecords={associatePagination.total}
                      pageSize={Number(associateLimit)}
                      onPageChange={setAssociatePage}
                      onPageSizeChange={(val) => {
                        setAssociateLimit(val);
                        setAssociatePage(1);
                      }}
                    />
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </DashboardPage>
  );
}
