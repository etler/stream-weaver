/**
 * Post-build script to fix absolute filesystem paths in built assets
 * Converts paths like /Users/.../demo/src/logic/foo.ts to /assets/foo.js
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const assetsDir = join(__dirname, '../dist/client/assets');

// Get all JS files in assets directory
const files = readdirSync(assetsDir).filter(f => f.endsWith('.js'));

console.log(`Processing ${files.length} files...`);

for (const file of files) {
  const filePath = join(assetsDir, file);
  let content = readFileSync(filePath, 'utf8');

  // Replace absolute filesystem paths with /assets/ URLs
  // Match patterns like: /Users/foo/Projects/stream-weaver/demo/src/logic/bar.ts
  // Replace with: /assets/bar.js
  const originalContent = content;
  content = content.replace(
    /\/[^"']*\/demo\/src\/(logic|components)\/([^"']+)\.tsx?/g,
    '/assets/$2.js'
  );

  if (content !== originalContent) {
    writeFileSync(filePath, content, 'utf8');
    console.log(`  Fixed paths in ${file}`);
  }
}

console.log('Done!');
