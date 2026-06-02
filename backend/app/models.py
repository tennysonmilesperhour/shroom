"""ORM models for the full mushroom grow operation + business backend.

Domain coverage (mirrors the union of the three industry-standard systems —
MycoSense, Kinoko, and Sporehubs/MycoFile):

  Cultivation : Strain, Recipe/RecipeIngredient, Room, Batch, StageEvent,
                EnvironmentReading, Harvest, ContaminationLog
  Operations  : Staff, Task, InventoryItem, FoodSafetyLog
  Business    : Customer, Product, Order, OrderLine

Lot traceability is the spine that ties cultivation to the business backend:
  Strain -> Batch(lot_code) -> Harvest -> OrderLine -> Order -> Customer
which is what powers one-click FSMA-204 style recalls.
"""
from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base

# --- Controlled vocabularies (kept as plain strings for SQLite friendliness) ---
# Stages mirror Isaac's grain-bag-to-tub workflow: inoculate grain -> colonize
# in the dark -> spawn to bulk/tub -> fruiting -> flush harvests -> spent.
STAGES = ["inoculation", "colonization", "spawn_to_bulk", "fruiting", "harvesting", "spent", "contaminated"]
ROOM_TYPES = ["lab", "incubation", "pasteurization", "fruiting", "cold_storage", "packaging"]
SALES_CHANNELS = ["wholesale", "distributor", "csa", "farmers_market", "restaurant", "retail", "online"]
CONTAM_TYPES = ["trichoderma", "cobweb", "bacterial_blotch", "green_mold", "wet_spot", "other"]
MUSHROOM_TYPES = ["psychedelic", "functional", "gourmet"]

# Below this fresh->dry ratio a harvest is flagged (substrate too wet / picked
# late) — Isaac's hard-won 7.5% rule of thumb.
DRY_RATIO_FLOOR = 7.5


class Strain(Base):
    __tablename__ = "strains"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    species: Mapped[str] = mapped_column(String(120), default="")
    strain_code: Mapped[str] = mapped_column(String(60), default="")
    mushroom_type: Mapped[str] = mapped_column(String(20), default="functional")  # psychedelic/functional/gourmet
    # Provenance & grower-judgement fields carried over from Isaac's strain cards.
    vendor: Mapped[str] = mapped_column(String(120), default="")
    genetics: Mapped[str] = mapped_column(String(160), default="")
    potency: Mapped[str] = mapped_column(String(80), default="")
    ease_rating: Mapped[int] = mapped_column(Integer, default=3)  # 1 (hard) - 5 (easy)
    grow_again: Mapped[bool] = mapped_column(Boolean, default=True)
    # Self-referential lineage for genetic genealogy (innovation #4).
    lineage_parent_id: Mapped[int | None] = mapped_column(ForeignKey("strains.id"))
    generation: Mapped[int] = mapped_column(Integer, default=0)
    # Cultivation targets used for environment compliance + yield prediction.
    target_temp_c: Mapped[float] = mapped_column(Float, default=20.0)
    target_humidity: Mapped[float] = mapped_column(Float, default=90.0)
    target_co2_ppm: Mapped[float] = mapped_column(Float, default=800.0)
    # Typical biological efficiency (% of substrate dry weight returned as fresh
    # fruit) and flush count — the priors behind the yield-prediction model.
    typical_be: Mapped[float] = mapped_column(Float, default=75.0)
    typical_flushes: Mapped[int] = mapped_column(Integer, default=3)
    notes: Mapped[str] = mapped_column(Text, default="")
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    parent = relationship("Strain", remote_side=[id], backref="children")
    batches = relationship("Batch", back_populates="strain")


class Recipe(Base):
    __tablename__ = "recipes"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    block_weight_kg: Mapped[float] = mapped_column(Float, default=2.5)
    prep_notes: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    ingredients = relationship(
        "RecipeIngredient", back_populates="recipe", cascade="all, delete-orphan"
    )
    batches = relationship("Batch", back_populates="recipe")

    @property
    def cost_per_block(self) -> float:
        """Substrate cost of a single block — the basis for COGS."""
        return round(sum(i.line_cost for i in self.ingredients), 4)


