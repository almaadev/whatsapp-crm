import MetricCircle from "@/components/ui/MetricCircle"; 

export default function MetricGrid({ role }) {
  const stats = role === "doctor" 
    ? [ { label: "Patients", value: 12 }, { label: "Pending Reports", value: 4 }, { label: "Urgent", value: 2 } ]
    : [ { label: "Today Leads", value: 24 }, { label: "Total Customers", value: 312 }, { label: "Active Chats", value: 18 } ];

  return (
    // Added flex-wrap and adjusted padding
    <div className="flex flex-wrap gap-6 md:gap-12 justify-center py-6 bg-white border-b mb-2 shadow-sm px-4">
      {stats.map((stat, i) => (
        <MetricCircle key={i} label={stat.label} value={stat.value} />
      ))}
    </div>
  );
}