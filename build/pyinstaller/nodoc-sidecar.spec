# -*- mode: python ; coding: utf-8 -*-

from pathlib import Path

repo_root = Path(SPECPATH).parents[1]

a = Analysis(
    [str(repo_root / "backend" / "app" / "main.py")],
    pathex=[str(repo_root), str(repo_root / "backend")],
    binaries=[],
    datas=[],
    hiddenimports=["app.api.organize", "app.api.results"],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name="nodoc-sidecar",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
