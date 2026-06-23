import { formatIST } from '../utils/time'

export default function TradeTable({ trades, showReflection = false }) {
  if (!trades.length) {
    return (
      <div className="card py-12 text-center">
        <p className="text-gray-500">No trades found</p>
      </div>
    )
  }

  const statusBadge = (status) => {
    if (status === 'OPEN') return <span className="badge-blue">{status}</span>
    return <span className="badge-gray">{status}</span>
  }

  const actionBadge = (action) => {
    if (action === 'BUY_CALL') return <span className="badge-green">{action}</span>
    if (action === 'BUY_PUT') return <span className="badge-red">{action}</span>
    return <span className="badge-yellow">{action}</span>
  }

  const typeBadge = (optionType) => {
    if (optionType === 'CE') return <span className="text-[10px] font-bold text-green-400">CE</span>
    if (optionType === 'PE') return <span className="text-[10px] font-bold text-red-400">PE</span>
    return null
  }

  return (
    <div className="card overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-left text-[10px] font-medium uppercase tracking-wider text-gray-500">
              <th className="px-3 py-2.5">Opened</th>
              <th className="px-3 py-2.5">Closed</th>
              <th className="px-3 py-2.5">Action</th>
              <th className="px-3 py-2.5">Strike</th>
              <th className="px-3 py-2.5 text-right">Entry</th>
              <th className="px-3 py-2.5 text-right">Mark</th>
              <th className="px-3 py-2.5 text-right">Exit</th>
              <th className="px-3 py-2.5 text-right">P&L</th>
              <th className="px-3 py-2.5 text-right">SL</th>
              <th className="px-3 py-2.5 text-right">TGT</th>
              <th className="px-3 py-2.5 text-right">Lots</th>
              <th className="px-3 py-2.5">Conf</th>
              <th className="px-3 py-2.5">Status</th>
              {showReflection && <th className="px-3 py-2.5">Result</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {trades.map((trade) => {
              const livePnl = trade.pnl ?? trade.unrealized_pnl

              return (
                <tr key={trade.id || trade.created_at} className="transition-colors hover:bg-gray-800/30">
                  <td className="whitespace-nowrap px-3 py-2 text-gray-400 text-[11px]">
                    {formatIST(trade.created_at)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-gray-400 text-[11px]">
                    {trade.closed_at ? formatIST(trade.closed_at) : <span className="text-gray-600">—</span>}
                  </td>
                  <td className="px-3 py-2">{actionBadge(trade.action)}</td>
                  <td className="px-3 py-2 font-mono text-xs tabular-nums">
                    <span className="text-gray-300">{trade.strike ? Number(trade.strike).toLocaleString('en-IN') : '—'}</span>
                    {trade.option_type && <span className="ml-1">{typeBadge(trade.option_type)}</span>}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-gray-300 tabular-nums text-xs">{formatPrice(trade.entry)}</td>
                  <td className="px-3 py-2 text-right font-mono text-gray-300 tabular-nums text-xs">{formatPrice(trade.last_price ?? trade.entry)}</td>
                  <td className="px-3 py-2 text-right font-mono text-gray-300 tabular-nums text-xs">
                    {trade.exit != null ? formatPrice(trade.exit) : <span className="text-gray-600">—</span>}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-xs">
                    {livePnl != null ? (
                      <span className={`font-semibold ${livePnl > 0 ? 'text-green-400' : livePnl < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                        {formatSigned(livePnl)}
                      </span>
                    ) : (
                      <span className="text-gray-600">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-red-400/70 tabular-nums text-[11px]">
                    {trade.stop_loss ? formatPrice(trade.stop_loss) : <span className="text-gray-600">—</span>}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-green-400/70 tabular-nums text-[11px]">
                    {trade.target ? formatPrice(trade.target) : <span className="text-gray-600">—</span>}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-400 tabular-nums text-xs">
                    {trade.lots || '—'}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <div className="h-1.5 w-12 rounded-full bg-gray-800">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            trade.confidence >= 70 ? 'bg-green-500' : trade.confidence >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${trade.confidence}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-gray-500 tabular-nums">{trade.confidence}%</span>
                    </div>
                  </td>
                  <td className="px-3 py-2">{statusBadge(trade.status)}</td>
                  {showReflection && (
                    <td className="px-3 py-2">
                      {trade.reflection ? (
                        <span className={trade.reflection.result === 'success' ? 'badge-green' : 'badge-red'}>
                          {trade.reflection.result}
                        </span>
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function formatPrice(value) {
  return Number(value || 0).toLocaleString('en-IN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })
}

function formatSigned(value) {
  const number = Number(value || 0)
  return `${number > 0 ? '+' : ''}${formatPrice(number)}`
}
