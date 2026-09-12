"""PostToolUse hook: turn the tool-use rules in SKILL.md §6 into measured feedback.

Advice in a skill body is a suggestion; this observes the trajectory and says something
only when a concrete, checkable waste pattern just happened:

  reread        the same file range was already read this session and hasn't changed
  edit_recheck  a file was read right after this turn's own successful edit to it
  blind_read    a large file was read whole with no search performed first
  bash_recheck  a build/test command that already ran this session was run again

The first hit in a category explains itself; every later hit in the same category is a
one-line tag instead — the reasoning already landed, so repeating it in full would be
the same waste this hook exists to flag. It stays quiet otherwise, and caps itself so
the guard never becomes the bloat.

Env:
  LEAN_DEV_OFF=1        disable entirely
  LEAN_DEV_MAX_WARN=N   cap warnings per session (default 8)
"""

import os
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import _state  # noqa: E402

WHOLE_FILE = 10**9
BLIND_READ_LINES = 200  # below this, reading a file whole is cheaper than searching it

# Only commands whose reruns are genuinely redundant — not `git status`, which is cheap
# and whose answer legitimately changes between calls.
VERIFICATION_CMD = re.compile(
    r"\b(pytest|jest|vitest|mocha|tsc|mypy|ruff|eslint|"
    r"cargo\s+(test|build|check|clippy)|go\s+(test|build|vet)|"
    r"npm\s+(test|run\s+(test|build|lint|typecheck))|"
    r"pnpm\s+(test|build|lint)|yarn\s+(test|build|lint)|"
    r"make(\s|$)|gradlew?\s|mvn\s|dotnet\s+(test|build))",
    re.IGNORECASE,
)


def _normalize(cmd: str) -> str:
    return " ".join(str(cmd).split())


def _response_lines(event: dict) -> int:
    resp = event.get("tool_response")
    text = resp.get("text", "") if isinstance(resp, dict) else str(resp or "")
    return text.count("\n")


def _fire(state: dict, category: str, full: str, short: str) -> str:
    state["waste"][category] = state["waste"].get(category, 0) + 1
    return full if state["waste"][category] == 1 else short


def _check_read(event: dict, state: dict, turn: int, prompt_id: str):
    tool_input = event.get("tool_input") or {}
    path = str(tool_input.get("file_path") or "").replace("\\", "/")
    if not path:
        return None

    offset = tool_input.get("offset")
    limit = tool_input.get("limit")
    start = int(offset) if offset else 1
    end = start + int(limit) - 1 if limit else WHOLE_FILE

    edited_in = state["edited"].get(path)
    if edited_in and edited_in == prompt_id:
        return _fire(
            state, "edit_recheck",
            f"Lean: re-read {path} right after editing it this turn — a successful edit "
            "doesn't need a verifying re-read (SKILL.md §6).",
            f"Lean: edit-recheck again ({path}).",
        )

    prior = state["reads"].get(path, [])
    for p_start, p_end, p_turn in prior:
        if p_start <= end and start <= p_end:
            state["reads"][path] = prior + [[start, end, turn]]
            return _fire(
                state, "reread",
                f"Lean: {path} — already read at turn {p_turn}, unchanged since; reuse "
                "it instead of re-reading (SKILL.md §6).",
                f"Lean: reread again ({path}).",
            )

    state["reads"][path] = prior + [[start, end, turn]]

    if end >= WHOLE_FILE and state.get("searches", 0) == 0:
        lines = _response_lines(event)
        if lines >= BLIND_READ_LINES:
            return _fire(
                state, "blind_read",
                f"Lean: read {path} whole (~{lines} lines) with no search first — "
                "Grep/Glob to the range next time (SKILL.md §6).",
                f"Lean: blind-read again ({path}).",
            )
    return None


def _check_bash(event: dict, state: dict, turn: int):
    cmd = _normalize((event.get("tool_input") or {}).get("command", ""))
    if not cmd or not VERIFICATION_CMD.search(cmd):
        return None
    seen = state["commands"].get(cmd)
    state["commands"][cmd] = seen if seen else turn
    if seen is None:
        return None
    return _fire(
        state, "bash_recheck",
        f"Lean: `{cmd[:60]}` already ran at turn {seen} — rerun only if it failed, is "
        "flaky, or a dependency changed (SKILL.md §6).",
        f"Lean: recheck again (`{cmd[:40]}`).",
    )


def main() -> None:
    if _state.disabled():
        return

    event = _state.read_event()
    tool = event.get("tool_name", "")
    session_id = event.get("session_id", "unknown")
    prompt_id = event.get("prompt_id", "")

    state = _state.load(session_id)
    turn = int(state.get("turn", 0))
    message = None

    if tool in ("Grep", "Glob"):
        state["searches"] = int(state.get("searches", 0)) + 1
    elif tool == "Read":
        message = _check_read(event, state, turn, prompt_id)
    elif tool in ("Edit", "Write", "MultiEdit", "NotebookEdit"):
        path = str((event.get("tool_input") or {}).get("file_path") or "").replace("\\", "/")
        if path:
            state["edited"][path] = prompt_id
            state["reads"].pop(path, None)  # content changed; a later read is legitimate
    elif tool == "Bash":
        message = _check_bash(event, state, turn)

    try:
        max_warn = max(0, int(os.environ.get("LEAN_DEV_MAX_WARN", "8")))
    except ValueError:
        max_warn = 8

    if message and state.get("warnings_emitted", 0) >= max_warn:
        message = None
    if message:
        state["warnings_emitted"] = int(state.get("warnings_emitted", 0)) + 1

    _state.save(session_id, state)

    if message:
        _state.emit_context("PostToolUse", message)


if __name__ == "__main__":
    try:
        main()
    except Exception:
        pass
    sys.exit(0)
