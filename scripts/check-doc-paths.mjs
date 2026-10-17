// Fails when a doc names a file path that doesn't exist, e.g. a module that was renamed or deleted.
// Checks backticked paths with a slash and a file extension, like `services/syncService.ts`,
// resolved from the repo root or from src/. CHANGELOG and ADRs record history, so they are skipped.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const docs = (process.argv.length > 2
  ? process.argv.slice(2)
  : execFileSync('git', ['ls-files', '*.md'], { encoding: 'utf8' }).split('\n')
).filter((file) => file && file !== 'CHANGELOG.md' && !file.startsWith('docs/adr/'));

const PATH = /`([\w.-]+(?:\/[\w.-]+)+\.(?:ts|tsx|js|mjs|json|md|yml))`/g;

const missing = docs.flatMap((doc) =>
  readFileSync(doc, 'utf8')
    .split('\n')
    .flatMap((line, index) =>
      [...line.matchAll(PATH)]
        .map((match) => match[1])
        .filter((path) => !existsSync(path) && !existsSync(`src/${path}`))
        .map((path) => `${doc}:${index + 1}: \`${path}\` does not exist`),
    ),
);

if (missing.length > 0) {
  console.error(`Docs name files that don't exist:\n${missing.join('\n')}`);
  process.exit(1);
}
