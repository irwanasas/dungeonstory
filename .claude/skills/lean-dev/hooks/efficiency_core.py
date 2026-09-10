"""UserPromptSubmit hook: keep the lean-dev contract in effect every turn.

A skill body is model-invoked, so it drifts out of effect over a long session. This
re-asserts the core contract deterministically. It is itself subject to the rules it
carries: the full contract lands on turn 1 and every Nth turn after; other turns get a
one-line reminder. When the user explicitly asks for depth, the guardrail is injected
instead of the brevity rules, so the hook never argues against an explicit request.

Env:
  LEAN_DEV_OFF=1     disable entirely
  LEAN_DEV_REFRESH=N re-inject the full contract every N turns (default 10)
"""

import os
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import _state  # noqa: E402

SKILL_DIR = Path(__file__).resolve().parent.parent

# An explicit request for depth outranks the brevity defaults (SKILL.md §7).
# Stems for the major languages Claude is commonly used in; matching a stem is enough.
DEPTH_REQUEST = re.compile(
    r"\b(thorough(ly)?|exhaustive(ly)?|comprehensive(ly)?|in\s+detail|detailed|"
    r"deep[\s-]?dive|step[\s-]by[\s-]step|full\s+(explanation|review|write[\s-]?up)|"
    r"walk\s+me\s+through|explain\s+(fully|everything))\b"
    # Russian / Ukrainian
    r"|подробн|детальн|развернут|исчерпыв|пошагов|во\s+всех\s+деталях"
    r"|докладн|розгорнут|вичерпн|покроков"
    # Spanish / Portuguese / Italian
    r"|detallad|exhaustiv|a\s+fondo|paso\s+a\s+paso|minucios"
    r"|detalhad|aprofundad|passo\s+a\s+passo"
    r"|dettagliat|approfondit|esaustiv"
    # French
    r"|détaillé|exhaustif|approfondi|étape\s+par\s+étape|en\s+détail"
    # German
    r"|ausführlich|detailliert|gründlich|erschöpfend|schritt\s+für\s+schritt"
    # Chinese / Japanese / Korean
    r"|详细|詳細|全面|深入|逐步|一步一步"
    r"|詳しく|徹底的|網羅|くわしく"
    r"|자세히|상세|철저히|단계별",
    re.IGNORECASE,
)

DEPTH_OVERRIDE = (
    "The user asked for depth. Lean guardrail §7 applies: give the full "
    "explanation they asked for — brevity is the default, not an override of an "
    "explicit request. Still cut filler and don't restate the same point twice."
)

FALLBACK_CORE = (
    "Lean contract: answer first, no filler, no code comments, short summary. Least code "
    "that works. Search before read, batch independent calls, trust a write that succeeded. "
    "Never trade away correctness, a caveat worth raising, or actually running the check."
)


def _read(name: str, fallback: str) -> str:
    try:
        return (SKILL_DIR / name).read_text(encoding="utf-8").strip()
    except Exception:
        return fallback


def main() -> None:
    if _state.disabled():
        return

    event = _state.read_event()
    session_id = event.get("session_id", "unknown")
    prompt = event.get("user_input", "") or ""

    state = _state.load(session_id)
    state["turn"] = int(state.get("turn", 0)) + 1
    turn = state["turn"]
    _state.save(session_id, state)

    if turn == 1:
        _state.prune_old_state()

    try:
        refresh = max(1, int(os.environ.get("LEAN_DEV_REFRESH", "10")))
    except ValueError:
        refresh = 10

    if DEPTH_REQUEST.search(prompt):
        text = DEPTH_OVERRIDE
    elif turn == 1 or turn % refresh == 0:
        text = _read("CORE.md", FALLBACK_CORE)
    else:
        text = _read("CORE_SHORT.md", FALLBACK_CORE)

    _state.emit_context("UserPromptSubmit", text)


if __name__ == "__main__":
    try:
        main()
    except Exception:
        pass  # a hook must never break the session
    sys.exit(0)
