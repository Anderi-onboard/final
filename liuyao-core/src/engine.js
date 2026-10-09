/* Loads the casting engine (vendor/liuyao-engine.js) in Node.
   The engine is written for the browser and publishes window.BWLiuYao; this
   runs it in a sandbox and returns that object. Arrays it returns come from the
   sandbox's realm, so anything built from them copies them first. */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const ENGINE_FILE = resolve(HERE, '../vendor/liuyao-engine.js');

let cached = null;

export function loadEngine() {
  if (cached) return cached;
  const sandbox = { window: {}, console, Date };
  sandbox.window.window = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(ENGINE_FILE, 'utf8'), sandbox, { filename: 'liuyao-engine.js' });
  if (!sandbox.window.BWLiuYao) throw new Error('engine did not publish window.BWLiuYao');
  cached = sandbox.window.BWLiuYao;
  return cached;
}
