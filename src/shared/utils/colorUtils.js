
export const getStatusColor = (status) => {
    switch(status?.toLowerCase()) {
        case 'new': return 'bg-blue-50 text-blue-700 border-blue-200';
        case 'closed': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
        case 'follow up': return 'bg-amber-50 text-amber-700 border-amber-200';
        case 'not interested': return 'bg-red-50 text-red-700 border-red-200';
        default: return 'bg-slate-50 text-slate-600 border-slate-200';
    }
};
