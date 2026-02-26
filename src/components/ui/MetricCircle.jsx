export default function MetricCircle({ label, value }) {
  return (
    <div className="flex flex-col items-center">
      <div className="w-24 h-24 rounded-full border-4 border-green-500 flex items-center justify-center text-xl font-semibold">
        {value}
      </div>
      <span className="mt-2 text-sm text-gray-600">
        {label}
      </span>
    </div>
  );
}