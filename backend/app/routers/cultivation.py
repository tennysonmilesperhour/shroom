"""Cultivation endpoints: strains, recipes, rooms, batches, lifecycle, contamination."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db

router = APIRouter(tags=["cultivation"])


# ------------------------------- Strains ---------------------------------- #
@router.get("/strains", response_model=list[schemas.StrainOut])
def list_strains(db: Session = Depends(get_db)):
    return db.scalars(select(models.Strain).order_by(models.Strain.name)).all()


@router.post("/strains", response_model=schemas.StrainOut, status_code=201)
def create_strain(payload: schemas.StrainCreate, db: Session = Depends(get_db)):
    strain = models.Strain(**payload.model_dump())
    db.add(strain)
    db.commit()
    db.refresh(strain)
    return strain


@router.get("/strains/{strain_id}/lineage")
def strain_lineage(strain_id: int, db: Session = Depends(get_db)):
    """Walk the genealogy graph up (ancestors) and down (descendants)."""
    strain = db.get(models.Strain, strain_id)
    if not strain:
        raise HTTPException(404, "Strain not found")

    ancestors = []
    cursor = strain.parent
    while cursor is not None:
        ancestors.append({"id": cursor.id, "name": cursor.name, "generation": cursor.generation})
        cursor = cursor.parent

    descendants = [
        {"id": c.id, "name": c.name, "generation": c.generation} for c in strain.children
    ]
    return {
        "strain": {"id": strain.id, "name": strain.name, "generation": strain.generation},
        "ancestors": ancestors,
        "descendants": descendants,
    }


# ------------------------------- Recipes ---------------------------------- #
@router.get("/recipes", response_model=list[schemas.RecipeOut])
def list_recipes(db: Session = Depends(get_db)):
    return db.scalars(select(models.Recipe).order_by(models.Recipe.name)).all()


@router.post("/recipes", response_model=schemas.RecipeOut, status_code=201)
def create_recipe(payload: schemas.RecipeCreate, db: Session = Depends(get_db)):
    data = payload.model_dump()
    ingredients = data.pop("ingredients", [])
    recipe = models.Recipe(**data)
    recipe.ingredients = [models.RecipeIngredient(**i) for i in ingredients]
    db.add(recipe)
    db.commit()
    db.refresh(recipe)
    return recipe


# -------------------------------- Rooms ----------------------------------- #
@router.get("/rooms", response_model=list[schemas.RoomOut])
def list_rooms(db: Session = Depends(get_db)):
    return db.scalars(select(models.Room).order_by(models.Room.name)).all()


@router.post("/rooms", response_model=schemas.RoomOut, status_code=201)
def create_room(payload: schemas.RoomCreate, db: Session = Depends(get_db)):
    room = models.Room(**payload.model_dump())
    db.add(room)
    db.commit()
    db.refresh(room)
    return room


# ------------------------------- Batches ---------------------------------- #
@router.get("/batches", response_model=list[schemas.BatchOut])
def list_batches(stage: str | None = None, db: Session = Depends(get_db)):
    stmt = select(models.Batch).order_by(models.Batch.created_at.desc())
    if stage:
        stmt = stmt.where(models.Batch.stage == stage)
    return db.scalars(stmt).all()


@router.post("/batches", response_model=schemas.BatchOut, status_code=201)
def create_batch(payload: schemas.BatchCreate, db: Session = Depends(get_db)):
    if db.scalar(select(models.Batch).where(models.Batch.lot_code == payload.lot_code)):
        raise HTTPException(409, f"Lot code '{payload.lot_code}' already exists")
    if not db.get(models.Strain, payload.strain_id):
        raise HTTPException(400, "Unknown strain_id")
    batch = models.Batch(**payload.model_dump())
    db.add(batch)
    db.flush()
    db.add(
        models.StageEvent(
            batch_id=batch.id,
            stage=batch.stage,
            room_id=batch.room_id,
            block_count=batch.block_count,
            note="Batch created",
        )
    )
    db.commit()
    db.refresh(batch)
    return batch


@router.get("/batches/{batch_id}", response_model=schemas.BatchOut)
def get_batch(batch_id: int, db: Session = Depends(get_db)):
    batch = db.get(models.Batch, batch_id)
    if not batch:
        raise HTTPException(404, "Batch not found")
    return batch


# Date column written when a batch reaches a given stage.
_STAGE_DATE_FIELD = {
    "colonization": "colonized_on",
    "fruiting": "fruiting_on",
    "spent": "spent_on",
}


@router.post("/batches/{batch_id}/advance", response_model=schemas.BatchOut)
def advance_stage(batch_id: int, payload: schemas.StageAdvance, db: Session = Depends(get_db)):
    """Move a batch to a new stage/room and append an immutable StageEvent."""
    batch = db.get(models.Batch, batch_id)
    if not batch:
        raise HTTPException(404, "Batch not found")
    if payload.stage not in models.STAGES:
        raise HTTPException(400, f"stage must be one of {models.STAGES}")

    batch.stage = payload.stage
    if payload.room_id is not None:
        batch.room_id = payload.room_id
    if payload.block_count is not None:
        batch.block_count = payload.block_count
    if payload.stage == "contaminated":
        batch.contamination_flag = True

    from datetime import date as _date

    field = _STAGE_DATE_FIELD.get(payload.stage)
    if field and getattr(batch, field) is None:
        setattr(batch, field, _date.today())

    db.add(
        models.StageEvent(
            batch_id=batch.id,
            stage=payload.stage,
            room_id=batch.room_id,
            block_count=batch.block_count,
            note=payload.note,
        )
    )
    db.commit()
    db.refresh(batch)
    return batch


@router.get("/batches/{batch_id}/timeline")
def batch_timeline(batch_id: int, db: Session = Depends(get_db)):
    batch = db.get(models.Batch, batch_id)
    if not batch:
        raise HTTPException(404, "Batch not found")
    events = sorted(batch.stage_events, key=lambda e: e.occurred_at or 0)
    return [
        {
            "stage": e.stage,
            "room_id": e.room_id,
            "block_count": e.block_count,
            "occurred_at": e.occurred_at,
            "note": e.note,
        }
        for e in events
    ]


# ---------------------------- Contamination ------------------------------- #
@router.get("/contamination", response_model=list[schemas.ContaminationOut])
def list_contamination(db: Session = Depends(get_db)):
    return db.scalars(
        select(models.ContaminationLog).order_by(models.ContaminationLog.observed_on.desc())
    ).all()


@router.post("/contamination", response_model=schemas.ContaminationOut, status_code=201)
def log_contamination(payload: schemas.ContaminationCreate, db: Session = Depends(get_db)):
    batch = db.get(models.Batch, payload.batch_id)
    if not batch:
        raise HTTPException(400, "Unknown batch_id")
    log = models.ContaminationLog(**payload.model_dump())
    db.add(log)
    if payload.severity == "high":
        batch.contamination_flag = True
    db.commit()
    db.refresh(log)
    return log
