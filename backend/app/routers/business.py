"""Business backend: customers, products, multi-channel orders."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db

router = APIRouter(tags=["business"])


# ------------------------------ Customers --------------------------------- #
@router.get("/customers", response_model=list[schemas.CustomerOut])
def list_customers(channel: str | None = None, db: Session = Depends(get_db)):
    stmt = select(models.Customer).order_by(models.Customer.name)
    if channel:
        stmt = stmt.where(models.Customer.channel == channel)
    return db.scalars(stmt).all()


@router.post("/customers", response_model=schemas.CustomerOut, status_code=201)
def create_customer(payload: schemas.CustomerCreate, db: Session = Depends(get_db)):
    customer = models.Customer(**payload.model_dump())
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return customer


# ------------------------------- Products --------------------------------- #
@router.get("/products", response_model=list[schemas.ProductOut])
def list_products(db: Session = Depends(get_db)):
    return db.scalars(select(models.Product).order_by(models.Product.name)).all()


@router.post("/products", response_model=schemas.ProductOut, status_code=201)
def create_product(payload: schemas.ProductCreate, db: Session = Depends(get_db)):
    product = models.Product(**payload.model_dump())
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


# -------------------------------- Orders ---------------------------------- #
@router.get("/orders", response_model=list[schemas.OrderOut])
def list_orders(status: str | None = None, db: Session = Depends(get_db)):
    stmt = select(models.Order).order_by(models.Order.order_date.desc())
    if status:
        stmt = stmt.where(models.Order.status == status)
    return db.scalars(stmt).all()


@router.post("/orders", response_model=schemas.OrderOut, status_code=201)
def create_order(payload: schemas.OrderCreate, db: Session = Depends(get_db)):
    if db.scalar(select(models.Order).where(models.Order.order_number == payload.order_number)):
        raise HTTPException(409, f"Order number '{payload.order_number}' already exists")
    if not db.get(models.Customer, payload.customer_id):
        raise HTTPException(400, "Unknown customer_id")

    data = payload.model_dump()
    lines = data.pop("lines", [])
    order = models.Order(**data)
    order.lines = [models.OrderLine(**line) for line in lines]
    db.add(order)
    db.commit()
    db.refresh(order)
    return order


@router.get("/orders/{order_id}", response_model=schemas.OrderOut)
def get_order(order_id: int, db: Session = Depends(get_db)):
    order = db.get(models.Order, order_id)
    if not order:
        raise HTTPException(404, "Order not found")
    return order
