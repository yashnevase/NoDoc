"""
Milestone-1 acceptance guard: fail the build if any engine/backend module
imports a networking library capable of reaching a remote host. This is a
static check, not a runtime sandbox — a genuine offline test (network
adapter disabled) must also be run manually before each release, but this
catches accidental additions early and cheaply in CI.
"""
from __future__ import annotations

import ast
from pathlib import Path

FORBIDDEN_MODULES = {"requests", "urllib.request", "httpx", "aiohttp", "socket"}
# 'socket' is forbidden in engines/ specifically; app/main.py's use of it for
# the loopback bind is an explicit, reviewed exception.
ALLOWED_SOCKET_FILES = {"app/main.py"}

ROOT = Path(__file__).resolve().parent.parent


def _imported_modules(py_file: Path) -> set[str]:
    tree = ast.parse(py_file.read_text(encoding="utf-8"), filename=str(py_file))
    found = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            found.update(alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module:
            found.add(node.module)
    return found


def test_engines_and_backend_have_no_forbidden_network_imports():
    offenders = []
    for base in (ROOT / "engines", ROOT / "backend" / "app"):
        for py_file in base.rglob("*.py"):
            rel = py_file.relative_to(ROOT).as_posix()
            mods = _imported_modules(py_file)
            for forbidden in FORBIDDEN_MODULES:
                if forbidden in mods:
                    if forbidden == "socket" and rel.replace("backend/", "") in ALLOWED_SOCKET_FILES:
                        continue
                    offenders.append(f"{rel} imports '{forbidden}'")
    assert not offenders, "Forbidden network-capable imports found:\n" + "\n".join(offenders)
