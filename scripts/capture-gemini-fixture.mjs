// Records Gemini's raw receipt JSON for one receipt file as a Receipt intake test fixture.
// Usage: npm run capture:gemini -- <receipt-file> [fixture-name]
// Needs GEMINI_API_KEY in .env. Review the output before committing: it holds real receipt data.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import { parseReceiptImage } from '../src/services/geminiService.ts';

const MIME_TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.heic': 'image/heic',
  '.heif': 'image/heif',
  '.pdf': 'application/pdf',
};

const [file, name] = process.argv.slice(2);
if (!file) {
  console.error('Usage: npm run capture:gemini -- <receipt-file> [fixture-name]');
  process.exit(1);
}

const mimeType = MIME_TYPES[extname(file).toLowerCase()];
if (!mimeType) {
  console.error(`Unsupported file type: ${extname(file)}`);
  process.exit(1);
}

const dataUrl = `data:${mimeType};base64,${(await readFile(file)).toString('base64')}`;
const raw = await parseReceiptImage(dataUrl, mimeType);

const dir = join(import.meta.dirname, '..', 'src', 'services', '__fixtures__', 'gemini');
const out = join(dir, `${name ?? basename(file, extname(file))}.json`);
await mkdir(dir, { recursive: true });
await writeFile(out, JSON.stringify(raw, null, 2) + '\n');
console.log(`Wrote ${out}`);
