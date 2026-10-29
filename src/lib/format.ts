const WEEKDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

export function formatMoney(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const euros = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sign}${euros},${(abs % 100).toString().padStart(2, '0')} €`;
}

/** "0,10" / "1.5" / "2" → cents, or null if invalid */
export function parseMoney(input: string): number | null {
  const normalized = input.trim().replace('€', '').trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  return Math.round(parseFloat(normalized) * 100);
}

export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',');
}

/** "3 Verstöße · 2 Boni" (bonuses only when there are any) */
export function formatCounts(s: { violations: number; bonuses: number }): string {
  return s.bonuses ? `${s.violations} Verstöße · ${s.bonuses} Boni` : `${s.violations} Verstöße`;
}

/** Signed open amount of a member: "0,50 € offen" / "0,20 € auszuzahlen" / "Alles beglichen" */
export function formatOpen(open: number): string {
  if (open > 0) return `${formatMoney(open)} offen`;
  if (open < 0) return `${formatMoney(-open)} Guthaben auszuzahlen`;
  return 'Alles beglichen';
}

export function formatAvg(value: number | null): string {
  return value === null ? '–' : value.toFixed(1).replace('.', ',');
}

export function todayIso(): string {
  return toIso(new Date());
}

export function toIso(d: Date): string {
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function fromIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function shiftIso(iso: string, days: number): string {
  const d = fromIso(iso);
  d.setDate(d.getDate() + days);
  return toIso(d);
}

/** 2026-10-28 → 28.10.2026 */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

/** 2026-10-28 → Mi, 28.10.2026 */
export function formatDateLong(iso: string): string {
  return `${WEEKDAYS[fromIso(iso).getDay()]}, ${formatDate(iso)}`;
}

/** 28.10.2026 → 2026-10-28, or null if invalid */
export function parseDate(input: string): string | null {
  const match = input.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!match) return null;
  const [, d, m, y] = match.map(Number);
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return toIso(date);
}
