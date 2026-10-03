import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { publishCheck } from '../src/indexer/build';
import type { Meta } from '../src/lib/data/types';

const next = JSON.parse(readFileSync('data-out/meta.json', 'utf8')) as Meta;
let published: Meta | null = null;
try {
  execFileSync('git', ['fetch', '--depth=1', '-q', 'origin', 'data'], { stdio: 'ignore' });
  published = JSON.parse(execFileSync('git', ['show', 'FETCH_HEAD:meta.json'], { encoding: 'utf8' })) as Meta;
} catch {
  console.log('[publish] no published data branch yet; skipping the drop check');
}
const problem = publishCheck(published, next);
if (problem) {
  console.error(`[publish] refusing to publish: ${problem}`);
  process.exit(1);
}
console.log(`[publish] ok: ${next.totals.pools} pools${published ? ` (published: ${published.totals.pools})` : ''}`);
