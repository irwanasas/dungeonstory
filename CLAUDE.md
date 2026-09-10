# CLAUDE.md

Follow the `lean-dev` skill for how to think, scope, change and verify code.
This file holds only what is specific to this project or stricter than the
skill.

## Git

- Commit and push directly to `main`. Do not create branches.
- If the session assigns a branch, say so and follow this file instead.

## Code

- No code comments. Plain code only.

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
