"""Fail closed before an import can replace valid records with misread cells."""
from collections import Counter


def validate_import(parsed):
    invalid = [h for h in parsed.harvests if h.unparsed or h.date_text]
    if invalid:
        raise ValueError(f"Unreadable harvest cells in {invalid[0].lot_code}. Fix the weight/date cells before importing; existing records were kept.")
    duplicates = [key for key, count in Counter(h.lot_code for h in parsed.harvests).items() if count > 1]
    if duplicates:
        raise ValueError(f"Duplicate harvest key {duplicates[0]}. Give each separate pick a unique Harvest ID; existing records were kept.")
    for h in parsed.harvests:
        if h.fresh_g < 0 or h.dry_g < 0 or (h.fresh_recorded and h.dry_recorded and h.dry_g > h.fresh_g):
            raise ValueError(f"Invalid fresh/dry weights in {h.lot_code}. Review the Sheet before importing.")


def validate_layout(wb, *, master=False):
    """Reject renamed required columns before an empty section can look successful."""
    from .parse import _get_sheet, _matrix, _find_header, _col
    specs = [
        (("Strain Library",), ["strain", "status", "potency", "grow again"], ["strain", "status", "potency", "grow again"]),
        (("Harvest Tracker", "Harvest"), ["strain", "tub", "flush", "fresh"], ["strain", "tub", "flush", "harvest date", "fresh", "dry"]),
        (("Grow Cycle Log",), ["strain", "tub"], ["strain", "tub"]),
    ]
    for names, tokens, columns in specs:
        ws = _get_sheet(wb, *names)
        if ws is None:
            if master: raise ValueError(f"Missing required Master Sheet tab: {names[0]}. No records changed.")
            continue
        matrix = _matrix(ws)
        header = _find_header(matrix, tokens)
        if header < 0 or any(_col(matrix[header], column) < 0 for column in columns):
            raise ValueError(f"Unrecognized columns in {names[0]}. Restore the expected headings before importing.")
