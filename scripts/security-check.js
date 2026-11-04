'use strict';

/**
 * Lightweight repository security gate.
 *
 * This is intentionally dependency-free so it runs everywhere. It focuses on
 * the highest-signal issues for this package:
 *   - committed credentials / private keys
 *   - dangerous dynamic code execution in src/ and bin/
 *
 * For deeper checks, CI should also run Semgrep/CodeQL and an SCA scanner.
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SKIP = new Set(['package-lock.json']);
const SECRET_PATTERNS = [
  /sk-[A-Za-z0-9]{20,}/,
  /AKIA[0-9A-Z]{16}/,
  /ghp_[A-Za-z0-9]{20,}/,
  /xox[baprs]-[A-Za-z0-9-]{10,}/,
  /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/
];

function trackedFiles() {
  const out = execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' });
  return out.split(/\r?\n/).filter(Boolean);
}

const findings = [];

for (const file of trackedFiles()) {
  if (SKIP.has(file)) continue;
  if (/\.(png|jpg|jpeg|gif|webp|ico|zip|gz|tgz|pdf|woff2?|ttf|eot)$/i.test(file)) continue;
  if (file.startsWith('node_modules/')) continue;

  let content;
  try {
    content = fs.readFileSync(path.join(ROOT, file), 'utf8');
  } catch (_) {
    continue;
  }

  const lines = content.split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const pattern of SECRET_PATTERNS) {
      if (pattern.test(line)) {
        findings.push(`${file}:${index + 1}: possible committed secret`);
        break;
      }
    }
  });

  if (/^(src|bin)\//.test(file) && /\.(c|m)?js$/.test(file)) {
    lines.forEach((line, index) => {
      if (/\beval\s*\(|new\s+Function\s*\(/.test(line)) {
        findings.push(`${file}:${index + 1}: dynamic code execution (eval/new Function)`);
      }
    });
  }
}

if (findings.length > 0) {
  console.error('Security check failed:\n' + findings.map(f => `  - ${f}`).join('\n'));
  process.exit(1);
}

console.log('Security check passed: no committed secrets or dynamic code execution found.');
