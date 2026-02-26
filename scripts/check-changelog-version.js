#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const packageJsonPath = path.join(root, 'package.json');
const changelogPath = path.join(root, 'CHANGELOG.md');

function fail(message) {
  console.error(`❌ ${message}`);
  process.exit(1);
}

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const changelog = fs.readFileSync(changelogPath, 'utf8');

const packageVersion = packageJson.version;
const versionHeaderMatch = changelog.match(/^##\s+\[(\d+\.\d+\.\d+(?:-[^\]]+)?)\]/m);

if (!versionHeaderMatch) {
  fail('Unable to find a version header in CHANGELOG.md (expected format: ## [x.y.z]).');
}

const changelogVersion = versionHeaderMatch[1];

if (changelogVersion !== packageVersion) {
  fail(
    `Version mismatch: package.json is ${packageVersion} but top CHANGELOG version is ${changelogVersion}.`
  );
}

console.log(`✅ Version check passed: ${packageVersion}`);
