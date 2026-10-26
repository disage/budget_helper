// Месяц — строка "YYYY-MM". Даты операций хранятся как полночь UTC выбранного дня,
// поэтому всё форматирование идёт в UTC и не зависит от часового пояса сервера.

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const pad = (n: number) => String(n).padStart(2, "0");

export function isValidMonth(value: unknown): value is string {
  return typeof value === "string" && MONTH_RE.test(value);
}

export function isValidDateInput(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && toDateInput(d) === value;
}

/** Текущий месяц по локальному времени. */
export function currentMonth(now = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
}

/** Сегодняшняя дата по локальному времени, YYYY-MM-DD. */
export function todayInput(now = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function monthOrCurrent(value: unknown): string {
  return isValidMonth(value) ? value : currentMonth();
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const idx = y * 12 + (m - 1) + delta;
  return `${Math.floor(idx / 12)}-${pad((idx % 12) + 1)}`;
}

export function monthRange(month: string): { start: Date; end: Date } {
  return {
    start: new Date(`${month}-01T00:00:00Z`),
    end: new Date(`${shiftMonth(month, 1)}-01T00:00:00Z`),
  };
}

/** Сколько месяцев от `from` до `to` (может быть отрицательным). */
export function monthDiff(from: string, to: string): number {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  return ty * 12 + tm - (fy * 12 + fm);
}

export function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function monthOf(date: Date): string {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}`;
}

const MONTH_NAMES = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

const MONTH_NAMES_DATIVE = [
  "январю", "февралю", "марту", "апрелю", "маю", "июню",
  "июлю", "августу", "сентябрю", "октябрю", "ноябрю", "декабрю",
];

const MONTH_NAMES_GENITIVE = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

/** "2026-10" → "с октября 2026" */
export function sinceMonthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `с ${MONTH_NAMES_GENITIVE[m - 1]} ${y}`;
}

/** "2027-12" → "к декабрю 2027" */
export function byMonthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `к ${MONTH_NAMES_DATIVE[m - 1]} ${y}`;
}

export function monthShortLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${MONTH_NAMES[m - 1].slice(0, 3).toLowerCase()} ${y}`;
}

export function toDateInput(date: Date): string {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function parseDateInput(value: string): Date {
  return new Date(`${value}T00:00:00Z`);
}

/** "2026-06-29" → "29.06.2026" */
export function formatDate(value: string | Date): string {
  const s = typeof value === "string" ? value : toDateInput(value);
  const [y, m, d] = s.split("-");
  return `${d}.${m}.${y}`;
}

/** Дата для оплаты регулярного платежа в выбранном месяце. */
export function defaultPayDate(month: string, dayOfMonth: number | null, now = new Date()): string {
  if (month === currentMonth(now)) return todayInput(now);
  const day = Math.min(dayOfMonth ?? 1, daysInMonth(month));
  return `${month}-${pad(day)}`;
}
