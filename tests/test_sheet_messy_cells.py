"""Cells that aren't plain numbers or plain dates.

Regression tests for two importer bugs:
* a weight cell holding a note ("see #121 — combined") was read as 121 g;
* a harvest date written as wet/dry notation ("Sep 21, 2026 (wet) / dry
  Sep 24 · J-59") was unreadable, so the row was dropped from the import.
"""
from __future__ import annotations

from datetime import date, datetime

import pytest
from openpyxl import Workbook

from backend.app.sheet import util
from backend.app.sheet.parse import parse_workbook


@pytest.mark.parametrize("value,expected", [
    (445, 445.0), (31.2, 31.2), ("445", 445.0), ("85g (3oz)", 85.0), ("~9 g", 9.0),
    ("1,370", 1370.0), ("1.2 kg", 1200.0), ("0", 0.0),
    ("see #121 — combined", None), ("67 wet", None), ("J-59", None), ("", None), ("TBD", None), (True, None),
])
def test_grams_only_reads_plain_weights(value, expected):
    assert util.grams(value) == expected


@pytest.mark.parametrize("value,expected", [
    ("Sep 21, 2026 (wet) / dry Sep 24 · J-59", date(2026, 9, 21)),
    ("dry Sep 24 · J-59", date(2026, 9, 24)),
    ("May 29-30, 2026", date(2026, 5, 29)),
    ("~Jun 1, 2026", date(2026, 6, 1)),
    ("2026-09-21", date(2026, 9, 21)),
    ("21 Sep 2026 wet", date(2026, 9, 21)),
    (datetime(2026, 9, 5), date(2026, 9, 5)),
    ("J-59", None), ("pending", None), ("", None),
])
def test_parse_date_takes_first_date_from_compound_text(value, expected):
    assert util.parse_date(value) == expected


def _workbook() -> Workbook:
    wb = Workbook()
    ht = wb.active
    ht.title = "Harvest Tracker"
    for row in [
        ["HARVEST TRACKER"],
        ["#", "Strain", "Tub", "Flush", "Harvest Date", "Fresh (g)", "Dry (g)", "Dry %", "Notes"],
        [112, "TAT (True Albino Teacher)", "TAT-01", "F1", datetime(2026, 9, 5), 67, "see #121 — combined", "", ""],
        [121, "TAT (True Albino Teacher)", "TAT-01", "F2", "Sep 21, 2026 (wet) / dry Sep 24 · J-59", 410, 9, "", "combined dry with #112"],
        [130, "Golden Teacher", "T-01", "F3", "pending", 0, "", "", ""],
        [131, "Golden Teacher", "T-01", "F4", None, None, None, "", ""],
    ]:
        ht.append(row)
    jar = wb.create_sheet("Jar Inventory")
    for row in [
        ["Jar ID", "Strain", "Flush", "Harvest Date", "Dry (g)", "Used (g)", "Remaining (g)", "Notes"],
        ["J-59", "TAT", "F1+F2", "Sep 24", "9g", "see sales log", "", ""],
    ]:
        jar.append(row)
    return wb


def test_harvest_weights_never_mine_digits_from_notes():
    parsed = parse_workbook(_workbook())
    tat1 = next(h for h in parsed.harvests if h.lot_code == "TAT-01-F1")
    assert tat1.fresh_g == 67
    assert tat1.dry_g == 0.0  # "not recorded", never 121
    assert "Dry (g): see #121 — combined" in tat1.notes
    assert tat1.unparsed == ["Dry (g): see #121 — combined"]


def test_compound_harvest_date_is_imported():
    parsed = parse_workbook(_workbook())
    tat2 = next(h for h in parsed.harvests if h.lot_code == "TAT-01-F2")
    assert tat2.harvested_on == date(2026, 9, 21)
    assert tat2.dry_g == 9
    assert tat2.date_text == ""


def test_jar_weights_are_strict_too():
    parsed = parse_workbook(_workbook())
    jar = parsed.jars[0]
    assert jar.dry_weight_g == 9
    assert jar.used_g == 0.0
    assert "Used (g): see sales log" in jar.notes


def test_warnings_separate_unreadable_from_missing_dates():
    warnings = parse_workbook(_workbook()).warnings()
    assert any("weight cell(s) aren't numbers" in w and "see #121" in w for w in warnings)
    assert any("couldn't be read" in w and "“pending”" in w for w in warnings)
    assert any(w.startswith("1 harvest row(s) have no harvest date yet") for w in warnings)
