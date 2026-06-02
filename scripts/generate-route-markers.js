/**
 * Generates inner-content PNGs for the GL-layer route markers:
 *   marker-play.png  (20×20, transparent, green right-pointing triangle)
 *   marker-stop.png  (20×20, transparent, red square)
 *
 * These are used by plan-route-layer.tsx SymbolLayer (placed on top of
 * CircleLayer backgrounds) so markers always render above the route line.
 *
 * Run: node scripts/generate-route-markers.js
 */
const zlib = require('zlib');
const fs   = require('fs');
const path = require('path');

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
function u32(v) { const b = Buffer.alloc(4); b.writeUInt32BE(v >>> 0, 0); return b; }
function chunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  return Buffer.concat([u32(data.length), t, data, u32(crc32(Buffer.concat([t, data])))]);
}
function makePng(width, height, pixels) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; // RGBA
  const rows = Buffer.alloc((1 + width * 4) * height);
  for (let y = 0; y < height; y++) {
    rows[y * (1 + width * 4)] = 0;
    pixels.copy(rows, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(rows, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── Point-in-polygon ─────────────────────────────────────────────────────────
function pip(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi))
      inside = !inside;
  }
  return inside;
}

const OUT = path.join(__dirname, '..', 'assets', 'images');
fs.mkdirSync(OUT, { recursive: true });

// ── marker-play.png — green right-pointing triangle ──────────────────────────
{
  const W = 20, H = 20;
  const px = Buffer.alloc(W * H * 4, 0);
  // Right-pointing triangle; shifted 1 px right for optical centering
  const TRI = [[4, 3], [18, 10], [4, 17]];
  const [r, g, b] = [46, 125, 50]; // #2E7D32
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (pip(x + 0.5, y + 0.5, TRI)) {
        const i = (y * W + x) * 4;
        px[i] = r; px[i+1] = g; px[i+2] = b; px[i+3] = 255;
      }
  const out = path.join(OUT, 'marker-play.png');
  fs.writeFileSync(out, makePng(W, H, px));
  console.log(`✓ marker-play.png written → ${out}`);
}

// ── marker-stop.png — red square ─────────────────────────────────────────────
{
  const W = 20, H = 20;
  const px = Buffer.alloc(W * H * 4, 0);
  const [r, g, b] = [229, 57, 53]; // #e53935
  for (let y = 5; y < 15; y++)
    for (let x = 5; x < 15; x++) {
      const i = (y * W + x) * 4;
      px[i] = r; px[i+1] = g; px[i+2] = b; px[i+3] = 255;
    }
  const out = path.join(OUT, 'marker-stop.png');
  fs.writeFileSync(out, makePng(W, H, px));
  console.log(`✓ marker-stop.png written → ${out}`);
}

// ── marker-start-finish.png — compact oval pill for looped walks ──────────────
// 48×24 px (2:1 ratio — more oval than the old 56×32): white fill, green border,
// play triangle (left) + stop square (right)
{
  const W = 48, H = 24;
  const R_OUT = H / 2 - 0.5; // 11.5 — maximum oval (semicircular ends)
  const R_IN  = R_OUT - 2.5; // 9.0
  const px = Buffer.alloc(W * H * 4, 0); // transparent

  // Point inside rounded rectangle (pill shape) from (0,0) to (W,H) with corner radius r
  function inPill(x, y, r) {
    const cx = Math.max(r, Math.min(W - r, x));
    const cy = Math.max(r, Math.min(H - r, y));
    return Math.hypot(x - cx, y - cy) <= r;
  }

  // Play triangle in left half — right-pointing, green #2E7D32
  const TRI = [[7, 8], [18, 12], [7, 16]];
  const [gr, gg, gb] = [46, 125, 50];  // #2E7D32
  const [rr, rg, rb] = [229, 57, 53];  // #e53935

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) * 4;
      const sx = x + 0.5, sy = y + 0.5;

      if (inPill(sx, sy, R_IN)) {
        // White fill
        px[idx] = 255; px[idx + 1] = 255; px[idx + 2] = 255; px[idx + 3] = 255;
        // Green play triangle (left half)
        if (pip(sx, sy, TRI)) {
          px[idx] = gr; px[idx + 1] = gg; px[idx + 2] = gb;
        }
        // Red stop square (right half): 8×8 centred at (36, 12)
        if (sx >= 32 && sx <= 40 && sy >= 8 && sy <= 16) {
          px[idx] = rr; px[idx + 1] = rg; px[idx + 2] = rb;
        }
      } else if (inPill(sx, sy, R_OUT)) {
        // Green border
        px[idx] = gr; px[idx + 1] = gg; px[idx + 2] = gb; px[idx + 3] = 255;
      }
    }
  }

  const out = path.join(OUT, 'marker-start-finish.png');
  fs.writeFileSync(out, makePng(W, H, px));
  console.log(`✓ marker-start-finish.png written → ${out}`);
}

