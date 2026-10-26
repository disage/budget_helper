const formatters = new Map<string, Intl.NumberFormat>();

function formatter(currency: string, fraction: boolean): Intl.NumberFormat {
  const key = `${currency}:${fraction}`;
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency,
      minimumFractionDigits: fraction ? 2 : 0,
      maximumFractionDigits: fraction ? 2 : 0,
    });
    formatters.set(key, f);
  }
  return f;
}

/**
 * 131000 → "1 310,00 €". `compact` убирает копейки, если их нет.
 * `sign` добавляет "+" к положительным суммам.
 */
export function formatMoney(
  cents: number,
  currency: string,
  opts: { compact?: boolean; sign?: boolean } = {},
): string {
  const fraction = !opts.compact || cents % 100 !== 0;
  const text = formatter(currency, fraction).format(cents / 100);
  return opts.sign && cents > 0 ? `+${text}` : text;
}

/** "1 310,50" / "1310.5" / "1.310,50" → 131050. Пустая или кривая строка → null. */
export function parseMoney(input: string): number | null {
  let s = input.replace(/[\s  €$£₽₴]/g, "").trim();
  if (!s) return null;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > -1 && lastDot > -1) {
    // Последний разделитель — десятичный, остальные — разряды.
    const dec = lastComma > lastDot ? "," : ".";
    const group = dec === "," ? "." : ",";
    s = s.split(group).join("").replace(dec, ".");
  } else if (lastComma > -1) {
    s = s.replace(",", ".");
  }
  if (!/^-?\d+(\.\d{0,2})?$/.test(s)) return null;
  return Math.round(Number(s) * 100);
}

/** 131050 → "1310,50" для полей ввода. */
export function centsToInput(cents: number): string {
  const v = (cents / 100).toFixed(2);
  return (v.endsWith(".00") ? v.slice(0, -3) : v).replace(".", ",");
}

export function currencySymbol(currency: string): string {
  const part = formatter(currency, false)
    .formatToParts(0)
    .find((p) => p.type === "currency");
  return part?.value ?? currency;
}
