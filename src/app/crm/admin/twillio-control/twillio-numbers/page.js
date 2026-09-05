"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { toast } from "react-toastify";
import { useCrmLayout } from "@/shared/components/layout/CrmShell";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  Menu,
  Smartphone,
  Plus,
  Trash2,
  Users,
  ShieldAlert,
  AlertTriangle,
  RefreshCw,
  X,
  Phone,
  Tag,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";

// ─── Animation Variants ─────────────────────────────────────────────────────
const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { delay: i * 0.06, duration: 0.35, ease: "easeOut" },
  }),
  exit: { opacity: 0, y: -10, scale: 0.95, transition: { duration: 0.2 } },
};

const modalOverlay = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

const modalContent = {
  hidden: { opacity: 0, scale: 0.92, y: 30 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] },
  },
  exit: {
    opacity: 0,
    scale: 0.92,
    y: 30,
    transition: { duration: 0.2 },
  },
};

// ─── Skeleton Card ───────────────────────────────────────────────────────────
function SkeletonListRow() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-pulse">
      {/* Name Column */}
      <div className="flex items-center gap-3 w-full sm:w-1/4">
        <div className="w-9 h-9 rounded-lg bg-slate-200 shrink-0" />
        <div className="h-4 bg-slate-200 rounded w-2/3 max-w-[120px]" />
      </div>

      {/* Phone Number Column */}
      <div className="w-full sm:w-1/4 hidden sm:block">
        <div className="h-4 bg-slate-100 rounded w-32" />
      </div>

      {/* Status Column */}
      <div className="w-full sm:w-1/4 hidden sm:block">
        <div className="h-7 w-20 bg-slate-200 rounded-full" />
      </div>

      {/* Assigned Admins Column */}
      <div className="w-full sm:w-1/4 flex items-center gap-2">
        <div className="w-4 h-4 rounded-full bg-slate-200 shrink-0" />
        <div className="h-4 bg-slate-100 rounded w-20" />
      </div>
    </div>
  );
}

// ─── Number Card ─────────────────────────────────────────────────────────────

