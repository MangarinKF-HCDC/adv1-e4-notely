export const DEFAULT_CATEGORY_COLOR = "#D5D9E4";

export const PRESET_COLORS = [
  { name: "Apricot Cream", hex: "#FFD9B8" }, { name: "Sea Glass", hex: "#B8E8E0" },
  { name: "Lilac Haze", hex: "#DCCFF5" }, { name: "Rose Quartz", hex: "#F7CADB" },
  { name: "Butter", hex: "#FFF0A8" }, { name: "Sky Mist", hex: "#C5DDF8" },
  { name: "Mint Leaf", hex: "#CDEFC4" }, { name: "Peach Blush", hex: "#FFC9C0" },
  { name: "Sand", hex: "#EADCC6" }, { name: "Slate Fog", hex: "#D5D9E4" },
  { name: "Cloud White", hex: "#FFFFFF" }, { name: "Plum Night", hex: "#3B2A52" },
];
export function isValidHex(value: string) { return /^#(?:[\da-fA-F]{3}|[\da-fA-F]{6})$/.test(value.trim()); }
export function normalizeHex(value: string) { const hex = value.trim().toUpperCase(); return hex.length === 4 ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}` : hex; }
export function hslToHex(h: number, s: number, l: number) {
  const hue = h / 360; const sat = s / 100; const light = l / 100;
  const channel = (n: number) => { const k = (n + hue * 12) % 12; const a = sat * Math.min(light, 1 - light); return light - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
  return `#${[channel(0), channel(8), channel(4)].map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}
export function getTextColor(hex: string) { const color = normalizeHex(hex).slice(1); const rgb = [0, 2, 4].map((index) => parseInt(color.slice(index, index + 2), 16) / 255).map((v) => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2] > 0.5 ? "#2B1B3D" : "#FFFFFF"; }
