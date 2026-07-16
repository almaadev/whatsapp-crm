import { Mail, Phone, Copy, MapPin } from "lucide-react";
import { toast } from "react-toastify";
import BranchStatusBadge from "./BranchStatusBadge";
import ActionsMenu from "./ActionsMenu";

export default function BranchTable({ branches = [], onEdit, onDelete }) {
  const handleCopy = (text, label) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hidden md:block">
      <div className="overflow-x-auto  md:h-[400px] lg:h-[500px] xl:h-[600px] 2xl:h-[700px]">
        <table className="min-w-full divide-y divide-slate-200 text-left">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Branch Name</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Manager</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Phone</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Email</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Address</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Created Date</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {branches.map((b) => {
              const formattedDate = b.createdAt
                ? new Date(b.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                : "";

              const displayManager = b.manager && b.manager !== "Assign a manager" ? b.manager : "";
              const displayEmail = b.email && b.email !== "Add an email" ? b.email : "";

              return (
                <tr key={b.id || b._id} className="hover:bg-slate-50/50 transition-colors">
                  {/* Branch Name */}
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-extrabold text-slate-800">{b.name}</td>

                  {/* Manager */}
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-600">{displayManager || "-"}</td>

                  {/* Phone */}
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-600">
                    <div className="flex items-center gap-1.5 group">
                      <Phone size={13} className="text-slate-400" />
                      <a href={`tel:${b.phone}`} className="hover:text-[#00a884] hover:underline transition">
                        {b.phone}
                      </a>
                      <button
                        onClick={() => handleCopy(b.phone, "Phone number")}
                        className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 opacity-0 group-hover:opacity-100 transition cursor-pointer"
                        title="Copy Phone"
                      >
                        <Copy size={11} />
                      </button>
                    </div>
                  </td>

                  {/* Email */}
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-600">
                    {displayEmail ? (
                      <div className="flex items-center gap-1.5 group">
                        <Mail size={13} className="text-slate-400" />
                        <a href={`mailto:${displayEmail}`} className="hover:text-[#00a884] hover:underline transition">
                          {displayEmail}
                        </a>
                        <button
                          onClick={() => handleCopy(displayEmail, "Email address")}
                          className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 opacity-0 group-hover:opacity-100 transition cursor-pointer"
                          title="Copy Email"
                        >
                          <Copy size={11} />
                        </button>
                      </div>
                    ) : (
                      <span className="text-slate-400 italic font-medium">-</span>
                    )}
                  </td>

                  {/* Address (Truncated with HTML title tooltip) */}
                  <td className="px-6 py-4 text-sm font-semibold text-slate-500 max-w-xs truncate" title={b.address}>
                    <div className="flex items-center gap-1.5">
                      <MapPin size={13} className="text-slate-400 shrink-0" />
                      <span className="truncate">{b.address}</span>
                    </div>
                  </td>

                  {/* Status Badge */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <BranchStatusBadge status={b.status} />
                  </td>

                  {/* Created Date */}
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-500">{formattedDate}</td>

                  {/* Actions */}
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                    <ActionsMenu onEdit={() => onEdit(b)} onDelete={() => onDelete(b)} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
