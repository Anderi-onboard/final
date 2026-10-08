/**
 * CRISIS ROUTE CONTRACT
 *
 * Someone typing 我不想活了 must see the helpline numbers. Measured against
 * production before this file existed, they saw "The reading stopped partway —
 * you're charged for the words that arrived, so the balance above is already
 * final."
 *
 * The path had three correct halves and one wrong join. The server gates
 * crisis before any model call and returns the resources as JSON 200 — no
 * generation, no charge. The client asks for `stream: true`, so
 * makeStreamComplete checked `!r.ok || !r.body`, and a JSON 200 fails neither
 * test. It fell through to the SSE reader, which finds no `data:` records and
 * resolves with "". Upstream, "" is "empty reading from pipeline", which
 * renders through the generic failure copy.
 *
 * Nothing errored. The one path where silence is most expensive was the one
 * that failed silently.
 *
 * This is the kind of defect eval/run-eval.js existed to catch. It was deleted
 * on 2026-08-14 when the prompt moved server-side, and behavioural accuracy has
 * had no coverage since: the other contracts assert that rules are PRESENT in
 * the prompt text, not that the system BEHAVES correctly. This one runs the
 * real module against a stubbed response, offline and free.
 *
 * Run: node tests/crisis-route.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');

const CRISIS_TEXT = "I need to pause here. If you're in crisis or thinking about harming "
  + 'yourself or others, please reach out now:\n\n• US/Canada: 988\n• UK/Ireland: 116 123';

// ── load the real client modules, with only fetch and the DOM stubbed ──────
function loadRouter(respond) {
  const sandbox = {
    console: { log() {}, warn() {}, error() {} },
    setTimeout, clearTimeout, setInterval, clearInterval,
    TextDecoder, TextEncoder, ReadableStream, Response, Headers,
    Promise, JSON, Math, Date, Object, Array, String, Number, RegExp, Error,
    document: {
      createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }),
      head: { appendChild() {} }, body: { appendChild() {} },
      querySelector: () => null, querySelectorAll: () => [],
      documentElement: { dataset: {}, style: { setProperty() {}, removeProperty() {} } },
      addEventListener() {}
    },
    navigator: { language: 'en' },
    location: { origin: 'https://example.test' },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    fetch: respond
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  /* One script, not four: a script's top-level const is script-scoped, so
     loading these separately hides prompt-checks' constants from the router. */
  /* ⚠️ 2026-09-14 起还要带上这三个:老链路作废之后,`interpretWithRouter` 少一块
     就直接抛「四节点管线缺件」。这不是测试的负担,是测试终于测到了真实装配 ——
     从前它在一个缺三个模块的世界里也能绿。 */
  const bundle = ['liuyao-engine.js', 'liuyao-verdict.js', 'liuyao-relations.js',
                  'liuyao-features.js', 'prompt-checks.js', 'liuyao-ai.js', 'prompt-router.js']
    .map((f) => readFileSync(`${ROOT}/${f}`, 'utf8')).join('\n;\n');
  vm.runInContext(bundle, sandbox, { filename: 'bundle.js' });
  return sandbox;
}

const board = (() => {
  const s = loadRouter(() => Promise.reject(new Error('no call expected')));
  return s.BWLiuYao.computeBoard({
    lines: [1, 0, 1, 1, 0, 0].map((v) => ({ yang: !!v })), changeIdx: [2]
  });
})();

/* ── the crisis answer must reach the reader ───────────────────────────────
   ⚠️ **2026-09-14 起它停在更早的地方。** 老链路是一次调用,所以危机只能在那
   一次(流式)上被认出来;四节点里 M1 第一个跑,危机在**它**身上就返回了。
   这比原来好:一个说自己想死的人,不会先被路由进「婚恋库」再被拦下来。
   所以下面数的是「后面三站一次都没发」,而不再是「那一次是流式的」。 */