class RecipeIngredient(Base):
    __tablename__ = "recipe_ingredients"

    id: Mapped[int] = mapped_column(primary_key=True)
    recipe_id: Mapped[int] = mapped_column(ForeignKey("recipes.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    quantity: Mapped[float] = mapped_column(Float, default=0.0)
    unit: Mapped[str] = mapped_column(String(20), default="kg")
    unit_cost: Mapped[float] = mapped_column(Float, default=0.0)

    recipe = relationship("Recipe", back_populates="ingredients")

    @property
    def line_cost(self) -> float:
        return round(self.quantity * self.unit_cost, 4)


class Room(Base):
    __tablename__ = "rooms"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    room_type: Mapped[str] = mapped_column(String(30), default="fruiting")
    capacity_blocks: Mapped[int] = mapped_column(Integer, default=0)
    target_temp_c: Mapped[float] = mapped_column(Float, default=20.0)
    target_humidity: Mapped[float] = mapped_column(Float, default=90.0)
    target_co2_ppm: Mapped[float] = mapped_column(Float, default=800.0)
    target_fae_per_hr: Mapped[float] = mapped_column(Float, default=4.0)  # fresh-air exchanges / hr
    notes: Mapped[str] = mapped_column(Text, default="")

    batches = relationship("Batch", back_populates="room")
    readings = relationship(
        "EnvironmentReading", back_populates="room", cascade="all, delete-orphan"
    )


class Batch(Base):
    """A production lot — the core traceable unit on the farm."""

    __tablename__ = "batches"

    id: Mapped[int] = mapped_column(primary_key=True)
    lot_code: Mapped[str] = mapped_column(String(40), unique=True, nullable=False, index=True)
    strain_id: Mapped[int] = mapped_column(ForeignKey("strains.id"), nullable=False)
    recipe_id: Mapped[int | None] = mapped_column(ForeignKey("recipes.id"))
    room_id: Mapped[int | None] = mapped_column(ForeignKey("rooms.id"))
    stage: Mapped[str] = mapped_column(String(20), default="inoculation")
    block_count: Mapped[int] = mapped_column(Integer, default=0)
    substrate_weight_kg: Mapped[float] = mapped_column(Float, default=0.0)
    inoculated_on: Mapped[date | None] = mapped_column(Date)
    colonized_on: Mapped[date | None] = mapped_column(Date)
    fruiting_on: Mapped[date | None] = mapped_column(Date)
    spent_on: Mapped[date | None] = mapped_column(Date)
    contamination_flag: Mapped[bool] = mapped_column(Boolean, default=False)
    notes: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    strain = relationship("Strain", back_populates="batches")
    recipe = relationship("Recipe", back_populates="batches")
    room = relationship("Room", back_populates="batches")
    harvests = relationship("Harvest", back_populates="batch", cascade="all, delete-orphan")
    stage_events = relationship(
        "StageEvent", back_populates="batch", cascade="all, delete-orphan"
    )
    contamination_logs = relationship(
        "ContaminationLog", back_populates="batch", cascade="all, delete-orphan"
    )


class StageEvent(Base):
    """Append-only lifecycle/location log for a batch (Kinoko-style moves)."""

    __tablename__ = "stage_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    batch_id: Mapped[int] = mapped_column(ForeignKey("batches.id"), nullable=False)
    stage: Mapped[str] = mapped_column(String(20), nullable=False)
    room_id: Mapped[int | None] = mapped_column(ForeignKey("rooms.id"))
    block_count: Mapped[int | None] = mapped_column(Integer)
    occurred_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    note: Mapped[str] = mapped_column(Text, default="")

    batch = relationship("Batch", back_populates="stage_events")


class EnvironmentReading(Base):
    __tablename__ = "environment_readings"

    id: Mapped[int] = mapped_column(primary_key=True)
    room_id: Mapped[int] = mapped_column(ForeignKey("rooms.id"), nullable=False, index=True)
    recorded_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), index=True)
    temp_c: Mapped[float | None] = mapped_column(Float)
    humidity: Mapped[float | None] = mapped_column(Float)
    co2_ppm: Mapped[float | None] = mapped_column(Float)
    fae_per_hr: Mapped[float | None] = mapped_column(Float)  # fresh-air exchanges / hr
    source: Mapped[str] = mapped_column(String(20), default="sensor")

    room = relationship("Room", back_populates="readings")


class Staff(Base):
    __tablename__ = "staff"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    role: Mapped[str] = mapped_column(String(60), default="picker")
    hourly_rate: Mapped[float] = mapped_column(Float, default=18.0)
    active: Mapped[bool] = mapped_column(Boolean, default=True)

    harvests = relationship("Harvest", back_populates="picker")
    tasks = relationship("Task", back_populates="assignee")


class Harvest(Base):
    __tablename__ = "harvests"

    id: Mapped[int] = mapped_column(primary_key=True)
    batch_id: Mapped[int] = mapped_column(ForeignKey("batches.id"), nullable=False, index=True)
    harvested_on: Mapped[date] = mapped_column(Date, nullable=False)
    flush_number: Mapped[int] = mapped_column(Integer, default=1)
    weight_kg: Mapped[float] = mapped_column(Float, default=0.0)  # fresh weight
    dry_weight_kg: Mapped[float] = mapped_column(Float, default=0.0)
    grade: Mapped[str] = mapped_column(String(20), default="A")  # A / B / process
    picker_id: Mapped[int | None] = mapped_column(ForeignKey("staff.id"))
    labor_minutes: Mapped[float] = mapped_column(Float, default=0.0)
    notes: Mapped[str] = mapped_column(Text, default="")

    batch = relationship("Batch", back_populates="harvests")
    picker = relationship("Staff", back_populates="harvests")
    order_lines = relationship("OrderLine", back_populates="harvest")

    @property
    def dry_ratio_pct(self) -> float:
        """Dry yield as a % of fresh weight — Isaac's key quality signal."""
        return round((self.dry_weight_kg / self.weight_kg) * 100, 1) if self.weight_kg else 0.0

    @property
    def below_dry_floor(self) -> bool:
        return 0 < self.dry_ratio_pct < DRY_RATIO_FLOOR


