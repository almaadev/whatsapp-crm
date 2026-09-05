"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import DashboardPage from "@/shared/components/layout/DashboardPage";
import LoadingScreen from "@/shared/components/ui/LoadingScreen";
import AccessDenied from "@/shared/components/ui/AccessDenied";
import Pagination from "@/shared/components/ui/Pagination";
import MediaViewer from "@/features/chat/components/media/MediaViewer";
import { useAuth } from "@/shared/hooks/useAuth";
import { formatBytes } from "@/features/chat/services/mediaService";
import { toast } from "react-toastify";
import Link from "next/link";
import api from "@/shared/lib/axios";
import {
  Image,
  Video,
  FileText,
  Music,
  Search,
  RefreshCw,
  Download,
  Trash2,
  ExternalLink,
  MessageSquare,
  AlertTriangle,
  Clock,
  HardDrive,
  Filter,
  CheckSquare,
  Square,
  Sparkles,
} from "lucide-react";

export default function MediaManagementPage() {
  const { user, isAdmin, isLoading: authLoading } = useAuth();

  const [mediaList, setMediaList] = useState([]);
  const [stats, setStats] = useState({
    totalFiles: 0,
    totalBytes: 0,
    imagesCount: 0,
    videosCount: 0,
    documentsCount: 0,
    audioCount: 0,
    expiringSoonCount: 0,
  });

  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState("25");
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 25, pages: 1 });

  // Filter States
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [directionFilter, setDirectionFilter] = useState("all");
  const [expirationFilter, setExpirationFilter] = useState("all");
  const [sortBy, setSortBy] = useState("date");
  const [sortOrder, setSortOrder] = useState("desc");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Selection & Modal States
  const [selectedIds, setSelectedIds] = useState([]);
  const [deleteModalItem, setDeleteModalItem] = useState(null); // specific item or { isBulk: true }
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeMediaViewer, setActiveMediaViewer] = useState(null);
  const [isExporting, setIsExporting] = useState(false);

  const fetchMedia = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit,
        search,
        type: typeFilter,
        direction: directionFilter,
        expiration: expirationFilter,
        sortBy,
        sortOrder,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      };

      const { data } = await api.get("/api/admin/media", { params });
      if (data.success) {
        setMediaList(data.data || []);
        setPagination(data.pagination || { total: 0, page: 1, limit: 25, pages: 1 });
        if (data.stats) {
          setStats(data.stats);
        }
      }
    } catch (err) {
      console.error("Failed to load media:", err);
      toast.error("Failed to load media files");
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, typeFilter, directionFilter, expirationFilter, sortBy, sortOrder, startDate, endDate]);

  useEffect(() => {
    fetchMedia();
  }, [fetchMedia]);

  // Bulk Selection toggle
  const handleSelectAll = () => {
    if (selectedIds.length === mediaList.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(mediaList.map((m) => m._id));
    }
  };

  const handleToggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Delete Action
  const confirmDelete = async () => {
    if (!deleteModalItem) return;
    setIsDeleting(true);

    try {
      const idsToDelete = deleteModalItem.isBulk ? selectedIds : [deleteModalItem._id];
      const { data } = await api.delete("/api/admin/media", {
        data: { ids: idsToDelete },
      });

      if (data.success) {
        toast.success(data.message || "Media deleted permanently.");
        setSelectedIds((prev) => prev.filter((id) => !idsToDelete.includes(id)));
        setDeleteModalItem(null);
        fetchMedia();
      } else {
        toast.error(data.message || "Deletion failed");
      }
    } catch (err) {
      console.error("Delete error:", err);
      toast.error("Failed to delete media.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Export Backups (CSV / JSON)
  const handleExportBackup = async (format = "csv") => {
    setIsExporting(true);
    try {
      if (format === "csv") {
        window.open("/api/admin/media/backup?format=csv", "_blank");
        toast.success("Downloading CSV media metadata backup...");
      } else {
        const { data } = await api.get("/api/admin/media/backup?format=json");
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `whatsapp_media_backup_${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        toast.success("JSON backup downloaded successfully!");
      }
    } catch (err) {
      toast.error("Export failed: " + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadFile = (media) => {
    if (!media.cloudinaryUrl) return;
    const rawName = media.originalFileName || media.fileName || "";
    const isInternalId = !rawName || rawName.startsWith("whatsapp-crm/") || rawName.startsWith("file_") || rawName === "file" || rawName === "whatsapp_media" || rawName.startsWith("inbound_");
    const downloadName = !isInternalId ? rawName : (media.mediaType === "document" ? "Document.pdf" : media.mediaType === "video" ? "Video.mp4" : media.mediaType === "audio" ? "Audio.mp3" : "Photo.jpg");

    const a = document.createElement("a");
    a.href = media.cloudinaryUrl;
    a.download = downloadName;
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (authLoading) return <LoadingScreen />;
  if (!isAdmin) return <AccessDenied />;

  return (
    <DashboardPage
      title="Media Management"
      subtitle="Manage files shared through WhatsApp."
      icon={HardDrive}
      actions={
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleExportBackup("csv")}
            disabled={isExporting}
            className="px-3.5 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-all"
            title="Export CSV Metadata Backup"
          >
            <Download size={14} /> Backup CSV
          </button>
          <button
            onClick={() => handleExportBackup("json")}
            disabled={isExporting}
            className="px-3.5 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-all"
            title="Export JSON Metadata Backup"
          >
            <Download size={14} /> Backup JSON
          </button>
          <button
            onClick={fetchMedia}
            className="p-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl shadow-xs transition-all"
            title="Refresh List"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      }
    >
      {/* ── Summary Cards ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3 md:gap-4">
        {/* Total Files */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Total Files</span>
            <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
              <HardDrive size={16} />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-xl font-extrabold text-slate-800">{stats.totalFiles}</h3>
            <span className="text-[10px] text-slate-400 font-medium">All stored media</span>
          </div>
        </div>

        {/* Images */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Images</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Image size={16} />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-xl font-extrabold text-slate-800">{stats.imagesCount}</h3>
            <span className="text-[10px] text-emerald-600 font-bold">PNG, JPG, WEBP</span>
          </div>
        </div>

        {/* Videos */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Videos</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Video size={16} />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-xl font-extrabold text-slate-800">{stats.videosCount}</h3>
            <span className="text-[10px] text-blue-600 font-bold">MP4 / Video files</span>
          </div>
        </div>

        {/* Documents */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Documents</span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <FileText size={16} />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-xl font-extrabold text-slate-800">{stats.documentsCount}</h3>
            <span className="text-[10px] text-rose-600 font-bold">PDF documents</span>
          </div>
        </div>

        {/* Audio */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Audio</span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Music size={16} />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-xl font-extrabold text-slate-800">{stats.audioCount}</h3>
            <span className="text-[10px] text-purple-600 font-bold">Audio</span>
          </div>
        </div>

        {/* Expiring Soon */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Expiring Soon</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock size={16} />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-xl font-extrabold text-amber-600">{stats.expiringSoonCount}</h3>
            <span className="text-[10px] text-amber-600 font-bold">&lt; 7 days left</span>
          </div>
        </div>

        {/* Storage Used */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Storage Used</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Sparkles size={16} />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-lg font-extrabold text-slate-800 truncate">{formatBytes(stats.totalBytes)}</h3>
            <span className="text-[10px] text-indigo-600 font-bold">Cloudinary store</span>
          </div>
        </div>
      </div>

      {/* ── Filters & Controls Bar ───────────────────────────────── */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col gap-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          
          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search file, phone, sender..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 outline-none focus:bg-white focus:border-[#00a884] focus:ring-2 focus:ring-emerald-500/10 shadow-xs"
            />
          </div>

          {/* File Type */}
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:bg-white focus:border-[#00a884] shadow-xs"
          >
            <option value="all">All File Types</option>
            <option value="image">Images (PNG, JPG, WEBP)</option>
            <option value="video">Videos (MP4)</option>
            <option value="document">Documents (PDF)</option>
            <option value="audio">Audio</option>
          </select>

          {/* Direction */}
          <select
            value={directionFilter}
            onChange={(e) => {
              setDirectionFilter(e.target.value);
              setPage(1);
            }}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:bg-white focus:border-[#00a884] shadow-xs"
          >
            <option value="all">All Directions</option>
            <option value="OUTBOUND">Sent by Associate</option>
            <option value="INBOUND">Sent by Customer</option>
          </select>

          {/* Expiration Status */}
          <select
            value={expirationFilter}
            onChange={(e) => {
              setExpirationFilter(e.target.value);
              setPage(1);
            }}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:bg-white focus:border-[#00a884] shadow-xs"
          >
            <option value="all">All Expiration Statuses</option>
            <option value="active">Active (&gt; 7 days)</option>
            <option value="expiringSoon">Expiring Soon (&lt; 7 days)</option>
            <option value="expired">Expired</option>
          </select>

          {/* Sort By */}
          <select
            value={`${sortBy}_${sortOrder}`}
            onChange={(e) => {
              const [sBy, sOrd] = e.target.value.split("_");
              setSortBy(sBy);
              setSortOrder(sOrd);
              setPage(1);
            }}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:bg-white focus:border-[#00a884] shadow-xs"
          >
            <option value="date_desc">Newest Date First</option>
            <option value="date_asc">Oldest Date First</option>
            <option value="size_desc">Largest Size First</option>
            <option value="size_asc">Smallest Size First</option>
            <option value="expires_asc">Expiring Soonest First</option>
          </select>

          {/* Date Range Start */}
          <input
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setPage(1);
            }}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-700 outline-none focus:bg-white focus:border-[#00a884] shadow-xs font-medium"
            title="Start Date"
          />
        </div>

        {/* Bulk Action Bar (when items are selected) */}
        {selectedIds.length > 0 && (
          <div className="flex items-center justify-between bg-rose-50/80 border border-rose-200 px-4 py-2.5 rounded-xl text-xs text-rose-900 animate-in fade-in">
            <span className="font-bold">
              {selectedIds.length} item(s) selected
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setDeleteModalItem({ isBulk: true })}
                className="px-3.5 py-1.5 bg-rose-600 text-white rounded-lg font-bold text-xs hover:bg-rose-700 shadow-xs flex items-center gap-1.5 active:scale-95 transition-all"
              >
                <Trash2 size={13} /> Delete Selected
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Media Table ─────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-xs text-slate-600 border-collapse">
            <thead className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4 w-10 text-center">
                  <button onClick={handleSelectAll} className="text-slate-400 hover:text-slate-700">
                    {selectedIds.length > 0 && selectedIds.length === mediaList.length ? (
                      <CheckSquare size={16} className="text-[#00a884]" />
                    ) : (
                      <Square size={16} />
                    )}
                  </button>
                </th>
                <th className="py-3.5 px-3">Preview</th>
                <th className="py-3.5 px-4">File Name</th>
                <th className="py-3.5 px-3">Type</th>
                <th className="py-3.5 px-3">Size</th>
                <th className="py-3.5 px-4">Sent By</th>
                <th className="py-3.5 px-4">Sent To</th>
                <th className="py-3.5 px-4">Date</th>
                <th className="py-3.5 px-4">Expires</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    <RefreshCw size={20} className="animate-spin mx-auto mb-2 text-[#00a884]" />
                    Loading media files...
                  </td>
                </tr>
              ) : mediaList.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    No media files found matching your filters.
                  </td>
                </tr>
              ) : (
                mediaList.map((item) => {
                  const isSelected = selectedIds.includes(item._id);
                  const isExpiringSoon =
                    item.expiresAt &&
                    new Date(item.expiresAt) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) &&
                    new Date(item.expiresAt) > new Date();
                  const isExpired = item.status === "EXPIRED" || (item.expiresAt && new Date(item.expiresAt) <= new Date());

                  const rawName = item.originalFileName || item.fileName || "";
                  const isInternalId = !rawName || rawName.startsWith("whatsapp-crm/") || rawName.startsWith("file_") || rawName === "file" || rawName === "whatsapp_media" || rawName.startsWith("inbound_");
                  const resolvedDisplayName = !isInternalId ? rawName : (item.mediaType === "document" ? "Document.pdf" : item.mediaType === "video" ? "Video.mp4" : item.mediaType === "audio" ? "Audio.mp3" : "Photo.jpg");

                  return (
                    <tr
                      key={item._id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isSelected ? "bg-emerald-50/40" : ""
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleToggleSelect(item._id)}
                          className="text-slate-400 hover:text-slate-700"
                        >
                          {isSelected ? (
                            <CheckSquare size={16} className="text-[#00a884]" />
                          ) : (
                            <Square size={16} />
                          )}
                        </button>
                      </td>

                      {/* Thumbnail Preview */}
                      <td className="py-3 px-3">
                        <div
                          onClick={() =>
                            setActiveMediaViewer({
                              url: item.cloudinaryUrl,
                              type: item.mediaType,
                              name: resolvedDisplayName,
                            })
                          }
                          className="w-11 h-11 rounded-xl overflow-hidden cursor-pointer border border-slate-200/80 bg-slate-100 flex items-center justify-center group hover:border-[#00a884] transition-all shadow-2xs"
                        >
                          {item.mediaType === "image" ? (
                            <img
                              src={item.cloudinaryUrl}
                              alt={resolvedDisplayName}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                          ) : item.mediaType === "video" ? (
                            <div className="w-full h-full bg-slate-900 text-white flex items-center justify-center">
                              <Video size={18} />
                            </div>
                          ) : item.mediaType === "document" ? (
                            <div className="w-full h-full bg-rose-50 text-rose-500 flex items-center justify-center">
                              <FileText size={18} />
                            </div>
                          ) : (
                            <div className="w-full h-full bg-purple-50 text-purple-600 flex items-center justify-center">
                              <Music size={18} />
                            </div>
                          )}
                        </div>
                      </td>

                      {/* File Name */}
                      <td className="py-3 px-4 max-w-[200px]">
                        <p className="font-bold text-slate-800 truncate" title={resolvedDisplayName}>
                          {resolvedDisplayName}
                        </p>
                        <span className="text-[10px] text-slate-400 font-mono truncate block">
                          {item.cloudinaryPublicId}
                        </span>
                      </td>

                      {/* Type Badge */}
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                            item.mediaType === "image"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : item.mediaType === "video"
                              ? "bg-blue-50 text-blue-700 border border-blue-200"
                              : item.mediaType === "document"
                              ? "bg-rose-50 text-rose-700 border border-rose-200"
                              : "bg-purple-50 text-purple-700 border border-purple-200"
                          }`}
                        >
                          {item.mediaType}
                        </span>
                      </td>

                      {/* Size */}
                      <td className="py-3 px-3 font-mono font-bold text-slate-700">
                        {formatBytes(item.fileSize)}
                      </td>

                      {/* Sent By */}
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-800 block">
                          {item.uploadedBy?.name || item.senderPhone || (item.direction === "INBOUND" ? "Customer" : "Associate")}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {item.direction === "OUTBOUND" ? "Outbound" : "Inbound"}
                        </span>
                      </td>

                      {/* Sent To */}
                      <td className="py-3 px-4 font-mono font-medium text-slate-700">
                        {item.recipientPhone || item.phone}
                      </td>

                      {/* Date */}
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                        {item.createdAt ? new Date(item.createdAt).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        }) : "-"}
                      </td>

                      {/* Expiration Date */}
                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          <span className="font-mono text-[11px] text-slate-600">
                            {item.expiresAt ? new Date(item.expiresAt).toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            }) : "60 Days"}
                          </span>
                          {isExpired ? (
                            <span className="text-[9px] font-extrabold text-rose-600 uppercase tracking-tight">
                              Expired
                            </span>
                          ) : isExpiringSoon ? (
                            <span className="text-[9px] font-extrabold text-amber-600 uppercase tracking-tight">
                              Expiring Soon
                            </span>
                          ) : (
                            <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-tight">
                              Active
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              setActiveMediaViewer({
                                url: item.cloudinaryUrl,
                                type: item.mediaType,
                                name: item.originalFileName,
                              })
                            }
                            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Preview File"
                          >
                            <ExternalLink size={14} />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDownloadFile(item)}
                            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Download File"
                          >
                            <Download size={14} />
                          </button>

                          <Link
                            href={`/crm/chat?phone=${encodeURIComponent(item.phone)}`}
                            className="p-1.5 text-slate-500 hover:text-[#00a884] hover:bg-emerald-50 rounded-lg transition-colors"
                            title="Open in Chat"
                          >
                            <MessageSquare size={14} />
                          </Link>

                          <button
                            type="button"
                            onClick={() => setDeleteModalItem(item)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Delete File Permanently"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="p-4 border-t border-slate-100">
            <Pagination
              currentPage={page}
              totalPages={pagination.pages}
              onPageChange={(p) => setPage(p)}
            />
          </div>
        )}
      </div>

      {/* ── Delete Confirmation Modal ────────────────────────────── */}
      {deleteModalItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4">
              <AlertTriangle size={24} />
            </div>

            <h3 className="text-base font-bold text-slate-800">
              Delete {deleteModalItem.isBulk ? `${selectedIds.length} files permanently?` : "this file permanently?"}
            </h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              This will remove the file from Cloudinary and the CRM. This action cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => setDeleteModalItem(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={isDeleting}
                className="px-5 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 shadow-sm active:scale-95 transition-all flex items-center gap-1.5"
              >
                {isDeleting ? "Deleting..." : "Delete Permanently"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Full-Screen Media Viewer ─────────────────────────────── */}
      {activeMediaViewer && (
        <MediaViewer
          media={activeMediaViewer}
          onClose={() => setActiveMediaViewer(null)}
        />
      )}
    </DashboardPage>
  );
}
