import { forwardRef } from "react";
import type { HTMLAttributes, SVGProps } from "react";

export type IconProps = SVGProps<SVGSVGElement> & {
  size?: number | string;
  absoluteStrokeWidth?: boolean;
};

// The drawing data lives in public/icons; <use> preserves currentColor and
// the existing SVG styling, including the filled state of pinned notes.
function createAssetIcon(name: string, asset: string) {
  const AssetIcon = forwardRef<SVGSVGElement, IconProps>(function AssetIcon({
    size = 24, width, height, color = "currentColor", strokeWidth = 2,
    absoluteStrokeWidth = false, className, children, ...props
  }, ref) {
    const hasLabel = Boolean(props["aria-label"] || props["aria-labelledby"] || children);
    return <svg ref={ref} xmlns="http://www.w3.org/2000/svg" width={width ?? size} height={height ?? size}
      viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth={absoluteStrokeWidth ? Number(strokeWidth) * 24 / Number(size) : strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" className={["app-icon", className].filter(Boolean).join(" ")}
      aria-hidden={hasLabel ? undefined : true} {...props}>
      <use href={asset + "#icon"} />{children}
    </svg>;
  });
  AssetIcon.displayName = name;
  return AssetIcon;
}

export function BrandMark({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={["brand-mark", className].filter(Boolean).join(" ")} {...props}>
    <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 35 35" aria-hidden="true"><use href="/brand/notely-logo.svg#mark" /></svg>
  </span>;
}

export const ArrowDownWideNarrow = createAssetIcon("ArrowDownWideNarrow", "/icons/navigation/arrow-down-wide-narrow.svg");
export const ChevronDown = createAssetIcon("ChevronDown", "/icons/navigation/chevron-down.svg");
export const ChevronLeft = createAssetIcon("ChevronLeft", "/icons/navigation/chevron-left.svg");
export const ChevronRight = createAssetIcon("ChevronRight", "/icons/navigation/chevron-right.svg");
export const FileText = createAssetIcon("FileText", "/icons/navigation/file-text.svg");
export const Folder = createAssetIcon("Folder", "/icons/navigation/folder.svg");
export const FolderPlus = createAssetIcon("FolderPlus", "/icons/navigation/folder-plus.svg");
export const LayoutGrid = createAssetIcon("LayoutGrid", "/icons/navigation/layout-grid.svg");
export const Menu = createAssetIcon("Menu", "/icons/navigation/menu.svg");
export const Search = createAssetIcon("Search", "/icons/navigation/search.svg");
export const AlignCenter = createAssetIcon("AlignCenter", "/icons/editor/align-center.svg");
export const AlignJustify = createAssetIcon("AlignJustify", "/icons/editor/align-justify.svg");
export const AlignLeft = createAssetIcon("AlignLeft", "/icons/editor/align-left.svg");
export const AlignRight = createAssetIcon("AlignRight", "/icons/editor/align-right.svg");
export const Bold = createAssetIcon("Bold", "/icons/editor/bold.svg");
export const CheckSquare = createAssetIcon("CheckSquare", "/icons/editor/check-square.svg");
export const Italic = createAssetIcon("Italic", "/icons/editor/italic.svg");
export const List = createAssetIcon("List", "/icons/editor/list.svg");
export const ListOrdered = createAssetIcon("ListOrdered", "/icons/editor/list-ordered.svg");
export const Maximize2 = createAssetIcon("Maximize2", "/icons/editor/maximize2.svg");
export const Minimize2 = createAssetIcon("Minimize2", "/icons/editor/minimize2.svg");
export const Palette = createAssetIcon("Palette", "/icons/editor/palette.svg");
export const Strikethrough = createAssetIcon("Strikethrough", "/icons/editor/strikethrough.svg");
export const Type = createAssetIcon("Type", "/icons/editor/type.svg");
export const Underline = createAssetIcon("Underline", "/icons/editor/underline.svg");
export const Pin = createAssetIcon("Pin", "/icons/notes/pin.svg");
export const PinOff = createAssetIcon("PinOff", "/icons/notes/pin-off.svg");
export const RotateCcw = createAssetIcon("RotateCcw", "/icons/notes/rotate-ccw.svg");
export const Trash2 = createAssetIcon("Trash2", "/icons/notes/trash2.svg");
export const Eye = createAssetIcon("Eye", "/icons/account/eye.svg");
export const EyeOff = createAssetIcon("EyeOff", "/icons/account/eye-off.svg");
export const LogOut = createAssetIcon("LogOut", "/icons/account/log-out.svg");
export const Moon = createAssetIcon("Moon", "/icons/account/moon.svg");
export const Sun = createAssetIcon("Sun", "/icons/account/sun.svg");
export const ArrowUpRight = createAssetIcon("ArrowUpRight", "/icons/interface/arrow-up-right.svg");
export const Check = createAssetIcon("Check", "/icons/interface/check.svg");
export const CheckCheck = createAssetIcon("CheckCheck", "/icons/interface/check-check.svg");
export const Plus = createAssetIcon("Plus", "/icons/interface/plus.svg");
export const X = createAssetIcon("X", "/icons/interface/x.svg");