class ContaminationLog(Base):
    __tablename__ = "contamination_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    batch_id: Mapped[int] = mapped_column(ForeignKey("batches.id"), nullable=False)
    observed_on: Mapped[date] = mapped_column(Date, nullable=False)
    contam_type: Mapped[str] = mapped_column(String(30), default="other")
    severity: Mapped[str] = mapped_column(String(10), default="low")  # low/med/high
    action_taken: Mapped[str] = mapped_column(Text, default="")
    photo_url: Mapped[str] = mapped_column(String(255), default="")
    reported_by: Mapped[str] = mapped_column(String(120), default="")

    batch = relationship("Batch", back_populates="contamination_logs")


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    batch_id: Mapped[int | None] = mapped_column(ForeignKey("batches.id"))
    room_id: Mapped[int | None] = mapped_column(ForeignKey("rooms.id"))
    assigned_to: Mapped[int | None] = mapped_column(ForeignKey("staff.id"))
    due_date: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(20), default="open")  # open/in_progress/done
    priority: Mapped[str] = mapped_column(String(10), default="med")  # low/med/high
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    assignee = relationship("Staff", back_populates="tasks")


class InventoryItem(Base):
    __tablename__ = "inventory_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    category: Mapped[str] = mapped_column(String(40), default="other")
    unit: Mapped[str] = mapped_column(String(20), default="unit")
    quantity_on_hand: Mapped[float] = mapped_column(Float, default=0.0)
    reorder_threshold: Mapped[float] = mapped_column(Float, default=0.0)
    unit_cost: Mapped[float] = mapped_column(Float, default=0.0)
    supplier: Mapped[str] = mapped_column(String(120), default="")
    location: Mapped[str] = mapped_column(String(120), default="")

    @property
    def needs_reorder(self) -> bool:
        return self.quantity_on_hand <= self.reorder_threshold


class Customer(Base):
    __tablename__ = "customers"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    channel: Mapped[str] = mapped_column(String(30), default="wholesale")
    contact_email: Mapped[str] = mapped_column(String(160), default="")
    phone: Mapped[str] = mapped_column(String(40), default="")
    address: Mapped[str] = mapped_column(Text, default="")
    notes: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    orders = relationship("Order", back_populates="customer")


class Product(Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    sku: Mapped[str] = mapped_column(String(60), default="")
    strain_id: Mapped[int | None] = mapped_column(ForeignKey("strains.id"))
    category: Mapped[str] = mapped_column(String(40), default="fresh")  # fresh/dried/grow_kit/value_added
    unit: Mapped[str] = mapped_column(String(20), default="g")
    price: Mapped[float] = mapped_column(Float, default=0.0)  # retail price / unit
    distributor_price: Mapped[float] = mapped_column(Float, default=0.0)

    order_lines = relationship("OrderLine", back_populates="product")


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_number: Mapped[str] = mapped_column(String(40), unique=True, nullable=False, index=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"), nullable=False)
    channel: Mapped[str] = mapped_column(String(30), default="wholesale")
    order_date: Mapped[date] = mapped_column(Date, nullable=False)
    fulfillment_date: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(20), default="confirmed")  # quote/confirmed/fulfilled/paid/cancelled
    notes: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    customer = relationship("Customer", back_populates="orders")
    lines = relationship("OrderLine", back_populates="order", cascade="all, delete-orphan")

    @property
    def total(self) -> float:
        return round(sum(line.line_total for line in self.lines), 2)


class OrderLine(Base):
    __tablename__ = "order_lines"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id"), nullable=False)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), nullable=False)
    # The harvest (and therefore batch + lot) this line was fulfilled from.
    # This single link is what makes forward recall tracing possible.
    harvest_id: Mapped[int | None] = mapped_column(ForeignKey("harvests.id"))
    quantity: Mapped[float] = mapped_column(Float, default=0.0)
    unit_price: Mapped[float] = mapped_column(Float, default=0.0)

    order = relationship("Order", back_populates="lines")
    product = relationship("Product", back_populates="order_lines")
    harvest = relationship("Harvest", back_populates="order_lines")

    @property
    def line_total(self) -> float:
        return round(self.quantity * self.unit_price, 2)


class FoodSafetyLog(Base):
    """GAP / FSMA produce-safety record (sanitation, water, hygiene, pest...)."""

    __tablename__ = "food_safety_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    log_date: Mapped[date] = mapped_column(Date, nullable=False)
    category: Mapped[str] = mapped_column(String(40), default="sanitation")
    description: Mapped[str] = mapped_column(Text, default="")
    performed_by: Mapped[str] = mapped_column(String(120), default="")
    passed: Mapped[bool] = mapped_column(Boolean, default=True)
    corrective_action: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
