import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as lucide from 'lucide-react';

const groups = {
  navigation: ['ArrowDownWideNarrow', 'ChevronDown', 'ChevronLeft', 'ChevronRight', 'FileText', 'Folder', 'FolderPlus', 'LayoutGrid', 'Menu', 'Search'],
  editor: ['AlignCenter', 'AlignJustify', 'AlignLeft', 'AlignRight', 'Bold', 'CheckSquare', 'Italic', 'List', 'ListOrdered', 'Maximize2', 'Minimize2', 'Palette', 'Strikethrough', 'Type', 'Underline'],
  notes: ['Pin', 'PinOff', 'RotateCcw', 'Trash2'],
  account: ['Eye', 'EyeOff', 'LogOut', 'Moon', 'Sun'],
  interface: ['ArrowUpRight', 'Check', 'CheckCheck', 'Plus', 'X'],
};
const kebab = (value) => value.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
const entries = [];
for (const [group, names] of Object.entries(groups)) {
  fs.mkdirSync(path.join('public', 'icons', group), { recursive: true });
  for (const name of names) {
    if (!lucide[name]) throw new Error(`Missing icon: ${name}`);
    const svg = renderToStaticMarkup(React.createElement(lucide[name]));
    const content = svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
    const filename = `${kebab(name)}.svg`;
    const asset = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><g id="icon">${content}</g></svg>\n`;
    fs.writeFileSync(path.join('public', 'icons', group, filename), asset);
    entries.push([name, `/icons/${group}/${filename}`]);
  }
}
fs.copyFileSync('node_modules/lucide-react/LICENSE', 'public/icons/LICENSE.txt');
const iconExports = entries.map(([name, asset]) => `export const ${name} = createAssetIcon("${name}", "${asset}");`).join('\n');
const component = `import { forwardRef } from "react";
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

${iconExports}
`;
fs.writeFileSync('components/Icon.tsx', component);
console.log(`Extracted ${entries.length} icons into categorized public asset folders.`);
