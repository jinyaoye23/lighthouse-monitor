// ============================================================
// Copy serverExternalPackages into Next.js standalone .pnpm store.
//
// Next.js outputFileTracing (nft) does NOT trace packages listed in
// serverExternalPackages, so lighthouse / chrome-launcher / etc.
// are missing from standalone node_modules after build.
//
// This script copies them from the build-time .pnpm store into the
// standalone output and creates the node_modules symlinks so that
// `require('lighthouse')` resolves correctly at runtime.
// ============================================================

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const PNPM_DIR = path.join(root, 'node_modules', '.pnpm');
const DEST_BASE = path.join(root, '.next', 'standalone', 'node_modules');
const DEST_PNPM = path.join(DEST_BASE, '.pnpm');

const PACKAGES = ['lighthouse', 'chrome-launcher', 'chrome-remote-interface'];

for (const pkg of PACKAGES) {
  const entries = fs.readdirSync(PNPM_DIR).filter(d => d.startsWith(pkg + '@'));

  for (const entry of entries) {
    const src = path.join(PNPM_DIR, entry, 'node_modules', pkg);
    const dest = path.join(DEST_PNPM, entry, 'node_modules', pkg);

    if (fs.existsSync(src) && !fs.existsSync(dest)) {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.cpSync(src, dest, { recursive: true });
      console.log(`Copied ${entry} → standalone store`);
    }

    // Symlink at node_modules root so Node.js resolves require(pkg)
    const link = path.join(DEST_BASE, pkg);
    if (!fs.existsSync(link)) {
      fs.symlinkSync(
        path.join('.pnpm', entry, 'node_modules', pkg),
        link,
        'dir',
      );
      console.log(`Symlink: node_modules/${pkg}`);
    }
  }
}

console.log('serverExternalPackages copy complete.');
