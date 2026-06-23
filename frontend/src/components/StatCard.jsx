export default function StatCard({ label, value, sub, icon: Icon, color = 'brand' }) {
  const colorMap = {
    brand: 'text-brand-400 bg-brand-500/10',
    green: 'text-green-400 bg-green-500/10',
    red: 'text-red-400 bg-red-500/10',
    blue: 'text-blue-400 bg-blue-500/10',
    yellow: 'text-yellow-400 bg-yellow-500/10',
  }

  return (
    <div className="card group hover:border-gray-700 transition-colors">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-400">{label}</p>
          <p className="mt-2 text-3xl font-bold text-white">{value}</p>
          {sub && <p className="mt-1 text-sm text-gray-500">{sub}</p>}
        </div>
        {Icon && (
          <div className={`rounded-lg p-2.5 ${colorMap[color]}`}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
    </div>
  )
}
