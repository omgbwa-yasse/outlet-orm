'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Generate a GitHub-compatible anchor slug from heading text.
 */
function slug(text) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '') // keep letters, numbers, spaces, hyphens
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

/**
 * Extract ## and ### headings from markdown content, skipping code blocks.
 */
function extractHeadings(content) {
  const lines = content.split('\n');
  const headings = [];
  let inCodeBlock = false;

  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    const match = line.match(/^(#{2,3})\s+(.+)/);
    if (match) {
      const level = match[1].length;
      const text = match[2].trim();
      // Skip the TOC heading itself
      if (/^table\s+(of\s+)?contents?$/i.test(text.replace(/[^\p{L}\s]/gu, '').trim())) continue;
      headings.push({ level, text });
    }
  }

  return headings;
}

/**
 * Build a TOC markdown string from headings.
 */
function buildTOC(headings) {
  if (headings.length === 0) return null;

  const lines = ['## Table of Contents', ''];
  for (const h of headings) {
    const indent = h.level === 3 ? '  ' : '';
    lines.push(`${indent}- [${h.text}](#${slug(h.text)})`);
  }
  lines.push('');
  return lines.join('\n');
}

/**
 * Remove an existing TOC section (## Table of Contents/contents) from lines array.
 * Returns the modified lines.
 */
function removeExistingTOC(lines) {
  const tocIdx = lines.findIndex(l => /^##\s+Table\s+of\s+[Cc]ontents?\s*$/.test(l.trim()));
  if (tocIdx === -1) return lines;

  // Find end of TOC: next ## heading (not TOC) or a --- separator after list items
  let endIdx = tocIdx + 1;
  // Skip blank lines after heading
  while (endIdx < lines.length && lines[endIdx].trim() === '') endIdx++;
  // Skip list items and blank lines
  while (endIdx < lines.length) {
    const trimmed = lines[endIdx].trim();
    if (trimmed.startsWith('- [') || trimmed.startsWith('  - [') || trimmed === '') {
      endIdx++;
      continue;
    }
    // Also skip --- separator right after TOC
    if (trimmed === '---') {
      endIdx++;
      // Skip blank line after ---
      if (endIdx < lines.length && lines[endIdx].trim() === '') endIdx++;
    }
    break;
  }

  lines.splice(tocIdx, endIdx - tocIdx);
  return lines;
}

/**
 * Insert TOC into file content and return the new content.
 */
function insertTOC(content) {
  let lines = content.split('\n');

  // Remove existing TOC first
  lines = removeExistingTOC(lines);
  content = lines.join('\n');

  // Extract headings from clean content
  const headings = extractHeadings(content);
  const toc = buildTOC(headings);
  if (!toc) return null;

  // Find insertion point: right before the first ## heading
  lines = content.split('\n');
  let insertIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].match(/^## /)) {
      insertIdx = i;
      break;
    }
  }

  if (insertIdx === -1) return null;

  // Insert TOC + --- separator before the first ## heading
  const tocLines = toc.split('\n');
  tocLines.push('---', '');
  lines.splice(insertIdx, 0, ...tocLines);

  return lines.join('\n');
}

// ── Main ──────────────────────────────────────────────────────────
const root = path.resolve(__dirname, '..');
const docsDir = path.join(root, 'docs');

// Process docs
const docFiles = fs.readdirSync(docsDir).filter(f => f.endsWith('.md'));
for (const file of docFiles) {
  const filePath = path.join(docsDir, file);
  const content = fs.readFileSync(filePath, 'utf8');
  const result = insertTOC(content);
  if (result) {
    fs.writeFileSync(filePath, result, 'utf8');
    console.log(`✅ ${file}`);
  } else {
    console.log(`⏭️  ${file} (no headings)`);
  }
}

// Process README.md
const readmePath = path.join(root, 'README.md');
const readmeContent = fs.readFileSync(readmePath, 'utf8');
const readmeResult = insertTOC(readmeContent);
if (readmeResult) {
  fs.writeFileSync(readmePath, readmeResult, 'utf8');
  console.log(`✅ README.md`);
} else {
  console.log(`⏭️  README.md (no headings)`);
}

console.log('\nDone.');
