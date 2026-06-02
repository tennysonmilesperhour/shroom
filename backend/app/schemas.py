"""Pydantic v2 request/response schemas.

`*Create` schemas validate incoming payloads; `*Out` schemas serialize ORM
objects (``from_attributes=True``) including computed properties.
"""
from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

ORM = ConfigDict(from_attributes=True)


# --------------------------------------------------------------------------- #
# Strains
# --------------------------------------------------------------------------- #
class StrainCreate(BaseModel):
    name: str
    species: str = ""
    strain_code: str = ""
    mushroom_type: str = "functional"
    vendor: str = ""
    genetics: str = ""
    potency: str = ""
    ease_rating: int = 3
    grow_again: bool = True
    lineage_parent_id: int | None = None
    generation: int = 0
    target_temp_c: float = 20.0
    target_humidity: float = 90.0
    target_co2_ppm: float = 800.0
    typical_be: float = 75.0
    typical_flushes: int = 3
    notes: str = ""
    active: bool = True


class StrainOut(StrainCreate):
    model_config = ORM
    id: int
    created_at: datetime | None = None


# --------------------------------------------------------------------------- #
# Recipes
# --------------------------------------------------------------------------- #
class IngredientCreate(BaseModel):
    name: str
    quantity: float = 0.0
    unit: str = "kg"
    unit_cost: float = 0.0


class IngredientOut(IngredientCreate):
    model_config = ORM
    id: int
    line_cost: float


class RecipeCreate(BaseModel):
    name: str
    description: str = ""
    block_weight_kg: float = 2.5
    prep_notes: str = ""
    ingredients: list[IngredientCreate] = Field(default_factory=list)


class RecipeOut(BaseModel):
    model_config = ORM
    id: int
    name: str
    description: str
    block_weight_kg: float
    prep_notes: str
    cost_per_block: float
    ingredients: list[IngredientOut] = Field(default_factory=list)


# --------------------------------------------------------------------------- #
# Rooms
# --------------------------------------------------------------------------- #
class RoomCreate(BaseModel):
    name: str
    room_type: str = "fruiting"
    capacity_blocks: int = 0
    target_temp_c: float = 20.0
    target_humidity: float = 90.0
    target_co2_ppm: float = 800.0
    target_fae_per_hr: float = 4.0
    notes: str = ""


class RoomOut(RoomCreate):
    model_config = ORM
    id: int


# --------------------------------------------------------------------------- #
# Batches
# --------------------------------------------------------------------------- #
class BatchCreate(BaseModel):
    lot_code: str
    strain_id: int
    recipe_id: int | None = None
    room_id: int | None = None
    stage: str = "inoculation"
    block_count: int = 0
    substrate_weight_kg: float = 0.0
    inoculated_on: date | None = None
    notes: str = ""


class BatchOut(BaseModel):
    model_config = ORM
    id: int
    lot_code: str
    strain_id: int
    recipe_id: int | None
    room_id: int | None
    stage: str
    block_count: int
    substrate_weight_kg: float
    inoculated_on: date | None
    colonized_on: date | None
    fruiting_on: date | None
    spent_on: date | None
    contamination_flag: bool
    notes: str


class StageAdvance(BaseModel):
    stage: str
    room_id: int | None = None
    block_count: int | None = None
    note: str = ""


# --------------------------------------------------------------------------- #
# Environment
# --------------------------------------------------------------------------- #
class EnvReadingCreate(BaseModel):
    room_id: int
    temp_c: float | None = None
    humidity: float | None = None
    co2_ppm: float | None = None
    fae_per_hr: float | None = None
    source: str = "sensor"
    recorded_at: datetime | None = None


class EnvReadingOut(BaseModel):
    model_config = ORM
    id: int
    room_id: int
    recorded_at: datetime
    temp_c: float | None
    humidity: float | None
    co2_ppm: float | None
    fae_per_hr: float | None
    source: str


# --------------------------------------------------------------------------- #
# Staff / Harvests / Contamination
# --------------------------------------------------------------------------- #
class StaffCreate(BaseModel):
    name: str
    role: str = "picker"
    hourly_rate: float = 18.0
    active: bool = True


class StaffOut(StaffCreate):
    model_config = ORM
    id: int


class HarvestCreate(BaseModel):
    batch_id: int
    harvested_on: date
    flush_number: int = 1
    weight_kg: float = 0.0
    dry_weight_kg: float = 0.0
    grade: str = "A"
    picker_id: int | None = None
    labor_minutes: float = 0.0
    notes: str = ""


class HarvestOut(HarvestCreate):
    model_config = ORM
    id: int
    dry_ratio_pct: float
    below_dry_floor: bool


class ContaminationCreate(BaseModel):
    batch_id: int
    observed_on: date
    contam_type: str = "other"
    severity: str = "low"
    action_taken: str = ""
    photo_url: str = ""
    reported_by: str = ""


class ContaminationOut(ContaminationCreate):
    model_config = ORM
    id: int


# --------------------------------------------------------------------------- #
# Tasks
# --------------------------------------------------------------------------- #
class TaskCreate(BaseModel):
    title: str
    description: str = ""
    batch_id: int | None = None
    room_id: int | None = None
    assigned_to: int | None = None
    due_date: date | None = None
    status: str = "open"
    priority: str = "med"


class TaskOut(TaskCreate):
    model_config = ORM
    id: int


# --------------------------------------------------------------------------- #
# Inventory
# --------------------------------------------------------------------------- #
class InventoryCreate(BaseModel):
    name: str
    category: str = "other"
    unit: str = "unit"
    quantity_on_hand: float = 0.0
    reorder_threshold: float = 0.0
    unit_cost: float = 0.0
    supplier: str = ""
    location: str = ""


class InventoryOut(InventoryCreate):
    model_config = ORM
    id: int
    needs_reorder: bool


# --------------------------------------------------------------------------- #
# Business backend
# --------------------------------------------------------------------------- #
class CustomerCreate(BaseModel):
    name: str
    channel: str = "wholesale"
    contact_email: str = ""
    phone: str = ""
    address: str = ""
    notes: str = ""


class CustomerOut(CustomerCreate):
    model_config = ORM
    id: int


class ProductCreate(BaseModel):
    name: str
    sku: str = ""
    strain_id: int | None = None
    category: str = "fresh"
    unit: str = "g"
    price: float = 0.0
    distributor_price: float = 0.0


class ProductOut(ProductCreate):
    model_config = ORM
    id: int


class OrderLineCreate(BaseModel):
    product_id: int
    harvest_id: int | None = None
    quantity: float = 0.0
    unit_price: float = 0.0


class OrderLineOut(OrderLineCreate):
    model_config = ORM
    id: int
    line_total: float


class OrderCreate(BaseModel):
    order_number: str
    customer_id: int
    channel: str = "wholesale"
    order_date: date
    fulfillment_date: date | None = None
    status: str = "confirmed"
    notes: str = ""
    lines: list[OrderLineCreate] = Field(default_factory=list)


class OrderOut(BaseModel):
    model_config = ORM
    id: int
    order_number: str
    customer_id: int
    channel: str
    order_date: date
    fulfillment_date: date | None
    status: str
    notes: str
    total: float
    lines: list[OrderLineOut] = Field(default_factory=list)


# --------------------------------------------------------------------------- #
# Food safety
# --------------------------------------------------------------------------- #
class FoodSafetyCreate(BaseModel):
    log_date: date
    category: str = "sanitation"
    description: str = ""
    performed_by: str = ""
    passed: bool = True
    corrective_action: str = ""


class FoodSafetyOut(FoodSafetyCreate):
    model_config = ORM
    id: int
