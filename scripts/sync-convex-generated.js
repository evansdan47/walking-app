#!/usr/bin/env node
/**
 * Syncs convex/ → webapp/convex/
 *
 * Copies two things:
 *   1. convex/_generated/  → webapp/convex/_generated/   (generated API/types)
 *   2. convex/*.ts         → webapp/convex/               (source files needed
 *                            so that api.d.ts import type * as walks from "../walks.js"
 *                            can resolve and give the webapp full type information)
 *
 * Usage:
 *   node scripts/sync-convex-generated.js          # copy once
 *   node scripts/sync-convex-generated.js --watch  # copy on every change
 */

const fs = require('fs');
const path = require('path');

const SRC_ROOT      = path.resolve(__dirname, '../convex');
const SRC_GENERATED = path.resolve(__dirname, '../convex/_generated');
const DEST_ROOT      = path.resolve(__dirname, '../webapp/convex');
const DEST_GENERATED = path.resolve(__dirname, '../webapp/convex/_generated');

function syncGenerated() {
  fs.mkdirSync(DEST_GENERATED, { recursive: true });
  const entries = fs.readdirSync(SRC_GENERATED, { withFileTypes: true });
  const files = entries.filter(e => e.isFile());
  for (const file of files) {
    fs.copyFileSync(path.join(SRC_GENERATED, file.name), path.join(DEST_GENERATED, file.name));
  }
  console.log(`[sync-convex] copied ${files.length} file(s) → webapp/convex/_generated/`);
}

function copyDirRecursive(srcDir, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  let count = 0;
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      count += copyDirRecursive(srcPath, destPath);
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      fs.copyFileSync(srcPath, destPath);
      count += 1;
    }
  }
  return count;
}

function syncSources() {
  fs.mkdirSync(DEST_ROOT, { recursive: true });
  let count = 0;
  for (const entry of fs.readdirSync(SRC_ROOT, { withFileTypes: true })) {
    if (entry.name === '_generated') continue;
    const srcPath = path.join(SRC_ROOT, entry.name);
    const destPath = path.join(DEST_ROOT, entry.name);
    if (entry.isDirectory()) {
      count += copyDirRecursive(srcPath, destPath);
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      fs.copyFileSync(srcPath, destPath);
      count += 1;
    }
  }
  console.log(`[sync-convex] copied ${count} source file(s) → webapp/convex/`);
}

function syncAll() {
  syncGenerated();
  syncSources();
}

syncAll();

if (process.argv.includes('--watch')) {
  console.log('[sync-convex] watching convex/ for changes…');

  fs.watch(SRC_GENERATED, (eventType, filename) => {
    if (filename) {
      try {
        fs.copyFileSync(path.join(SRC_GENERATED, filename), path.join(DEST_GENERATED, filename));
        console.log(`[sync-convex] updated _generated/${filename}`);
      } catch {
        // file may have been deleted; ignore
      }
    }
  });

  fs.watch(SRC_ROOT, { recursive: true }, (eventType, filename) => {
    if (!filename || !filename.endsWith('.ts') || filename.includes('_generated')) return;
    const srcPath = path.join(SRC_ROOT, filename);
    const destPath = path.join(DEST_ROOT, filename);
    try {
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.copyFileSync(srcPath, destPath);
      console.log(`[sync-convex] updated ${filename}`);
    } catch {
      // file may have been deleted; ignore
    }
  });
}
