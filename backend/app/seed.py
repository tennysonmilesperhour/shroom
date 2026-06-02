"""Seed the database with realistic data modeled on the Quantum Blue Mycology
operation (Isaac Childs). Run with:  python -m backend.app.seed

Idempotent-ish: it wipes and recreates the SQLite file so re-running gives a
clean, deterministic dataset for demos and tests.
"""
from __future__ import annotations

from datetime import date, datetime, timedelta

from .database import Base, SessionLocal, engine
from . import models


def reset() -> None:
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


def seed() -> None:
    reset()
    db = SessionLocal()
    today = date.today()

    # --- Rooms (with FAE targets) ---------------------------------------- #
    lab = models.Room(name="Lab / Flow Hood", room_type="lab", target_temp_c=21,
                       target_humidity=50, target_co2_ppm=600, target_fae_per_hr=2)
    incub = models.Room(name="Incubation (dark)", room_type="incubation", capacity_blocks=60,
                        target_temp_c=24, target_humidity=65, target_co2_ppm=5000, target_fae_per_hr=1)
    fruit = models.Room(name="Fruiting Tent A", room_type="fruiting", capacity_blocks=24,
                        target_temp_c=20, target_humidity=92, target_co2_ppm=700, target_fae_per_hr=5)
    cold = models.Room(name="Cold Storage", room_type="cold_storage", target_temp_c=3,
                       target_humidity=85, target_co2_ppm=600, target_fae_per_hr=1)
    db.add_all([lab, incub, fruit, cold])
    db.flush()

    # --- Strains (psychedelic + functional + gourmet) -------------------- #
    stargazer = models.Strain(
        name="Stargazer", species="Psilocybe cubensis", strain_code="QBM-STG",
        mushroom_type="psychedelic", vendor="Spore Depot", genetics="Stargazer isolate",
        potency="High", ease_rating=4, grow_again=True, generation=2,
        target_temp_c=23, target_humidity=92, target_co2_ppm=700, typical_be=85, typical_flushes=3,
        notes="Reliable colonizer; watch CO₂ in late flush.")
    illusion = models.Strain(
        name="Illusion Weaver", species="Psilocybe cubensis", strain_code="QBM-ILW",
        mushroom_type="psychedelic", vendor="Premium Spores", genetics="Albino x Golden Teacher",
        potency="High", ease_rating=3, grow_again=True, generation=3,
        target_temp_c=23, target_humidity=93, target_co2_ppm=650, typical_be=78, typical_flushes=3,
        notes="Slower pins; loves high RH.")
    jmf = models.Strain(
        name="Jedi Mind Fuck", species="Psilocybe cubensis", strain_code="QBM-JMF",
        mushroom_type="psychedelic", vendor="Spore Depot", genetics="JMF lineage",
        potency="Very High", ease_rating=3, grow_again=True, generation=1,
        target_temp_c=24, target_humidity=92, target_co2_ppm=700, typical_be=80, typical_flushes=2,
        notes="Currently colonizing in grain bags.")
    lions = models.Strain(
        name="Lion's Mane", species="Hericium erinaceus", strain_code="QBM-LM",
        mushroom_type="functional", vendor="North Spore", genetics="Commercial LM",
        potency="Nootropic", ease_rating=4, grow_again=True,
        target_temp_c=18, target_humidity=95, target_co2_ppm=600, typical_be=70, typical_flushes=3,
        notes="High RH + strong FAE for compact fruits.")
    blue_oyster = models.Strain(
        name="Blue Oyster", species="Pleurotus ostreatus", strain_code="QBM-BO",
        mushroom_type="gourmet", vendor="North Spore", genetics="Commercial PO",
        potency="—", ease_rating=5, grow_again=True,
        target_temp_c=17, target_humidity=90, target_co2_ppm=600, typical_be=90, typical_flushes=3,
        notes="Fast & forgiving; great for SMS secondary flush.")
    db.add_all([stargazer, illusion, jmf, lions, blue_oyster])
    db.flush()
    # Lineage example: Illusion Weaver F3 cloned from Stargazer line.
    illusion.lineage_parent_id = stargazer.id

    # --- Recipes --------------------------------------------------------- #
    cvg = models.Recipe(name="CVG Bulk (Coir/Verm/Gypsum)", block_weight_kg=2.7,
                        prep_notes="Hydrate coir w/ boiling water, mix verm + gypsum, field capacity.")
    cvg.ingredients = [
        models.RecipeIngredient(name="Coco coir", quantity=0.65, unit="kg", unit_cost=1.20),
        models.RecipeIngredient(name="Vermiculite", quantity=0.45, unit="kg", unit_cost=0.90),
        models.RecipeIngredient(name="Gypsum", quantity=0.05, unit="kg", unit_cost=0.40),
    ]
    masters = models.Recipe(name="Masters Mix (Hardwood/Soy)", block_weight_kg=2.5,
                           prep_notes="50/50 hardwood pellet + soy hull, sterilize 2.5h.")
    masters.ingredients = [
        models.RecipeIngredient(name="Hardwood fuel pellets", quantity=1.1, unit="kg", unit_cost=0.55),
        models.RecipeIngredient(name="Soybean hulls", quantity=1.1, unit="kg", unit_cost=0.70),
    ]
    db.add_all([cvg, masters])
    db.flush()

    # --- Staff ----------------------------------------------------------- #
    isaac = models.Staff(name="Isaac Childs", role="owner/operator", hourly_rate=0)
    picker = models.Staff(name="Dev (part-time)", role="picker", hourly_rate=20)
    db.add_all([isaac, picker])
    db.flush()

    # --- Batches --------------------------------------------------------- #
    b_stg = models.Batch(lot_code="STG-2605", strain_id=stargazer.id, recipe_id=cvg.id,
                         room_id=fruit.id, stage="harvesting", block_count=6,
                         substrate_weight_kg=16.2, inoculated_on=today - timedelta(days=38),
                         colonized_on=today - timedelta(days=22), fruiting_on=today - timedelta(days=14))
    b_ilw = models.Batch(lot_code="ILW-2606", strain_id=illusion.id, recipe_id=cvg.id,
                         room_id=fruit.id, stage="harvesting", block_count=5,
                         substrate_weight_kg=13.5, inoculated_on=today - timedelta(days=34),
                         colonized_on=today - timedelta(days=18), fruiting_on=today - timedelta(days=10))
    b_jmf = models.Batch(lot_code="JMF-2531", strain_id=jmf.id, recipe_id=cvg.id,
                         room_id=incub.id, stage="colonization", block_count=8,
                         substrate_weight_kg=4.0, inoculated_on=today - timedelta(days=9))
    b_lm = models.Batch(lot_code="LM-2528", strain_id=lions.id, recipe_id=masters.id,
                        room_id=fruit.id, stage="fruiting", block_count=10,
                        substrate_weight_kg=25.0, inoculated_on=today - timedelta(days=26),
                        colonized_on=today - timedelta(days=12), fruiting_on=today - timedelta(days=3))
    b_bo = models.Batch(lot_code="BO-2510", strain_id=blue_oyster.id, recipe_id=masters.id,
                        room_id=None, stage="spent", block_count=8,
                        substrate_weight_kg=20.0, inoculated_on=today - timedelta(days=55),
                        spent_on=today - timedelta(days=5))
    db.add_all([b_stg, b_ilw, b_jmf, b_lm, b_bo])
    db.flush()

    for b in (b_stg, b_ilw, b_jmf, b_lm, b_bo):
        db.add(models.StageEvent(batch_id=b.id, stage=b.stage, room_id=b.room_id,
                                 block_count=b.block_count, note="Seeded"))

    # --- Harvests (real-ish numbers; Stargazer F1 = 445g/31.2g = 7%) ----- #
    harvests = [
        models.Harvest(batch_id=b_stg.id, harvested_on=today - timedelta(days=12), flush_number=1,
                       weight_kg=0.445, dry_weight_kg=0.0312, grade="A", picker_id=isaac.id, labor_minutes=35),
        models.Harvest(batch_id=b_stg.id, harvested_on=today - timedelta(days=4), flush_number=2,
                       weight_kg=0.612, dry_weight_kg=0.058, grade="A", picker_id=isaac.id, labor_minutes=40),
        models.Harvest(batch_id=b_ilw.id, harvested_on=today - timedelta(days=8), flush_number=1,
                       weight_kg=0.388, dry_weight_kg=0.027, grade="A", picker_id=picker.id, labor_minutes=30),
        models.Harvest(batch_id=b_ilw.id, harvested_on=today - timedelta(days=2), flush_number=2,
                       weight_kg=0.401, dry_weight_kg=0.036, grade="B", picker_id=picker.id, labor_minutes=33),
        models.Harvest(batch_id=b_lm.id, harvested_on=today - timedelta(days=1), flush_number=1,
                       weight_kg=1.85, dry_weight_kg=0.18, grade="A", picker_id=isaac.id, labor_minutes=25),
    ]
    db.add_all(harvests)
    db.flush()

    db.add(models.ContaminationLog(batch_id=b_jmf.id, observed_on=today - timedelta(days=2),
                                   contam_type="trichoderma", severity="low",
                                   action_taken="Isolated 1 grain bag, monitoring.", reported_by="Isaac"))

    # --- Environment readings (last 24h, hourly-ish) --------------------- #
    now = datetime.utcnow()
    for hours_ago in range(24, -1, -2):
        ts = now - timedelta(hours=hours_ago)
        db.add(models.EnvironmentReading(room_id=fruit.id, recorded_at=ts,
               temp_c=20 + (hours_ago % 3) * 0.4, humidity=91 + (hours_ago % 4),
               co2_ppm=680 + (hours_ago % 5) * 60, fae_per_hr=5 - (hours_ago % 2)))
        db.add(models.EnvironmentReading(room_id=incub.id, recorded_at=ts,
               temp_c=24 + (hours_ago % 2) * 0.3, humidity=64 + (hours_ago % 3),
               co2_ppm=5200, fae_per_hr=1))
    # One out-of-spec spike (high CO₂, low FAE) as the newest reading to trip alerts.
    db.add(models.EnvironmentReading(room_id=fruit.id, recorded_at=now + timedelta(minutes=5),
           temp_c=20.2, humidity=90, co2_ppm=1250, fae_per_hr=2, source="sensor"))

    # --- Inventory ------------------------------------------------------- #
    db.add_all([
        models.InventoryItem(name="Sterilized grain bags (3lb)", category="spawn", unit="bag",
                             quantity_on_hand=6, reorder_threshold=10, unit_cost=6.5, supplier="North Spore"),
        models.InventoryItem(name="Coco coir bricks", category="substrate", unit="brick",
                             quantity_on_hand=22, reorder_threshold=8, unit_cost=3.2, supplier="Local Hydro"),
        models.InventoryItem(name="Liquid culture syringes", category="spawn", unit="syringe",
                             quantity_on_hand=4, reorder_threshold=5, unit_cost=18.0, supplier="Spore Depot"),
        models.InventoryItem(name="Mylar dry bags + desiccant", category="packaging", unit="kit",
                             quantity_on_hand=120, reorder_threshold=50, unit_cost=0.45, supplier="Uline"),
        models.InventoryItem(name="70% isopropyl alcohol", category="chemical", unit="L",
                             quantity_on_hand=3, reorder_threshold=4, unit_cost=5.0, supplier="Costco"),
    ])

    # --- Tasks ----------------------------------------------------------- #
    db.add_all([
        models.Task(title="Mist Fruiting Tent A 3x", batch_id=b_lm.id, room_id=fruit.id,
                    assigned_to=isaac.id, due_date=today, priority="high"),
        models.Task(title="Check JMF grain bags for contam spread", batch_id=b_jmf.id,
                    assigned_to=isaac.id, due_date=today, priority="high"),
        models.Task(title="Spawn JMF to bulk tubs", batch_id=b_jmf.id, assigned_to=isaac.id,
                    due_date=today + timedelta(days=4), priority="med"),
        models.Task(title="Reorder grain bags + LC syringes", assigned_to=isaac.id,
                    due_date=today + timedelta(days=2), priority="med"),
        models.Task(title="Weigh + bag Stargazer F2 dry", batch_id=b_stg.id, assigned_to=picker.id,
                    due_date=today - timedelta(days=1), status="done", priority="low"),
    ])

    # --- Customers ------------------------------------------------------- #
    quantum = models.Customer(name="Quantum Blue Distribution", channel="distributor",
                              contact_email="orders@quantumblue.example", phone="801-555-0142")
    wellness = models.Customer(name="Wasatch Wellness Collective", channel="wholesale",
                               contact_email="buy@wasatchwellness.example", phone="801-555-0199")
    market = models.Customer(name="SLC Farmers Market (cash)", channel="farmers_market")
    db.add_all([quantum, wellness, market])
    db.flush()

    # --- Products (retail + distributor pricing) ------------------------- #
    p_stg_dry = models.Product(name="Stargazer — dried", sku="STG-DRY-G", strain_id=stargazer.id,
                               category="dried", unit="g", price=12.0, distributor_price=7.0)
    p_ilw_dry = models.Product(name="Illusion Weaver — dried", sku="ILW-DRY-G", strain_id=illusion.id,
                               category="dried", unit="g", price=12.0, distributor_price=7.0)
    p_lm_fresh = models.Product(name="Lion's Mane — fresh", sku="LM-FRESH-LB", strain_id=lions.id,
                                category="fresh", unit="lb", price=18.0, distributor_price=12.0)
    db.add_all([p_stg_dry, p_ilw_dry, p_lm_fresh])
    db.flush()

    # --- Orders (lines linked to harvests -> enables recall tracing) ----- #
    o1 = models.Order(order_number="QBM-1001", customer_id=quantum.id, channel="distributor",
                      order_date=today - timedelta(days=3), status="fulfilled",
                      fulfillment_date=today - timedelta(days=2))
    o1.lines = [models.OrderLine(product_id=p_stg_dry.id, harvest_id=harvests[0].id,
                                 quantity=28, unit_price=7.0)]
    o2 = models.Order(order_number="QBM-1002", customer_id=wellness.id, channel="wholesale",
                      order_date=today - timedelta(days=1), status="confirmed")
    o2.lines = [
        models.OrderLine(product_id=p_ilw_dry.id, harvest_id=harvests[2].id, quantity=20, unit_price=7.0),
        models.OrderLine(product_id=p_lm_fresh.id, harvest_id=harvests[4].id, quantity=3, unit_price=12.0),
    ]
    db.add_all([o1, o2])

    # --- Food safety / GAP logs ------------------------------------------ #
    db.add_all([
        models.FoodSafetyLog(log_date=today, category="sanitation",
                             description="Flow hood + tools wiped w/ 70% IPA before transfers.",
                             performed_by="Isaac", passed=True),
        models.FoodSafetyLog(log_date=today - timedelta(days=1), category="worker_hygiene",
                             description="Gloves + mask during harvest/packaging.",
                             performed_by="Isaac", passed=True),
        models.FoodSafetyLog(log_date=today - timedelta(days=2), category="temperature",
                             description="Cold storage logged at 3°C.", performed_by="Dev", passed=True),
    ])

    db.commit()
    db.close()
    print("Seeded Shroom OS with Quantum Blue Mycology demo data.")


if __name__ == "__main__":
    seed()
