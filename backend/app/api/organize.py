from __future__ import annotations

from fastapi import APIRouter

from app.api.organize_paths import router as path_router
from app.api.organize_uploads import router as upload_router

router = APIRouter()
router.include_router(path_router)
router.include_router(upload_router)
