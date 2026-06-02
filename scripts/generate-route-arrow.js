/**
 * Generates assets/images/route-arrow.png
 * A 36×36 direction-arrow circle:
 *   - Thin white outer ring (1.5 px border)
 *   - Solid deep-blue fill #1565C0 (full opacity)
 *   - White right-pointing navigation arrow centred inside
 *
 * Mapbox SymbolLayer will auto-rotate this to follow the line direction.
 *
 * Run: node scripts/generate-route-arrow.js
 */
const zlib = require('zlib');
const fs   = require('fs');
const path = require('path');

const WIDTH  = 36;
const HEIGHT = 36;
const CX     = 18;    // centre x
const CY     = 18;    // centre y
const R_OUT  = 17.0;  // outer edge (fills to 1px from image edge)
const R_IN   = 15.5;  // inner edge of white border ring (1.5 px ring)

// Right-pointing navigation arrow with concave back — scaled 50 % around centre (18,18).
// Mapbox rotates the whole icon to align with route direction.
const ARROW = [[24, 18], [14, 14], [16, 18], [14, 22]];

// ── Point-in-polygon (ray casting) ──────────────────────────────────────────
function pip(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1];
    const xj = poly[j][0], yj = poly[j][1];
    if (((yi > py) !== (yj > py)) &&
        (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

// ── Rasterize ────────────────────────────────────────────────────────────────
// Deep blue: #1565C0 = rgb(21, 101, 192) — full opacity
const BLUE_R = 21, BLUE_G = 101, BLUE_B = 192, BLUE_A = 255;

const pixels = Buffer.alloc(WIDTH * HEIGHT * 4, 0); // default: transparent
for (let y = 0; y < HEIGHT; y++) {
  for (let x = 0; x < WIDTH; x++) {
    const px = x + 0.5, py = y + 0.5;
    const dx = px - CX,  dy = py - CY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const idx  = (y * WIDTH + x) * 4;

    if (dist <= R_IN) {
      if (pip(px, py, ARROW)) {
        // White arrow — fully opaque
        pixels[idx]     = 255;
        pixels[idx + 1] = 255;
        pixels[idx + 2] = 255;
        pixels[idx + 3] = 255;
      } else {
        // Solid deep-blue fill
        pixels[idx]     = BLUE_R;
        pixels[idx + 1] = BLUE_G;
        pixels[idx + 2] = BLUE_B;
        pixels[idx + 3] = BLUE_A;
      }
    } else if (dist <= R_OUT) {
      // White border ring — fully opaque
      pixels[idx]     = 255;
      pixels[idx + 1] = 255;
      pixels[idx + 2] = 255;
      pixels[idx + 3] = 255;
    }
    // else: transparent (alpha stays 0)
  }
}

// ── Minimal PNG encoder ──────────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (const b of buf) crc = CRC_TABLE[(crc ^ b) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function u32(v) {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(v >>> 0, 0);
  return b;
}

function chunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const crc = crc32(Buffer.concat([t, data]));
  return Buffer.concat([u32(data.length), t, data, u32(crc)]);
}

// IHDR
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(WIDTH,  0);
ihdr.writeUInt32BE(HEIGHT, 4);
ihdr[8]  = 8; // bit depth
ihdr[9]  = 6; // RGBA
ihdr[10] = 0; // compression
ihdr[11] = 0; // filter
ihdr[12] = 0; // interlace

// Raw scanlines: filter byte (0=None) + pixel row
const scanlines = Buffer.alloc((1 + WIDTH * 4) * HEIGHT);
for (let y = 0; y < HEIGHT; y++) {
  const offset = y * (1 + WIDTH * 4);
  scanlines[offset] = 0; // filter None
  pixels.copy(scanlines, offset + 1, y * WIDTH * 4, (y + 1) * WIDTH * 4);
}

const idat = zlib.deflateSync(scanlines, { level: 9 });

const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), // signature
  chunk('IHDR', ihdr),
  chunk('IDAT', idat),
  chunk('IEND', Buffer.alloc(0)),
]);

const outDir = path.join(__dirname, '..', 'assets', 'images');
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'route-arrow.png');
fs.writeFileSync(outPath, png);
console.log(`✓ route-arrow.png written (${png.length} bytes) → ${outPath}`);
