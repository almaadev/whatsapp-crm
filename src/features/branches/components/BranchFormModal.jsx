import { useState, useEffect } from "react";
import { X, Check, Building2, User, Phone, Mail, MapPin, Loader2 } from "lucide-react";

export default function BranchFormModal({ isOpen, onClose, branch = null, onSubmit, loading = false }) {
  const isEdit = !!branch;

  const [formData, setFormData] = useState({
    name: "",
    address: "",
    phone: "",
    email: "",
    manager: "",
    status: "active",
  });

  const [errors, setErrors] = useState({});

  // Sync edit data
  useEffect(() => {
    if (branch) {
      setFormData({
        name: branch.name || "",
        address: branch.address || "",
        phone: branch.phone || "",
        email: (branch.email && branch.email !== "Add an email") ? branch.email : "",
        manager: (branch.manager && branch.manager !== "Assign a manager") ? branch.manager : "",
        status: branch.status || "active",
      });
    } else {
      setFormData({
        name: "",
        address: "",
        phone: "",
        email: "",
        manager: "",
        status: "active",
      });
    }
    setErrors({});
  }, [branch, isOpen]);

  // Keyboard shortcut: ESC to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const validateField = (name, val) => {
    let err = "";
    if (!val || val.trim() === "") {
      if (name !== "email" && name !== "manager") {
        err = "This field is required.";
      }
    } else {
      if (name === "phone") {
        const phoneRegex = /^\+?[0-9]{10,15}$/;
        if (!phoneRegex.test(val.trim())) {
          err = "Phone must be between 10 and 15 digits.";
        }
      }
      if (name === "email") {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(val.trim())) {
          err = "Invalid email format.";
        }
      }
    }
    return err;
  };

  const handleInputChange = (name, val) => {
    setFormData((prev) => ({ ...prev, [name]: val }));
    const error = validateField(name, val);
    setErrors((prev) => ({ ...prev, [name]: error }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Validate all fields
    const newErrors = {};
    Object.keys(formData).forEach((key) => {
      const err = validateField(key, formData[key]);
      if (err) newErrors[key] = err;
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 z-[100] flex justify-center items-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden scale-100 transition-all flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-slate-900 px-6 py-4 flex items-center justify-between shrink-0">
          <h3 className="text-white font-black text-base flex items-center gap-2 tracking-tight">
            <Building2 size={20} className="text-[#00a884]" />
            {isEdit ? "Edit Branch Profile" : "Create New Branch"}
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition cursor-pointer p-1 rounded-lg hover:bg-slate-800"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-y-auto custom-scrollbar p-6 space-y-4">
          {/* Branch Name */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Branch Name *</label>
            <div className="relative">
              <Building2 className="absolute left-3.5 top-3 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="e.g. Chennai Main"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                className={`w-full pl-10 pr-4 py-2.5 bg-slate-50 border rounded-xl outline-none focus:ring-2 transition-all text-sm font-medium ${
                  errors.name
                    ? "border-red-300 focus:ring-red-500/20 focus:border-red-500 text-red-900"
                    : "border-slate-200 focus:ring-emerald-500/20 focus:border-[#00a884] text-slate-800"
                }`}
              />
            </div>
            {errors.name && <p className="text-red-500 text-xs font-bold mt-1 ml-1">{errors.name}</p>}
          </div>

          {/* Manager & Phone Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Manager */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Manager</label>
              <div className="relative">
                <User className="absolute left-3.5 top-3 text-slate-400" size={16} />
                <input
                  type="text"
                  placeholder="Manager Name"
                  value={formData.manager}
                  onChange={(e) => handleInputChange("manager", e.target.value)}
                  className={`w-full pl-10 pr-4 py-2.5 bg-slate-50 border rounded-xl outline-none focus:ring-2 transition-all text-sm font-medium ${
                    errors.manager
                      ? "border-red-300 focus:ring-red-500/20 focus:border-red-500 text-red-900"
                      : "border-slate-200 focus:ring-emerald-500/20 focus:border-[#00a884] text-slate-800"
                  }`}
                />
              </div>
              {errors.manager && <p className="text-red-500 text-xs font-bold mt-1 ml-1">{errors.manager}</p>}
            </div>

            {/* Phone */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Phone Number *</label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-3 text-slate-400" size={16} />
                <input
                  type="tel"
                  placeholder="e.g. 917401403011"
                  value={formData.phone}
                  onChange={(e) => handleInputChange("phone", e.target.value)}
                  className={`w-full pl-10 pr-4 py-2.5 bg-slate-50 border rounded-xl outline-none focus:ring-2 transition-all text-sm font-medium ${
                    errors.phone
                      ? "border-red-300 focus:ring-red-500/20 focus:border-red-500 text-red-900"
                      : "border-slate-200 focus:ring-emerald-500/20 focus:border-[#00a884] text-slate-800"
                  }`}
                />
              </div>
              {errors.phone && <p className="text-red-500 text-xs font-bold mt-1 ml-1">{errors.phone}</p>}
            </div>
          </div>

          {/* Email Address */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="e.g. chennai@almaa.com"
                value={formData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
                className={`w-full pl-10 pr-4 py-2.5 bg-slate-50 border rounded-xl outline-none focus:ring-2 transition-all text-sm font-medium ${
                  errors.email
                    ? "border-red-300 focus:ring-red-500/20 focus:border-red-500 text-red-900"
                    : "border-slate-200 focus:ring-emerald-500/20 focus:border-[#00a884] text-slate-800"
                }`}
              />
            </div>
            {errors.email && <p className="text-red-500 text-xs font-bold mt-1 ml-1">{errors.email}</p>}
          </div>

          {/* Address */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Physical Address *</label>
            <div className="relative">
              <MapPin className="absolute left-3.5 top-3 text-slate-400" size={16} />
              <textarea
                placeholder="Full address details"
                value={formData.address}
                rows={3}
                onChange={(e) => handleInputChange("address", e.target.value)}
                className={`w-full pl-10 pr-4 py-2.5 bg-slate-50 border rounded-xl outline-none focus:ring-2 transition-all text-sm font-medium resize-none ${
                  errors.address
                    ? "border-red-300 focus:ring-red-500/20 focus:border-red-500 text-red-900"
                    : "border-slate-200 focus:ring-emerald-500/20 focus:border-[#00a884] text-slate-800"
                }`}
              />
            </div>
            {errors.address && <p className="text-red-500 text-xs font-bold mt-1 ml-1">{errors.address}</p>}
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Status *</label>
            <select
              value={formData.status}
              onChange={(e) => handleInputChange("status", e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-[#00a884] text-sm font-bold text-slate-700 cursor-pointer"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          {/* Form Actions */}
          <div className="flex gap-3 pt-4 border-t border-slate-100 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-3 bg-[#00a884] hover:bg-emerald-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-100/50 transition cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed active:scale-98"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check size={16} />
                  {isEdit ? "Save Changes" : "Create Branch"}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
