-- Seed the operation's real grow spaces into the room model.
--
-- The app shipped with four generic demo rooms (Cold Storage / Fruiting Tent A /
-- Incubation / Lab). These are the actual tents in use. Targets are stored in
-- the canonical units the schema uses — °C for temperature — so the Fahrenheit
-- ranges the operator thinks in are converted to their midpoint here; the full
-- human description (range + FAE regime) is preserved verbatim in `notes`.
--
-- Idempotent: each room is inserted only when a room of that name doesn't
-- already exist, so re-running the migration (or adding one by hand first) is
-- safe. room_type uses the app vocabulary (incubation/fruiting/drying/lab/
-- storage); "colonization" spaces map to `incubation`.

insert into public.rooms
  (name, room_type, target_temp_c, target_humidity, target_co2_ppm, target_fae_per_hr, notes)
select v.name, v.room_type, v.target_temp_c, v.target_humidity, v.target_co2_ppm,
       v.target_fae_per_hr, v.notes
from (values
  -- 60–68°F → mid 64°F ≈ 17.8°C. Functional fruiting, heavy fresh-air exchange.
  ('BoomRoom II #1',      'fruiting',   17.8, 90, 700,  6,
   'Functional fruiting. 60–68°F. Heavy FAE.'),
  -- 70–78°F → mid 74°F ≈ 23.3°C. Warm room for pink oyster / reishi antler.
  ('BoomRoom II #2',      'fruiting',   23.3, 88, 900,  4,
   'Warm ~70–78°F. Pink oyster / reishi antler.'),
  -- 72–76°F → mid 74°F ≈ 23.3°C. Dark colonization, no FAE (high CO₂ wanted).
  ('4×4 colonization',    'incubation', 23.3, 95, 5000, 0,
   'Colonization. Dark, 72–76°F. No FAE.'),
  ('4×7 Tennyson tent',   'incubation', 23.3, 95, 5000, 0,
   'Colonization tent.'),
  ('Cultivator 5×5',      'fruiting',   17.8, 90, 800,  4,
   'Cultivator 5×5.')
) as v(name, room_type, target_temp_c, target_humidity, target_co2_ppm, target_fae_per_hr, notes)
where not exists (
  select 1 from public.rooms r where r.name = v.name
);
