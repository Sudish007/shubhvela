// CLI: npx tsx packages/content-tools/src/cli.ts --lang hi|bho|both --domains all|rules,festivals --max-requests 450 [--batch A]
// Reads GEMINI_API_KEY from the environment once; the key is never printed, never written (diagnostic.json is redacted).
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_MAX_REQUESTS, translateAll, type TargetLang } from './translate';

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) return process.argv[i + 1];
  const eq = process.argv.find((a) => a.startsWith(`--${name}=`));
  return eq ? eq.slice(name.length + 3) : fallback;
}

async function main(): Promise<number> {
  const HERE = dirname(fileURLToPath(import.meta.url));
  const toolsRoot = resolve(HERE, '..');
  const contentRoot = resolve(HERE, '../../content');
  // Default hi: the owner decided (2026-10-25) that the corpus is not machine-translated into Bhojpuri in v1.
  const langArg = arg('lang', 'hi');
  const langs: TargetLang[] = langArg === 'both' ? ['hi', 'bho'] : langArg === 'hi' || langArg === 'bho' ? [langArg] : [];
  if (!langs.length) {
    console.error(`translate: --lang must be hi, bho or both (got "${langArg}")`);
    return 2;
  }
  const domainsArg = arg('domains', 'all');
  const domains = domainsArg === 'all' ? ('all' as const) : domainsArg.split(',').map((s) => s.trim()).filter(Boolean);
  const maxRequests = Number(arg('max-requests', String(DEFAULT_MAX_REQUESTS)));
  if (!Number.isFinite(maxRequests) || maxRequests < 1 || maxRequests > DEFAULT_MAX_REQUESTS) {
    console.error(`translate: --max-requests must be 1..${DEFAULT_MAX_REQUESTS} (free-tier daily budget)`);
    return 2;
  }
  const batchLabel = arg('batch', '') || undefined;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('translate: GEMINI_API_KEY is not set (GitHub secret or local env var); nothing was sent.');
    return 3;
  }
  const budget = { remaining: maxRequests };
  let failed = false;
  for (const lang of langs) {
    if (budget.remaining <= 0) break;
    const diag = await translateAll({
      lang,
      domains,
      maxRequests: budget.remaining,
      contentRoot,
      toolsRoot,
      apiKey,
      fetch: globalThis.fetch,
      batchLabel,
      log: (line) => console.log(`[${lang}] ${line}`),
    });
    budget.remaining -= diag.requests;
    const total = Object.values(diag.translated).reduce((a, b) => a + b, 0);
    console.log(`[${lang}] requests ${diag.requests}, translated ${total}, rejected ${diag.rejected.length}, errors ${diag.errors.length}${diag.stoppedAtCap ? ', STOPPED AT CAP (cursor saved)' : ''}${diag.reviewQueue ? `, review queue ${diag.reviewQueue}` : ''}`);
    if (diag.errors.length) failed = true;
  }
  return failed ? 1 : 0;
}

main().then(
  (code) => process.exit(code),
  (e) => {
    console.error('translate: ' + String((e as Error).message ?? e).replace(/AIza[0-9A-Za-z_-]{30,}/g, 'AIza[redacted]'));
    process.exit(1);
  },
);
