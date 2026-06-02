"""Shroom OS — FastAPI application entrypoint.

Mounts the domain routers under /api and serves the no-build dashboard from
the frontend/ directory at the root.
"""
from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .database import init_db
from .routers import advisor, analytics, business, cultivation, environment, operations


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="Shroom OS",
    version="0.1.0",
    description="Full-scale mushroom grow operation + business backend.",
    lifespan=lifespan,
)

# Permissive CORS so the static dashboard (or any future client) can call /api.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok", "service": "shroom-os"}


for module in (cultivation, environment, operations, business, analytics, advisor):
    app.include_router(module.router, prefix="/api")

# Serve the SPA last so /api routes take precedence.
_FRONTEND = Path(__file__).resolve().parents[2] / "frontend"
if _FRONTEND.is_dir():
    app.mount("/", StaticFiles(directory=str(_FRONTEND), html=True), name="frontend")
