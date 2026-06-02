"""Environmental monitoring: time-series readings + per-room compliance."""
from __future__ import annotations

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db

router = APIRouter(tags=["environment"])


@router.post("/environment/readings", response_model=schemas.EnvReadingOut, status_code=201)
def add_reading(payload: schemas.EnvReadingCreate, db: Session = Depends(get_db)):
    if not db.get(models.Room, payload.room_id):
        raise HTTPException(400, "Unknown room_id")
    data = payload.model_dump()
    if data.get("recorded_at") is None:
        data["recorded_at"] = datetime.utcnow()
    reading = models.EnvironmentReading(**data)
    db.add(reading)
    db.commit()
    db.refresh(reading)
    return reading


@router.get("/environment/readings", response_model=list[schemas.EnvReadingOut])
def list_readings(room_id: int, hours: int = 48, db: Session = Depends(get_db)):
    since = datetime.utcnow() - timedelta(hours=hours)
    stmt = (
        select(models.EnvironmentReading)
        .where(
            models.EnvironmentReading.room_id == room_id,
            models.EnvironmentReading.recorded_at >= since,
        )
        .order_by(models.EnvironmentReading.recorded_at)
    )
    return db.scalars(stmt).all()


@router.get("/environment/status")
def environment_status(db: Session = Depends(get_db)):
    """Latest reading per room compared against its targets (Kinoko-style)."""
    rooms = db.scalars(select(models.Room)).all()
    out = []
    for room in rooms:
        latest = db.scalar(
            select(models.EnvironmentReading)
            .where(models.EnvironmentReading.room_id == room.id)
            .order_by(models.EnvironmentReading.recorded_at.desc())
            .limit(1)
        )
        alerts = []
        if latest:
            if latest.temp_c is not None and abs(latest.temp_c - room.target_temp_c) > 2.0:
                alerts.append(f"Temp {latest.temp_c}°C vs target {room.target_temp_c}°C")
            if latest.humidity is not None and abs(latest.humidity - room.target_humidity) > 5.0:
                alerts.append(f"RH {latest.humidity}% vs target {room.target_humidity}%")
            if latest.co2_ppm is not None and room.target_co2_ppm and latest.co2_ppm > room.target_co2_ppm * 1.25:
                alerts.append(f"CO₂ {latest.co2_ppm}ppm exceeds target {room.target_co2_ppm}ppm")
            if latest.fae_per_hr is not None and room.target_fae_per_hr and latest.fae_per_hr < room.target_fae_per_hr * 0.6:
                alerts.append(f"FAE {latest.fae_per_hr}/hr below target {room.target_fae_per_hr}/hr (flush-stall risk)")
        out.append(
            {
                "room_id": room.id,
                "room": room.name,
                "room_type": room.room_type,
                "target": {
                    "temp_c": room.target_temp_c,
                    "humidity": room.target_humidity,
                    "co2_ppm": room.target_co2_ppm,
                    "fae_per_hr": room.target_fae_per_hr,
                },
                "latest": {
                    "temp_c": latest.temp_c if latest else None,
                    "humidity": latest.humidity if latest else None,
                    "co2_ppm": latest.co2_ppm if latest else None,
                    "fae_per_hr": latest.fae_per_hr if latest else None,
                    "recorded_at": latest.recorded_at if latest else None,
                },
                "in_spec": not alerts,
                "alerts": alerts,
            }
        )
    return out
