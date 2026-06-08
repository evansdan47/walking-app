function ordinalSuffix(day: number): string {
  if (day >= 11 && day <= 13) return 'th';
  switch (day % 10) {
    case 1:
      return 'st';
    case 2:
      return 'nd';
    case 3:
      return 'rd';
    default:
      return 'th';
  }
}

/** e.g. "Mon 27th Feb 2026" */
export function formatWalkedOnDate(ts: number): string {
  const d = new Date(ts);
  const weekday = d.toLocaleDateString('en-GB', { weekday: 'short' });
  const day = d.getDate();
  const monthYear = d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
  return `${weekday} ${day}${ordinalSuffix(day)} ${monthYear}`;
}

export function formatDaysAgo(ts: number, now = Date.now()): string {
  const days = Math.floor((now - ts) / (1000 * 60 * 60 * 24));
  if (days <= 0) return 'today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

export function formatWalkDateTime(ts: number): string {
  return new Date(ts).toLocaleString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
