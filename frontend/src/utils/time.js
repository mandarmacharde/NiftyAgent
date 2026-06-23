const IST_OPTIONS = {
  timeZone: 'Asia/Kolkata',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
}

const IST_TIME_OPTIONS = {
  timeZone: 'Asia/Kolkata',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
}

export function formatIST(isoString) {
  if (!isoString) return '—'
  return new Date(isoString).toLocaleString('en-IN', IST_OPTIONS)
}

export function formatISTTime(isoString) {
  if (!isoString) return '—'
  return new Date(isoString).toLocaleTimeString('en-IN', IST_TIME_OPTIONS)
}
