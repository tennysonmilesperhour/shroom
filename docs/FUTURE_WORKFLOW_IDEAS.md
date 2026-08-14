# Future workflow and UX ideas

This is the durable backlog from the August 2026 batch-workflow research. The
current implementation covers batch photos and QR labels plus the selected
ideas: bulk actions; clone/split/merge; mobile tap-to-move; recent/favorite
choices; offline capture; undo/history; saved views; voice observations; and
task-driven record updates.

The remaining researched ideas are intentionally preserved here for possible
future implementation, roughly in recommended order.

## Near-term candidates

1. **Action-first QR landing screen refinements.** The batch page now has a
   scan-friendly action dock. A later dedicated scan mode could remove the rest
   of the page chrome and offer Take photo, advance stage, move room, observe,
   harvest, and flag contamination as full-screen actions.

2. **Room, rack, shelf, and tray QR labels.** Support scan-source then
   scan-destination moves, including printable location-label sheets and an
   explicit physical hierarchy below rooms.

3. **Guided room rounds.** Walk the operator through batches in physical order,
   one large card at a time, with Healthy, Needs attention, Photo, Recheck, and
   Skip actions. Finish with a revisit list.

4. **Automatic lot and container identifiers.** Generate collision-safe codes
   from date, strain, location, and sequence, then offer to print the exact
   number of labels created.

5. **Stage-gate checklists.** Require a small set of confirmations before a
   lifecycle transition, while allowing a documented exception rather than a
   hard block.

6. **Broader smart defaults.** Use the current batch, previous flush + 1,
   today's date, strain history, and “same as last batch” to prefill all routine
   actions—not only batch creation fields.

## Operational intelligence

7. **Exception inbox.** One queue for overdue stages, missing recent photos,
   stale observations, out-of-spec rooms, unresolved contamination, and harvest
   timing exceptions.

8. **Photo comparison and time-lapse.** Compare two captures side-by-side or by
   slider, align them by days since inoculation, and animate a batch’s visual
   history to expose stalls.

9. **Contamination triage.** Promote any photo into a structured sighting,
   choose type/severity using chips, quarantine the batch, create cleanup work,
   and compare against previously confirmed examples.

10. **Scan-and-weigh harvest station.** Scan the batch and tray, capture scale
    weight or use an oversized keypad, tap grade, suggest the next flush, and
    create the reset task in one flow.

11. **Stage-specific action bars.** Tailor quick actions to the lifecycle stage
    so colonization, fruiting, harvesting, and spent batches show only the most
    relevant operations.

## Reference sources

- [Kinoko mushroom-farm workflows](https://kinoko-app.com/)
- [MycoSense room rounds and offline operations](https://www.mycosense.ch/technology)
- [Tend farm workflows](https://www.tend.com/freshfeatures)
- [Farmbrite mobile/offline workflows](https://help.farmbrite.com/help/mobile-app)
- [GS1 Digital Link](https://www.gs1.org/standards/gs1-digital-link)
- [USDA Mushroom GAP](https://www.ams.usda.gov/services/auditing/gap-ghp/mushroom-gap)
