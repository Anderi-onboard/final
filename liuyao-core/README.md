# liuyao-core

六爻 backend for 增删卜易: casting, the casting packet (every board fact the
book's rules compute), knowledge-base matching, and the multi-model reading
pipeline. No frontend. Self-contained, so it can be moved out of the BourneWise
repo as a whole.

## Layout

    src/
      engine.js        loads vendor/liuyao-engine.js in a Node sandbox
      casting.js       three coins, six throws (占卦法章)
      packet.js        board → packet: every computed fact, per line and per hexagram
      rules.js         the book's tables, each with its chapter
      features.js      packet → match tokens (for knowledge-base retrieval)
      retrieve.js      exact retrieval: an entry applies when all its `when` tokens are present
      corpus.js        knowledge-base entries (empty until source text is entered)
      coverage.js      one row per book chapter: where it is computed, or that it awaits the knowledge base
      render.js        packet → the Chinese text the models read (sections cite chapters)
      schema.js        packet shape
      validate.js      generic shape checker
      pipeline/
        subjects.js    subject → 用神 line (用神章), chosen by the program
        contracts.js   required shape of each model's output
        prompts.js     prompt builders
        llm.js         model adapters: mock, OpenRouter-compatible
        run.js         runReading / runFollowUp
      cli.js           demo: node src/cli.js --question "…" --throws 1,2,3,0,3,2 --mock
    test/              contracts (node test/<file>.mjs)
    scripts/run-tests.mjs
    vendor/liuyao-engine.js   copy of the site's engine; keep in step when it changes

## Run

Ask a question locally and read every stage (knowledge base, packet, prompts, outputs):

    npm run ask                                              # type questions, empty line to quit
    npm run ask -- --question "求财能不能成" --throws 1,2,3,0,3,2
    npm run ask -- --question "…" --mock                     # demonstration model, no network

Real models: copy `.env.example` to `.env`, fill in the key and model names. Each run is saved in `out/`.

    node scripts/run-tests.mjs          # all contracts
    node src/cli.js --question "求财" --throws 1,2,3,0,3,2 --mock

Real models: set OPENROUTER_API_KEY, LIUYAO_MODEL_UNDERSTAND, LIUYAO_MODEL_CLAIM,
LIUYAO_MODEL_SYNTH, then run without --mock. The `--mock` output is a placeholder.

## Model stages

1. understand — what is asked, subject, premises, risk. Output checked against contracts.js.
2. program — 用神 from the subject; packet; retrieval.
3. claim — one call per matched entry, applying the book's sentence to this casting.
4. synth — checks answer, logic and confidence, writes the reply.

The program drops any claim citing an entry it was not given or a line outside 1–6.

## Moving it out of BourneWise

Copy the directory, then run `node scripts/run-tests.mjs` in the new home. It has
no imports outside itself. `vendor/liuyao-engine.js` is the only copy of the engine
it needs; re-copy it when the site's engine changes.
