"""Operations: staff, harvests, tasks, inventory, food-safety logs."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..sheet import autosync

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
    autosync.notify(db)  # mark dirty; auto-push to the sheet if enabled
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


# --------------------- Stage supply usage estimates ----------------------- #
def _validate_estimate(payload, db: Session) -> None:
    if payload.stage is not None and payload.stage not in models.STAGES:
        raise HTTPException(400, f"stage must be one of {models.STAGES}")
    if payload.basis is not None and payload.basis not in models.SUPPLY_BASES:
        raise HTTPException(400, f"basis must be one of {models.SUPPLY_BASES}")
    if payload.inventory_item_id is not None and not db.get(
        models.InventoryItem, payload.inventory_item_id
    ):
        raise HTTPException(400, "Unknown inventory_item_id")


@router.get("/stage-supply-estimates", response_model=list[schemas.StageSupplyEstimateOut])
def list_stage_supply_estimates(stage: str | None = None, db: Session = Depends(get_db)):
    stmt = select(models.StageSupplyEstimate).order_by(
        models.StageSupplyEstimate.stage, models.StageSupplyEstimate.supply_name
    )
    if stage:
        stmt = stmt.where(models.StageSupplyEstimate.stage == stage)
    return db.scalars(stmt).all()


@router.post("/stage-supply-estimates", response_model=schemas.StageSupplyEstimateOut, status_code=201)
def create_stage_supply_estimate(
    payload: schemas.StageSupplyEstimateCreate, db: Session = Depends(get_db)
):
    _validate_estimate(payload, db)
    est = models.StageSupplyEstimate(**payload.model_dump())
    db.add(est)
    db.commit()
    db.refresh(est)
    return est


@router.patch("/stage-supply-estimates/{estimate_id}", response_model=schemas.StageSupplyEstimateOut)
def update_stage_supply_estimate(
    estimate_id: int, payload: schemas.StageSupplyEstimateUpdate, db: Session = Depends(get_db)
):
    est = db.get(models.StageSupplyEstimate, estimate_id)
    if not est:
        raise HTTPException(404, "Estimate not found")
    _validate_estimate(payload, db)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(est, key, value)
    db.commit()
    db.refresh(est)
    return est


@router.delete("/stage-supply-estimates/{estimate_id}", status_code=204)
def delete_stage_supply_estimate(estimate_id: int, db: Session = Depends(get_db)):
    est = db.get(models.StageSupplyEstimate, estimate_id)
    if not est:
        raise HTTPException(404, "Estimate not found")
    db.delete(est)
    db.commit()


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
