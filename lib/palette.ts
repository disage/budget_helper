// Категориальная палитра (проверена на различимость при дальтонизме).
// Цвет закреплён за категорией, а не за её местом в графике.
export const PALETTE = [
  { name: "Синий", light: "#2a78d6", dark: "#3987e5" },
  { name: "Оранжевый", light: "#eb6834", dark: "#d95926" },
  { name: "Бирюзовый", light: "#1baf7a", dark: "#199e70" },
  { name: "Жёлтый", light: "#eda100", dark: "#c98500" },
  { name: "Розовый", light: "#e87ba4", dark: "#d55181" },
  { name: "Зелёный", light: "#008300", dark: "#008300" },
  { name: "Фиолетовый", light: "#6250d6", dark: "#9085e9" },
  { name: "Красный", light: "#e34948", dark: "#e66767" },
  { name: "Серый", light: "#898781", dark: "#898781" },
  { name: "Тёмно-серый", light: "#5d5c58", dark: "#a3a19b" },
] as const;

const DARK = new Map<string, string>(PALETTE.map((p) => [p.light.toLowerCase(), p.dark]));

export function themedColor(hex: string, dark: boolean): string {
  return dark ? (DARK.get(hex.toLowerCase()) ?? hex) : hex;
}
