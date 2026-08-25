// Draws the GFGHub badge to PNG at 16/48/128px using only Node's zlib — the
// sandbox has no rsvg/ImageMagick, and Chrome needs PNG (not SVG) for manifest
// icons and notification iconUrls. This script IS the icon's source of truth
// (it draws the glyph in code); re-run after changing the design constants
// below:  node scripts/gen-icons.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const publicDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public');

// Design in a 128x128 space: a rounded green badge with a
// white git-branch glyph (trunk + branch to a second node = "commit solutions").
const GREEN = [47, 141, 70]; // #2f8d46
const CORNER = 28;
const NODE_R = 11;
const STROKE = 9;
const NODES = [
  [45, 41],
  [45, 87],
  [83, 41],
];
const SEGS = [
  [45, 47, 45, 81], // trunk
  [45, 62, 83, 45], // branch
];
const SS = 4; // supersample factor for anti-aliasing

const distSeg = (px, py, x1, y1, x2, y2) => {
  const dx = x2 - x1,
    dy = y2 - y1;
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
};

function insideBadge(x, y, k) {
  const r = CORNER * k,
    s = 128 * k;
  if (x >= r && x <= s - r) return y >= 0 && y <= s;
  if (y >= r && y <= s - r) return x >= 0 && x <= s;
  const cx = x < r ? r : s - r,
    cy = y < r ? r : s - r;
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

function isWhite(x, y, k) {
  for (const [cx, cy] of NODES) if (Math.hypot(x - cx * k, y - cy * k) <= NODE_R * k) return true;
  for (const [x1, y1, x2, y2] of SEGS)
    if (distSeg(x, y, x1 * k, y1 * k, x2 * k, y2 * k) <= (STROKE * k) / 2) return true;
  return false;
}

/** RGBA pixel buffer for one icon size, supersampled then box-downsampled. */
function render(size) {
  const D = size * SS;
  const k = D / 128;
  const out = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0,
        g = 0,
        b = 0,
        a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = x * SS + sx + 0.5,
            py = y * SS + sy + 0.5;
          if (!insideBadge(px, py, k)) continue;
          a += 255;
          if (isWhite(px, py, k)) {
            r += 255;
            g += 255;
            b += 255;
          } else {
            r += GREEN[0];
            g += GREEN[1];
            b += GREEN[2];
          }
        }
      }
      const n = SS * SS;
      const i = (y * size + x) * 4;
      const cov = a / 255; // subsamples that were opaque
      // Average color over the OPAQUE subsamples so edges don't darken toward black.
      out[i] = cov ? Math.round(r / cov) : 0;
      out[i + 1] = cov ? Math.round(g / cov) : 0;
      out[i + 2] = cov ? Math.round(b / cov) : 0;
      out[i + 3] = Math.round(a / n);
    }
  }
  return out;
}

// --- minimal PNG (RGBA, filter 0) -------------------------------------------
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function chunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}
function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const stride = 1 + size * 4;
  const raw = Buffer.alloc(size * stride);
  for (let y = 0; y < size; y++) rgba.copy(raw, y * stride + 1, y * size * 4, (y + 1) * size * 4);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const size of [16, 48, 128]) {
  const file = resolve(publicDir, `icon-${size}.png`);
  writeFileSync(file, encodePng(size, render(size)));
  // Self-check: valid signature + IHDR dimensions read back.
  const b = readFileSync(file);
  const sigOk = b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const w = b.readUInt32BE(16),
    h = b.readUInt32BE(20);
  if (!sigOk || w !== size || h !== size) throw new Error(`bad PNG for ${size}: sig=${sigOk} ${w}x${h}`);
  console.log(`✓ icon-${size}.png (${b.length} bytes, ${w}x${h})`);
}
