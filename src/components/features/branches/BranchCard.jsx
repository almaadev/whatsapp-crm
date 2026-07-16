import { Mail, Phone, MapPin, User, Calendar, Copy } from "lucide-react";
import { toast } from "react-toastify";
import BranchStatusBadge from "./BranchStatusBadge";
import ActionsMenu from "./ActionsMenu";

export default function BranchCard({ branch, onEdit, onDelete }) {
  const handleCopy = (text, label) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  };

  const formattedDate = branch.createdAt
    ? new Date(branch.createdAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "";

  const displayManager = branch.manager && branch.manager !== "Assign a manager" ? branch.manager : "";
  const displayEmail = branch.email && branch.email !== "Add an email" ? branch.email : "";

  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4 relative overflow-hidden transition hover:shadow-md hover:border-slate-300">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <h4 className="font-extrabold text-slate-800 tracking-tight text-base">{branch.name}</h4>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold">
            <User size={13} className="text-slate-400" />
            <span>Manager: {displayManager || "Not Assigned"}</span>
          </div>
        </div>
        <ActionsMenu onEdit={onEdit} onDelete={onDelete} />
      </div>

      {/* Details */}
      <div className="space-y-2 text-xs text-slate-600 font-semibold">
        <div className="flex items-center gap-2">
          <Phone size={14} className="text-slate-400 shrink-0" />
          <a href={`tel:${branch.phone}`} className="hover:text-[#00a884] hover:underline transition">
            {branch.phone}
          </a>
          <button
            onClick={() => handleCopy(branch.phone, "Phone number")}
            className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 cursor-pointer transition ml-auto"
            title="Copy Phone"
          >
            <Copy size={12} />
          </button>
        </div>

        {displayEmail ? (
          <div className="flex items-center gap-2">
            <Mail size={14} className="text-slate-400 shrink-0" />
            <a href={`mailto:${displayEmail}`} className="hover:text-[#00a884] hover:underline transition truncate max-w-[180px]">
              {displayEmail}
            </a>
            <button
              onClick={() => handleCopy(displayEmail, "Email address")}
              className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 cursor-pointer transition ml-auto"
              title="Copy Email"
            >
              <Copy size={12} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-slate-400">
            <Mail size={14} className="shrink-0" />
            <span className="italic font-medium">No email address</span>
          </div>
        )}

        <div className="flex items-start gap-2">
          <MapPin size={14} className="text-slate-400 shrink-0 mt-0.5" />
          <span className="leading-relaxed truncate" title={branch.address}>{branch.address}</span>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-slate-100 pt-3.5 mt-1">
        <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
          <Calendar size={12} />
          <span>{formattedDate}</span>
        </div>
        <BranchStatusBadge status={branch.status} />
      </div>
    </div>
  );
}
