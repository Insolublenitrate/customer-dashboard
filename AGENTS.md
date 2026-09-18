<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- BEGIN:stale-training-data -->
# This is not the version you were trained on

Framework and library versions here may differ from your training data — APIs,
conventions and file layout all change. **Read the installed docs before writing code**,
not your recollection of them:

- Node: `node_modules/<pkg>/dist/docs/` or the package README
- Python: the installed package's own docs, or `help()` on the real object
- Anything else: the version pinned in this repo, not the latest you remember

Heed deprecation notices. When the installed source and your memory disagree, the
installed source is right.
<!-- END:stale-training-data -->

<!-- BEGIN:prove-it-runs -->
# Prove it runs; don't just assert it

Before reporting something as working, run it. Before recommending a library, import it.
A dependency that resolves is not a dependency that works on your data.

- Reproduce the failure first, then show the same check passing.
- Assert on a real value, not on "no exception raised".
- When a check passes only partially, say so with the number: "49 of 57 files load".

If you could not run it, say that plainly instead of implying you did.
<!-- END:prove-it-runs -->

<!-- BEGIN:token-discipline -->
# Read what you need, then stop

Never run a repository-wide `grep`, `glob` or `find` as a first move — scope it to the
directory that could plausibly hold the answer.

Before opening a large directory, ask what question it answers. Vendored dependencies,
build output, lockfiles and `node_modules` answer almost nothing and cost a great deal.

If this repo has an `AGENTS.md` routing table, use it: one hop to the right file beats
reading five wrong ones.
<!-- END:token-discipline -->

<!-- BEGIN:verify-dont-recall -->
# Verify at the primary source, don't recall

For any claim that would be embarrassing to get wrong — a licence, a price, a model name,
an API signature, a version — **read the authoritative source in this session**. Do not
answer from memory, and do not trust a summary of the source when the source is one fetch
away.

This is not caution for its own sake. Recall on these has been wrong repeatedly and
confidently:

- A project's licence changes without the ecosystem noticing.
- A licence file can open with familiar wording and then restrict it.
- A licence can be applied by someone who never held the rights to apply it.

When you do verify, say what you read and when. "Verified on <date> from <file>" is worth
more than a confident assertion.
<!-- END:verify-dont-recall -->

<!-- BEGIN:correct-the-record -->
# Correct your own errors plainly

If you find that something you previously stated was wrong, say so directly and early —
before continuing. State the correction in a sentence, give the right answer, and move on.

Do not bury a correction in a summary, do not soften it into ambiguity, and do not
quietly fix it and hope it goes unnoticed. A reader acting on the earlier claim needs to
know it changed.

No apology paragraph. The correction is the useful part.
<!-- END:correct-the-record -->
