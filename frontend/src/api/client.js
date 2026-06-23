const BASE_URL = '/api'
const WS_URL = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/ws/market`
const CHART_WS_URL = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/ws/chart`

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Request failed' }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

export const api = {
  healthCheck: () => request('/'),
  getMarketStatus: () => request('/market_status'),
  getNifty: () => request('/nifty'),
  getTick: () => request('/tick'),
  getVix: () => request('/vix'),
  getAnalysis: () => request('/analysis'),
  getChart: (timeframe = '1m') => request(`/chart?timeframe=${timeframe}`),
  getOptionChain: (expiry, spot) => {
    const params = new URLSearchParams()
    if (expiry) params.set('expiry', expiry)
    if (spot) params.set('spot', spot)
    const qs = params.toString()
    return request(`/option_chain${qs ? `?${qs}` : ''}`)
  },
  getTrades: () => request('/trades'),
  getOpenTrades: () => request('/open_trades'),
  getClosedTrades: () => request('/closed_trades'),
  paperTrade: () => request('/papertrade', { method: 'POST' }),
  closeTrade: () => request('/close_trade', { method: 'POST' }),
  getReflect: () => request('/reflect'),
  getStats: () => request('/stats'),
  connectMarketFeed: () => new WebSocket(WS_URL),
  connectChartFeed: () => new WebSocket(CHART_WS_URL),
}
