/** Sixteen Monday-based UTC buckets, including this week and empty weeks. */
export function weeklyTotals(rows: { date: string | null; amount: number | null }[], now = new Date()): number[] {
  const day = 86_400_000;
  const monday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - ((now.getUTCDay() + 6) % 7) * day;
  const start = monday - 15 * 7 * day;
  const totals = Array<number>(16).fill(0);
  for (const row of rows) {
    const time = row.date ? Date.parse(row.date) : NaN;
    const index = Math.floor((time - start) / (7 * day));
    if (Number.isFinite(time) && time <= now.getTime() && index >= 0 && index < totals.length && row.amount != null && Number.isFinite(row.amount)) totals[index] += row.amount;
  }
  return totals;
}
