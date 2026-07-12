/**
 * Node ESM loader hook: resolves '@/...' specifiers to 'src/...' so plain
 * `node` scripts can import the real src/lib modules directly (no bundler),
 * instead of hand-copying logic into the script (which drifts from source).
 * Registered via scripts/register-src-aliases.mjs.
 */
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPTS_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPTS_DIR, '..');

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    const full = path.join(ROOT, 'src', specifier.slice(2));
    return nextResolve(pathToFileURL(full).href + '.js', context);
  }
  // Plain Node ESM requires explicit extensions; the src tree omits them on
  // relative imports (bundler-style). Retry with '.js' before giving up.
  if (specifier.startsWith('.') && !path.extname(specifier)) {
    try {
      return await nextResolve(specifier, context);
    } catch (err) {
      if (err?.code === 'ERR_MODULE_NOT_FOUND') {
        return nextResolve(`${specifier}.js`, context);
      }
      throw err;
    }
  }
  return nextResolve(specifier, context);
}
