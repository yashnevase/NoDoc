# -*- mode: python ; coding: utf-8 -*-

import os
from pathlib import Path

repo_root = Path(SPECPATH).parents[1]
ocr_bundle = os.environ.get("NODOC_OCR_BUNDLE_DIR")
ocr_bundle_dir = Path(ocr_bundle) if ocr_bundle else None
datas = []
if ocr_bundle_dir and ocr_bundle_dir.is_dir():
    datas.append((str(ocr_bundle_dir), "ocr"))

a = Analysis(
    [str(repo_root / "backend" / "app" / "main.py")],
    pathex=[str(repo_root), str(repo_root / "backend")],
    binaries=[],
    datas=datas,
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
