// Offset WIB=7, WITA=8, WIT=9
const TZ_OFFSET = { WIB: 7, WITA: 8, WIT: 9 };

export function formatWaktu(utcStr, timezone = 'WIB') {
  if (!utcStr) return '-';
  // Backend menyimpan "2025-05-10 15:30:00" (UTC)
  const dt = new Date(utcStr.replace(' ', 'T') + 'Z');
  if (isNaN(dt.getTime())) return utcStr;
  const offsetHrs = TZ_OFFSET[timezone] ?? 7;
  const local = new Date(dt.getTime() + offsetHrs * 3600 * 1000);
  const pad = n => String(n).padStart(2, '0');
  return `${local.getUTCFullYear()}-${pad(local.getUTCMonth()+1)}-${pad(local.getUTCDate())} ${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())} ${timezone}`;
}
