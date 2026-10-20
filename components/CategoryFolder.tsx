import { Folder } from "./Icon";
import { DEFAULT_CATEGORY_COLOR, getTextColor, isValidHex, normalizeHex } from "../lib/colors";
import type { Category } from "../lib/types";

export default function CategoryFolder({ category, size = 17 }: { category?: Category; size?: number }) {
  const color = category?.color && isValidHex(category.color) ? normalizeHex(category.color) : DEFAULT_CATEGORY_COLOR;
  const channels = [1, 3, 5].map((index) => Math.round(parseInt(color.slice(index, index + 2), 16) * .5));
  const outline = getTextColor(color) === "#FFFFFF" ? "#BBAFCB" : "rgb(" + channels.join(", ") + ")";
  return <Folder className="category-folder" size={size} style={{ fill: color, color: outline }} />;
}
