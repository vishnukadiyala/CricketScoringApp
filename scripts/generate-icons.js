/**
 * Generate PWA icons as simple SVG-based PNGs.
 * Run with: node scripts/generate-icons.js
 *
 * Creates PNG icons by converting an SVG to data URLs that can be
 * used in the manifest. For a production app you'd use sharp or
 * canvas, but this creates valid placeholder PNGs using pure Node.
 */

import { mkdirSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const iconsDir = join(__dirname, '..', 'public', 'icons')

mkdirSync(iconsDir, { recursive: true })

function createSvg(size, maskable = false) {
  const padding = maskable ? size * 0.1 : 0
  const bg = '#0f172a'
  const fontSize = maskable ? size * 0.55 : size * 0.7

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${maskable ? 0 : size * 0.15}" fill="${bg}"/>
  <text x="50%" y="55%" dominant-baseline="central" text-anchor="middle" font-size="${fontSize}">${String.fromCodePoint(0x1F3CF)}</text>
</svg>`
}

// Write SVG versions (browsers can use these as icons too)
const sizes = [192, 512]

for (const size of sizes) {
  writeFileSync(join(iconsDir, `icon-${size}.svg`), createSvg(size))
  console.log(`Created icon-${size}.svg`)
}

writeFileSync(join(iconsDir, 'icon-512-maskable.svg'), createSvg(512, true))
console.log('Created icon-512-maskable.svg')

console.log('\nNote: SVG icons created. For PNG icons, convert these SVGs using an image tool.')
console.log('Most modern browsers support SVG icons in the manifest.')