const rolesCalled = [];
const win = loadRouter((url, init) => {
  const payload = JSON.parse(init.body);
  rolesCalled.push(payload.role || '(no role)');
  // Exactly what functions/api/claude.js returns for built.route === 'crisis'.
  return Promise.resolve(new Response(
    JSON.stringify({ route: 'crisis', crisis: true, text: CRISIS_TEXT, model: null }),
    { status: 200, headers: { 'content-type': 'application/json' } }
  ));
});

let delivered = '';
const result = await win.BWPromptRouter.interpret({
  question: 'I do not want to be alive any more',
  rootQuestion: 'I do not want to be alive any more',
  product: 'sortis', board, method: 'sortis', category: 'general', history: [],
  onDelta: (_t, full) => { delivered = full; }
});

assert.deepEqual(rolesCalled, ['m1'],
  '危机应当在 M1 就停住,后面一站都不该发出去 —— 实际发了:' + rolesCalled.join(' '));
assert.ok(result && result.reading,
  'a crisis answer resolved with no reading: the JSON response fell through to the SSE '
  + 'reader, which finds no data: records and returns "". That renders as the generic '
  + 'mid-stream billing copy — a person in crisis is shown a note about their balance.');
assert.match(result.reading, /988|116 123|findahelpline/,
  'the reading came through but carries no crisis resources');
assert.equal(delivered, result.reading,
  'the crisis text must reach onDelta too, or it resolves without ever being painted');

// ── and a JSON answer with no text must still be an error, not silence ─────
const empty = loadRouter(() => Promise.resolve(new Response(
  JSON.stringify({ route: 'crisis' }), { status: 200, headers: { 'content-type': 'application/json' } }
)));
const failed = await empty.BWPromptRouter.interpret({
  question: 'x', rootQuestion: 'x', product: 'sortis', board, method: 'sortis',
  category: 'general', history: [], onDelta: () => {}
}).then(() => null, (e) => e);
assert.ok(failed instanceof Error,
  'a JSON response carrying no text must surface as an error rather than resolve empty');

// ── the branch has to be read before the body is treated as a stream ───────
const router = readFileSync(`${ROOT}/prompt-router.js`, 'utf8');
const streamFn = router.slice(router.indexOf('function makeStreamComplete('));
const jsonAt = streamFn.indexOf('application/json');
const readerAt = streamFn.indexOf('r.body.getReader()');
assert.ok(jsonAt > 0 && jsonAt < readerAt,
  'the content-type check must come before getReader(), or a JSON answer is parsed as SSE');

/* ── 闸本身必须跑在四节点上,不能跟着老链路一起退役 ──────────────────────
   它原来挂在 `buildSystemPrompt()` 的路由里,而那条路由 2026-09-14 作废了。
   **删一条路径时要数清楚它顺手扛着什么** —— 这条差一点就跟着没了。 */
const server = readFileSync(`${ROOT}/functions/api/claude.js`, 'utf8');
const nodeBranch = server.slice(server.indexOf("if (role === 'm1' || role === 'm2'"));
const gateAt = nodeBranch.indexOf("PromptEngine.gate(");
const buildAt = nodeBranch.indexOf('buildNode(role, body)');
assert.ok(gateAt > 0, '四节点分支里没有危机闸 —— 老路由退役之后它就是唯一的入口了');
assert.ok(gateAt < buildAt,
  '危机闸必须跑在 buildNode 之前:一个说自己想死的人,不该先被路由到「婚恋库」');
/* 领了免费额度再返回求助信息,等于那条求助信息花掉了他唯一一次免费解读。 */
const crisisBranch = server.slice(server.indexOf("if (built.route === 'crisis')"),
                                  server.indexOf("if (built.error)"));
assert.match(crisisBranch, /releaseFreeReading/,
  '危机分支没有把免费额度还回去 —— 闸跑在它前面,额度已经被领走了');

console.log('crisis route OK — 停在 M1、后三站不发、求助信息送达、免费额度退回,'
  + '且 content-type 在 getReader() 之前读');
