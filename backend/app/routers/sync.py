"""Sheet sync endpoints — the two-way bridge between the app and the workbook.

    GET  /api/sync/status        what read source / write target are configured
    POST /api/sync/pull          import the sheet into the app DB  (Sheet -> App)
    POST /api/sync/push          write the app DB back to the sheet (App -> Sheet)
    GET  /api/sync/workbook.xlsx download the app's data as an .xlsx

``pull`` reuses the existing importer; ``push`` uses the new exporter + writer.
Both surface configuration problems as clean 400s rather than tracebacks, so
the dashboard can show the operator exactly what's missing.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..sheet import export, layout, mirror, writer
from ..sheet.importer import import_to_sqlite
from ..sheet.parse import parse_workbook
from ..sheet.source import describe_source, resolve_workbook

router = APIRouter(tags=["sync"], prefix="/sync")


class PullRequest(BaseModel):
    path: str | None = None
    file_id: str | None = None
    token: str | None = None


class PushRequest(BaseModel):
    path: str | None = None
    token: str | None = None


@router.get("/status")
def status(db: Session = Depends(get_db)) -> dict:
    """What's wired up, and how many rows the app would push per tab."""
    # Count rows without materializing them — status is polled by the UI, and
    # projecting every row (with its relationship walks) just to take len()
    # would make a cheap status call do a full export's worth of work.
    counts = {
        spec.key: db.scalar(select(func.count()).select_from(spec.entity))
        for spec in layout.TABS
    }
    return {
        "read_source": describe_source(),
        "write_target": writer.describe_target(),
        "mirror_enabled": mirror.enabled(),
        "pushable_rows": counts,
        "has_data": any(counts.values()),
    }


@router.post("/pull")
def pull(payload: PullRequest | None = None) -> dict:
    """Import the Master Cultivation Reference sheet into the app DB."""
    payload = payload or PullRequest()
    try:
        wb = resolve_workbook(path=payload.path, file_id=payload.file_id,
                              token=payload.token)
    except RuntimeError as exc:
        raise HTTPException(400, str(exc))
    except Exception as exc:  # network / auth / corrupt file
        raise HTTPException(502, f"Could not load workbook: {exc}")

    parsed = parse_workbook(wb)
    counts = import_to_sqlite(parsed)
    return {"status": "ok", "direction": "sheet->app", "imported": counts}


@router.post("/push")
def push(payload: PushRequest | None = None, db: Session = Depends(get_db)) -> dict:
    """Write the app's current data back into the configured sheet/workbook."""
    payload = payload or PushRequest()
    try:
        w = writer.resolve_writer(path=payload.path, token=payload.token)
    except RuntimeError as exc:
        raise HTTPException(400, str(exc))
    except Exception as exc:  # network / auth building a Drive/Sheets writer
        raise HTTPException(502, f"Could not open write target: {exc}")

    try:
        counts = export.push(db, w)
    except Exception as exc:
        raise HTTPException(502, f"Push failed: {exc}")
    finally:
        w.close()
    return {"status": "ok", "direction": "app->sheet",
            "target": writer.describe_target(), "written": counts}


@router.get("/workbook.xlsx")
def download_workbook(db: Session = Depends(get_db)) -> StreamingResponse:
    """Download the app's data as an .xlsx in the Master Reference layout."""
    w = writer.InMemoryXlsxWriter()
    export.push(db, w)
    data = w.to_bytes()
    w.close()
    headers = {"Content-Disposition": 'attachment; filename="shroom-master-reference.xlsx"'}
    return StreamingResponse(
        iter([data]),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers=headers,
    )
