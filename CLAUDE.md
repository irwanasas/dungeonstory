# CLAUDE.md

Follow the `lean-dev` skill for how to think, scope, change and verify code.
This file holds only what is specific to this project or stricter than the
skill.

## Git

- Commit and push directly to `main` only. Never create a branch.
- Not on `main`, or the session assigns a different branch → say so before
  committing. Don't commit or branch on your own.

## Code

- No code comments. Plain code only.

## Approach

Search before reading; read before editing. Make the smallest surgical
fix — don't touch what isn't broken, don't add unneeded abstraction.
Decide and proceed; flag only real ambiguity or risk.

## Summaries

**Short. Always.** No long reports, no phase recaps, no tables of what was
verified, no restating the request.

Include only:
- What changed, in a line or two.
- Anything that needs my attention: a decision I have to make, a spec that
  contradicts itself, a result that disagrees with what I asked for, a
  correctness or data-loss risk.

Strip everything else — verification detail I didn't ask for, measurements that
confirm the expected, lists of files touched, what was left alone, closing
recaps. If I want depth I will ask.

Never pad the "needs attention" part to look thorough, and never drop it to
look brief.
