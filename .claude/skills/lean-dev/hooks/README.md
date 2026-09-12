# lean-dev hooks

Author: irwanasas (github.com/irwanasas)

A skill body is model-invoked, so a long one drifts out of effect over a
session. These two hooks make the contract deterministic instead.

| Hook | Event | What it does |
|---|---|---|
| `efficiency_core.py` | `UserPromptSubmit` | Injects `CORE.md` on turn 1 and every Nth turn after. Every other turn it's silent — the contract landed recently, so repeating it would be the exact waste it warns against. When the prompt asks for depth (matched in ~10 languages), it injects a one-line §7 override instead, so the hook never argues against an explicit request. |
| `trajectory_guard.py` | `PostToolUse` | Watches the trajectory and speaks only when a concrete waste pattern just happened: re-reading a range already read, reading a file back after this turn's own edit, reading a large file whole with no prior search, or re-running a build/test that already passed. The first hit in each category explains itself; later hits in the same category get a one-line tag instead of the full explanation again. Silent otherwise, and capped so the guard never becomes the bloat. |

`_state.py` is shared per-session state for both. No third-party deps; Python 3.

`CORE_SHORT.md` is kept as a one-line reference for the short form of the contract; the
hook no longer auto-injects it per turn (see above).

## Environment variables

| Variable | Default | Effect |
|---|---|---|
| `LEAN_DEV_OFF` | unset | Any value except `0`/`false` disables both hooks entirely. |
| `LEAN_DEV_REFRESH` | `15` | Re-inject the full `CORE.md` every N turns. |
| `LEAN_DEV_MAX_WARN` | `8` | Cap on `trajectory_guard` warnings per session. |

## Registration

Register in a `settings.json`, keyed by event name. Use **user level**
(`~/.claude/settings.json`) — this skill is meant to apply to every project,
and a project-level `.claude/settings.json` would only bind it to that one
repo and commit personal tooling config into it.

Merge into any existing `"hooks"` block rather than overwriting it. Adjust the
python path and the skill path if yours differ.

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          { "type": "command", "command": "python3 ~/.claude/skills/lean-dev/hooks/efficiency_core.py" }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Read|Edit|Write|MultiEdit|NotebookEdit|Bash|Grep|Glob",
        "hooks": [
          { "type": "command", "command": "python3 ~/.claude/skills/lean-dev/hooks/trajectory_guard.py" }
        ]
      }
    ]
  }
}
```

The `PostToolUse` matcher is optional — `trajectory_guard.py` no-ops on tools
it doesn't care about — but narrowing it avoids spawning a process on every
other tool call.

Register through a settings file rather than a plugin `hooks.json`: there is a
reported Claude Code bug where a plugin-registered `UserPromptSubmit` hook
registers and matches but never executes.

## Verifying they actually fire

Config that parses is not proof of invocation. Check both directly:

```bash
echo '{"session_id":"t","user_input":"add a helper"}' \
  | python3 ~/.claude/skills/lean-dev/hooks/efficiency_core.py
```

Expect JSON whose `additionalContext` is the contract text. Then:

```bash
S=t; rm -f ~/.claude/state/lean-dev/$S.json
E='{"session_id":"'$S'","tool_name":"Read","tool_input":{"file_path":"/x/a.ts","offset":1,"limit":50}}'
echo "$E" | python3 ~/.claude/skills/lean-dev/hooks/trajectory_guard.py   # silent
echo "$E" | python3 ~/.claude/skills/lean-dev/hooks/trajectory_guard.py   # warns: re-read
```

In a live session, the contract line appears at the top of each turn's
context. `claude --debug` shows hook invocation if you need more than that.

Both scripts exit 0 on any internal error — a hook must never break a session,
so a silent hook means it ran and had nothing to say.