function NumberCard({
  num,
  index,
  isSuperAdmin,
  onToggleStatus,
  onDelete,
  togglingId,
}) {
  const isActive = num.status === "active";
  const adminCount = num.assignedAdmins?.length || 0;
  const isToggling = togglingId === (num._id || num.id);

  return (
    <motion.tr
      custom={index}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      layout
      className="group bg-white hover:bg-slate-50 transition-colors duration-200"
    >
      {/* Name Column */}
      <td className="px-4 py-3 align-middle whitespace-nowrap border-b border-slate-100">
        <div className="flex items-center gap-3">

          <span className="text-sm font-bold text-slate-800 truncate">
            {num.friendlyName || "Unnamed Number"}
          </span>
        </div>
      </td>

      {/* Phone Number Column */}
      <td className="px-4 py-3 align-middle whitespace-nowrap border-b border-slate-100">
        <span className="text-sm text-slate-500 font-mono">
          {num.phoneNumber}
        </span>
      </td>

      {/* Status Column */}
      <td className="px-4 py-3 align-middle whitespace-nowrap border-b border-slate-100">
        <button
          onClick={() =>
            onToggleStatus(num._id || num.id, isActive ? "inactive" : "active")
          }
          disabled={isToggling}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 border cursor-pointer select-none ${
            isActive
              ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
              : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100"
          } ${isToggling ? "opacity-60 cursor-not-allowed" : ""}`}
          title={`Click to ${isActive ? "deactivate" : "activate"}`}
        >
          {isToggling ? (
            <Loader2 size={12} className="animate-spin" />
          ) : isActive ? (
            <ToggleRight size={14} />
          ) : (
            <ToggleLeft size={14} />
          )}
          {isActive ? "Active" : "Inactive"}
        </button>
      </td>

      {/* Assigned Admins Column */}
      <td className="px-4 py-3 align-middle whitespace-nowrap border-b border-slate-100">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Users size={16} className="text-slate-400 shrink-0" />
          <span className="font-semibold text-slate-700">
            {adminCount} {adminCount === 1 ? "Admin" : "Admins"}
          </span>
        </div>
      </td>

      {/* Actions Column (Conditional) */}
      {isSuperAdmin && (
        <td className="px-4 py-3 align-middle whitespace-nowrap text-right border-b border-slate-100">
          <button
            onClick={() => onDelete(num._id || num.id, num.friendlyName)}
            className="inline-flex p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all duration-200 opacity-0 group-hover:opacity-100 focus:opacity-100"
            title={`Delete "${num.friendlyName}"`}
            aria-label={`Delete ${num.friendlyName}`}
          >
            <Trash2 size={16} />
          </button>
        </td>
      )}
    </motion.tr>
  );
}

// ─── Add Number Modal ────────────────────────────────────────────────────────
function AddNumberModal({ show, onClose, onSubmit, submitting }) {
  const [form, setForm] = useState({
    friendlyName: "",
    phoneNumber: "",
  });

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(form, () => setForm({ friendlyName: "", phoneNumber: "" }));
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          variants={modalOverlay}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            variants={modalContent}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <Plus size={18} className="text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-800">
                    Add Sender Number
                  </h2>
                  <p className="text-xs text-slate-500">
                    Configure a new WhatsApp sender
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Friendly Name */}
              <div>
                <label className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 mb-1.5">
                  <Tag size={14} className="text-slate-400" />
                  Friendly Name
                  <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  name="friendlyName"
                  value={form.friendlyName}
                  onChange={handleChange}
                  placeholder="e.g. Almaa Main Business"
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all"
                />
              </div>

              {/* Phone Number */}
              <div>
                <label className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 mb-1.5">
                  <Phone size={14} className="text-slate-400" />
                  WhatsApp Phone Number
                  <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  name="phoneNumber"
                  value={form.phoneNumber}
                  onChange={handleChange}
                  placeholder="e.g. +91 98765 43210"
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  {submitting && <Loader2 size={16} className="animate-spin" />}
                  {submitting ? "Adding..." : "Add Number"}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function TwilioNumbersPage() {
  const { data: session, status } = useSession();
  const { setMobileOpen } = useCrmLayout();

  // ─── State ───────────────────────────────────────────────────────────────
  const [numbers, setNumbers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [submittingNumber, setSubmittingNumber] = useState(false);
  const [togglingId, setTogglingId] = useState(null);

  const isSuperAdmin = session?.user?.role === "superAdmin";

  // ─── Fetch Numbers ───────────────────────────────────────────────────────
  const fetchNumbers = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch("/api/admin/twilio?mode=senders_only");
      const data = await res.json();
      if (data.success && data.numbers) {
        setNumbers(data.numbers);
      } else {
        setError(data.error || "Failed to load sender numbers.");
      }
    } catch (err) {
      setError("Error connecting to server. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated") {
      fetchNumbers();
    }
  }, [status, fetchNumbers]);

  // ─── Add Number ──────────────────────────────────────────────────────────
  const handleAddNumber = async (form, resetForm) => {
    if (!form.friendlyName || !form.phoneNumber) {
      return toast.error("Friendly Name and Phone Number are required.");
    }
    setSubmittingNumber(true);
    try {
      const res = await fetch("/api/admin/twilio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "addNumber",
          friendlyName: form.friendlyName,
          phoneNumber: form.phoneNumber,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Sender number added successfully!");
        setShowAddModal(false);
        resetForm();
        fetchNumbers();
      } else {
        toast.error(data.error || "Failed to add number.");
      }
    } catch (err) {
      toast.error("Error adding number.");
    } finally {
      setSubmittingNumber(false);
    }
  };

  // ─── Toggle Status ───────────────────────────────────────────────────────
  const handleToggleStatus = async (id, newStatus) => {
    if (togglingId) return; // prevent duplicate requests
    setTogglingId(id);
    try {
      const res = await fetch(`/api/admin/twilio/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(
          `Number ${newStatus === "active" ? "activated" : "deactivated"} successfully!`,
        );
        fetchNumbers();
      } else {
        toast.error(data.error || "Failed to update number.");
      }
    } catch (err) {
      toast.error("Error updating number.");
    } finally {
      setTogglingId(null);
    }
  };

  // ─── Delete Number ───────────────────────────────────────────────────────
  const handleDeleteNumber = async (id, friendlyName) => {
    if (!window.confirm(`Are you sure you want to delete "${friendlyName}"?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/twilio/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Number deleted successfully!");
        fetchNumbers();
      } else {
        toast.error(data.error || "Failed to delete number.");
      }
    } catch (err) {
      toast.error("Error deleting number.");
    }
  };

  // ─── Auth loading / guard ────────────────────────────────────────────────
  if (status === "loading") {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={32} className="animate-spin text-emerald-500" />
          <p className="text-sm text-slate-500 font-medium">Loading session…</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="text-center space-y-3">
          <ShieldAlert size={48} className="mx-auto text-slate-300" />
          <h2 className="text-lg font-bold text-slate-700">
            Authentication Required
          </h2>
          <p className="text-sm text-slate-500">
            Please sign in to access this page.
          </p>
        </div>
      </div>
    );
  }

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-slate-50/80 min-h-screen">
      {/* ─── Page Header ────────────────────────────────────────────────── */}
      <header className="h-auto md:h-20 px-6 py-4 md:py-0 bg-white border-b border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between shrink-0 z-20 shadow-sm gap-4 select-none">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            onClick={() => setMobileOpen(true)}
            className="md:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label="Open menu"
          >
            <Menu size={24} />
          </button>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
              <Smartphone className="text-emerald-500" size={24} />
              WhatsApp Sender Numbers
            </h1>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-0.5 ml-0.5">
              Number Management
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
          {/* Refresh */}
          <button
            onClick={() => {
              setLoading(true);
              fetchNumbers();
            }}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>

          {/* Add Number (superAdmin only) */}
          {isSuperAdmin && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors shadow-sm"
            >
              <Plus size={16} />
              Add Sender Number
            </motion.button>
          )}
        </div>
      </header>

      {/* ─── Content Area ───────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          {/* Section header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-slate-800">
                Configured Sender Numbers
              </h2>
              <p className="text-sm text-slate-500 mt-0.5">
                {loading
                  ? "Loading…"
                  : `${numbers.length} number${numbers.length !== 1 ? "s" : ""} configured`}
              </p>
            </div>
          </div>

          {/* ── Loading State ───────────────────────────────────────────── */}
          {loading && (
            <div className="flex flex-col gap-3">
              {[...Array(5)].map((_, i) => (
                <SkeletonListRow key={i} />
              ))}
            </div>
          )}

          {/* ── Error State ─────────────────────────────────────────────── */}
          {!loading && error && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center py-20 px-4"
            >
              <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mb-4">
                <AlertTriangle size={28} className="text-red-400" />
              </div>
              <h3 className="text-base font-bold text-slate-800 mb-1">
                Something went wrong
              </h3>
              <p className="text-sm text-slate-500 mb-5 text-center max-w-sm">
                {error}
              </p>
              <button
                onClick={() => {
                  setLoading(true);
                  fetchNumbers();
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors"
              >
                <RefreshCw size={16} />
                Retry
              </button>
            </motion.div>
          )}

          {/* ── Empty State ─────────────────────────────────────────────── */}
          {!loading && !error && numbers.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center py-20 px-4"
            >
              <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center mb-5">
                <Smartphone size={36} className="text-slate-400" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-1">
                No configured Twilio numbers found.
              </h3>
              <p className="text-sm text-slate-500 text-center max-w-sm mb-5">
                Add your first WhatsApp sender number to start sending messages
                through the CRM.
              </p>
              {isSuperAdmin && (
                <button
                  onClick={() => setShowAddModal(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors"
                >
                  <Plus size={16} />
                  Add First Number
                </button>
              )}
            </motion.div>
          )}

          {/* ── Numbers Grid ────────────────────────────────────────────── */}
          {!loading && !error && numbers.length > 0 && (
            <div className="grid grid-cols-1 overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <AnimatePresence mode="popLayout">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80">
                      <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                        Name
                      </th>
                      <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                        Phone Number
                      </th>
                      <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                        Status
                      </th>
                      <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                        Assigned Admins
                      </th>
                      {isSuperAdmin && (
                        <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right border-b border-slate-200">
                          Actions
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {numbers.map((num, i) => (
                      <NumberCard
                        key={num._id || num.id || i}
                        num={num}
                        index={i}
                        isSuperAdmin={isSuperAdmin}
                        onToggleStatus={handleToggleStatus}
                        onDelete={handleDeleteNumber}
                        togglingId={togglingId}
                      />
                    ))}
                  </tbody>
                </table>
              </AnimatePresence>
            </div>
          )}
        </div>
      </main>

      {/* ─── Add Number Modal ───────────────────────────────────────────── */}
      <AddNumberModal
        show={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={handleAddNumber}
        submitting={submittingNumber}
      />
    </div>
  );
}