// ── Full circle helpers ───────────────────────────────────────────────────────
// These are COMPLETE marker images (circle bg + border + inner icon) used in a
// SymbolLayer so they share the same GL render pass as the route arrows, giving
// guaranteed Z-order above LineLayer content.

// ── marker-start-full.png — 32×32, white circle, green border, play triangle ─
{
  const W = 32;
  const CX = W / 2, CY = W / 2, R_OUT = W / 2 - 0.5, R_IN = R_OUT - 2.5;
  const px = Buffer.alloc(W * W * 4, 0);
  const TRI = [[8, 11], [22, 16], [8, 21]]; // right-pointing, offset +1px for optical centre
  const [gr, gg, gb] = [46, 125, 50]; // #2E7D32
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
    const dist = Math.hypot(x + 0.5 - CX, y + 0.5 - CY);
    const i = (y * W + x) * 4;
    if (dist <= R_IN) {
      px[i] = 255; px[i+1] = 255; px[i+2] = 255; px[i+3] = 255;
      if (pip(x + 0.5, y + 0.5, TRI)) { px[i] = gr; px[i+1] = gg; px[i+2] = gb; }
    } else if (dist <= R_OUT) { px[i] = gr; px[i+1] = gg; px[i+2] = gb; px[i+3] = 255; }
  }
  fs.writeFileSync(path.join(OUT, 'marker-start-full.png'), makePng(W, W, px));
  console.log('✓ marker-start-full.png written');
}

// ── marker-finish-full.png — 32×32, white circle, red border, stop square ────
{
  const W = 32;
  const CX = W / 2, CY = W / 2, R_OUT = W / 2 - 0.5, R_IN = R_OUT - 2.5;
  const px = Buffer.alloc(W * W * 4, 0);
  const [rr, rg, rb] = [229, 57, 53]; // #e53935
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
    const dist = Math.hypot(x + 0.5 - CX, y + 0.5 - CY);
    const i = (y * W + x) * 4;
    if (dist <= R_IN) {
      px[i] = 255; px[i+1] = 255; px[i+2] = 255; px[i+3] = 255;
      const sx = x + 0.5, sy = y + 0.5;
      if (sx >= 11 && sx <= 21 && sy >= 11 && sy <= 21) { px[i] = rr; px[i+1] = rg; px[i+2] = rb; }
    } else if (dist <= R_OUT) { px[i] = rr; px[i+1] = rg; px[i+2] = rb; px[i+3] = 255; }
  }
  fs.writeFileSync(path.join(OUT, 'marker-finish-full.png'), makePng(W, W, px));
  console.log('✓ marker-finish-full.png written');
}

// ── marker-waypoint-bg.png — 28×28, white circle, green border, no inner ─────
// Inner content (sequential number) is rendered via SymbolLayer textField.
{
  const W = 28;
  const CX = W / 2, CY = W / 2, R_OUT = W / 2 - 0.5, R_IN = R_OUT - 2.5;
  const px = Buffer.alloc(W * W * 4, 0);
  const [gr, gg, gb] = [46, 125, 50]; // #2E7D32
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
    const dist = Math.hypot(x + 0.5 - CX, y + 0.5 - CY);
    const i = (y * W + x) * 4;
    if (dist <= R_IN) { px[i] = 255; px[i+1] = 255; px[i+2] = 255; px[i+3] = 255; }
    else if (dist <= R_OUT) { px[i] = gr; px[i+1] = gg; px[i+2] = gb; px[i+3] = 255; }
  }
  fs.writeFileSync(path.join(OUT, 'marker-waypoint-bg.png'), makePng(W, W, px));
  console.log('✓ marker-waypoint-bg.png written');
}
