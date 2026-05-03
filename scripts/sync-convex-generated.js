#!/usr/bin/env node
/**
 * Syncs convex/_generated/ → webapp/convex/_generated/
 *
 * Usage:
 *   node scripts/sync-convex-generated.js          # copy once
 *   node scripts/sync-convex-generated.js --watch  # copy on every change
 */

const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '../convex/_generated');
const DEST = path.resolve(__dirname, '../webapp/convex/_generated');

function syncAll() {
  fs.mkdirSync(DEST, { recursive: true });
  const entries = fs.readdirSync(SRC, { withFileTypes: true });
  const files = entries.filter(e => e.isFile());
  for (const file of files) {
    fs.copyFileSync(path.join(SRC, file.name), path.join(DEST, file.name));
  }
  console.log(`[sync-convex] copied ${files.length} file(s) → webapp/convex/_generated/`);
}

syncAll();

if (process.argv.includes('--watch')) {
  console.log('[sync-convex] watching convex/_generated/ for changes…');
  fs.watch(SRC, (eventType, filename) => {
    if (filename) {
      try {
        fs.copyFileSync(path.join(SRC, filename), path.join(DEST, filename));
        console.log(`[sync-convex] updated ${filename}`);
      } catch {
        // file may have been deleted; ignore
      }
    }
  });
}
