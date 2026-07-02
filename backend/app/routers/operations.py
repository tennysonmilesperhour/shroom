"""Operations: staff, harvests, tasks, inventory, food-safety logs."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db

router = APIRouter(tags=["operations"])


# -------------------------------- Staff ----------------------------------- #
@router.get("/staff", response_model=list[schemas.StaffOut])
def list_staff(db: Session = Depends(get_db)):
    return db.scalars(select(models.Staff).order_by(models.Staff.name)).all()


@router.post("/staff", response_model=schemas.StaffOut, status_code=201)
def create_staff(payload: schemas.StaffCreate, db: Session = Depends(get_db)):
    staff = models.Staff(**payload.model_dump())
    db.add(staff)
    db.commit()
    db.refresh(staff)
    return staff


# ------------------------------- Harvests --------------------------------- #
@router.get("/harvests", response_model=list[schemas.HarvestOut])
def list_harvests(batch_id: int | None = None, db: Session = Depends(get_db)):
    stmt = select(models.Harvest).order_by(models.Harvest.harvested_on.desc())
    if batch_id:
        stmt = stmt.where(models.Harvest.batch_id == batch_id)
    return db.scalars(stmt).all()


@router.post("/harvests", response_model=schemas.HarvestOut, status_code=201)
def create_harvest(payload: schemas.HarvestCreate, db: Session = Depends(get_db)):
    batch = db.get(models.Batch, payload.batch_id)
    if not batch:
        raise HTTPException(400, "Unknown batch_id")
    harvest = models.Harvest(**payload.model_dump())
    db.add(harvest)
    # First harvest auto-moves a fruiting batch into the harvesting stage.
    if batch.stage in ("fruiting", "colonization"):
        batch.stage = "harvesting"
    db.commit()
    db.refresh(harvest)
    return harvest


# -------------------------------- Tasks ----------------------------------- #
@router.get("/tasks", response_model=list[schemas.TaskOut])
def list_tasks(status: str | None = None, db: Session = Depends(get_db)):
    stmt = select(models.Task).order_by(models.Task.due_date.is_(None), models.Task.due_date)
    if status:
        stmt = stmt.where(models.Task.status == status)
    return db.scalars(stmt).all()


@router.post("/tasks", response_model=schemas.TaskOut, status_code=201)
def create_task(payload: schemas.TaskCreate, db: Session = Depends(get_db)):
    task = models.Task(**payload.model_dump())
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@router.patch("/tasks/{task_id}", response_model=schemas.TaskOut)
def update_task(task_id: int, payload: schemas.TaskUpdate, db: Session = Depends(get_db)):
    task = db.get(models.Task, task_id)
    if not task:
        raise HTTPException(404, "Task not found")
    # exclude_unset: a PATCH with {"status": "done"} must not reset the
    # task's other fields to schema defaults.
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(task, key, value)
    db.commit()
    db.refresh(task)
    return task


# ------------------------------ Inventory --------------------------------- #
@router.get("/inventory", response_model=list[schemas.InventoryOut])
def list_inventory(low_only: bool = False, db: Session = Depends(get_db)):
    items = db.scalars(select(models.InventoryItem).order_by(models.InventoryItem.name)).all()
    if low_only:
        items = [i for i in items if i.needs_reorder]
    return items


@router.post("/inventory", response_model=schemas.InventoryOut, status_code=201)
def create_inventory(payload: schemas.InventoryCreate, db: Session = Depends(get_db)):
    item = models.InventoryItem(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.patch("/inventory/{item_id}/adjust", response_model=schemas.InventoryOut)
def adjust_inventory(item_id: int, delta: float, db: Session = Depends(get_db)):
    item = db.get(models.InventoryItem, item_id)
    if not item:
        raise HTTPException(404, "Item not found")
    item.quantity_on_hand = round(item.quantity_on_hand + delta, 4)
    db.commit()
    db.refresh(item)
    return item


# ----------------------------- Food safety -------------------------------- #
@router.get("/food-safety", response_model=list[schemas.FoodSafetyOut])
def list_food_safety(db: Session = Depends(get_db)):
    return db.scalars(
        select(models.FoodSafetyLog).order_by(models.FoodSafetyLog.log_date.desc())
    ).all()


@router.post("/food-safety", response_model=schemas.FoodSafetyOut, status_code=201)
def create_food_safety(payload: schemas.FoodSafetyCreate, db: Session = Depends(get_db)):
    log = models.FoodSafetyLog(**payload.model_dump())
    db.add(log)
    db.commit()
    db.refresh(log)
    return log
