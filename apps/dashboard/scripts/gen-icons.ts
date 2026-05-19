/**
 * One-shot icon generator: renders the source SVG into the PNG variants that
 * iOS Safari, Android Chrome, and the PWA manifest need.
 *
 * Run: `pnpm tsx apps/dashboard/scripts/gen-icons.ts`
 *
 * Adds a maskable variant by drawing the source over a cream background that
 * fills the inner safe area, so Android's adaptive-icon clipping doesn't crop
 * the mark.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { Resvg } from '@resvg/resvg-js';

const here = path.dirname(new URL(import.meta.url).pathname);
const publicDir = path.resolve(here, '..', 'public', 'icons');
const sourcePath = path.resolve(publicDir, 'source.svg');

const sourceSvg = readFileSync(sourcePath, 'utf8');

const render = (svg: string, size: number, out: string) => {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: size },
    background: '#faf3e3',
  });
  const png = resvg.render().asPng();
  writeFileSync(path.join(publicDir, out), png);
  console.log(`wrote icons/${out} (${size}x${size}, ${png.byteLength} bytes)`);
};

/**
 * Maskable icon — wraps the same "B" mark in a larger cream padded canvas so
 * the glyph survives Android's circular/squircle clipping. Outer 10% on each
 * side is reserved per the W3C maskable spec.
 */
const maskableSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#faf3e3"/>
  <g transform="translate(160 132) scale(1.625)" fill="none" stroke="#b88a1c" stroke-width="20" stroke-linecap="round" stroke-linejoin="round">
    <path d="M5 4h70a40 40 0 0 1 0 60H5z"/>
    <path d="M5 64h80a40 40 0 0 1 0 60H5z"/>
  </g>
</svg>`;

render(sourceSvg, 192, 'icon-192.png');
render(sourceSvg, 512, 'icon-512.png');
render(maskableSvg, 512, 'icon-maskable-512.png');
render(sourceSvg, 180, 'apple-touch-icon.png');
