"""Parsing helpers for the Master Cultivation Reference workbook.

The sheet is human-maintained, so every value is treated as best-effort: a cell
that can't be parsed yields ``None`` rather than raising, and the row is still
imported with whatever else parsed. This keeps a single typo in the sheet from
blocking the whole sync.
"""
from __future__ import annotations

import re
from datetime import date, datetime

from dateutil import parser as dateparser

# A cell that means "no value yet" in the operator's shorthand.
_BLANKISH = {"", "-", "—", "–", "tbd", "n/a", "na", "none", "?"}


def clean(value: object) -> str:
    """Normalize any cell into a trimmed string ('' for blank/placeholder)."""
    if value is None:
        return ""
    text = str(value).strip()
    if text.lower() in _BLANKISH:
        return ""
    return text


def is_blank(value: object) -> bool:
    return clean(value) == ""


def parse_date(value: object) -> date | None:
    """Parse the many date shapes in the sheet ('May 17, 2026', '~Jun 1, 2026',
    'May 29-30, 2026', a real datetime) into a date. Ranges take the first day.
    Returns None when there's no usable date."""
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    text = clean(value)
    if not text:
        return None
    # Strip approximate markers and collapse day ranges ("May 29-30" -> "May 29").
    text = text.lstrip("~≈ ").strip()
    text = re.sub(r"(\d{1,2})\s*[-–]\s*\d{1,2}", r"\1", text)
    try:
        return dateparser.parse(text, default=datetime(2026, 1, 1)).date()
    except (ValueError, OverflowError, TypeError):
        return None


def first_number(value: object) -> float | None:
    """First number in a cell. '8/10' -> 8, '7-8' -> 7, '$5.88/g' -> 5.88,
    '445' -> 445, '~1 gal/day' -> 1. Returns None when there's no digit."""
    text = clean(value)
    if not text:
        return None
    match = re.search(r"-?\d+(?:\.\d+)?", text.replace(",", ""))
    return float(match.group()) if match else None


def parse_int(value: object) -> int | None:
    num = first_number(value)
    return int(round(num)) if num is not None else None


def parse_rating(value: object) -> int | None:
    """Ease rating on the sheet's /10 scale. '9/10' -> 9, '7-8' -> 7,
    'Moderate' -> None (left to the column default)."""
    return parse_int(value)


def parse_stars(value: object) -> int | None:
    """Priority stars: '*****' -> 5. Also tolerates already-numeric input."""
    text = clean(value)
    if not text:
        return None
    stars = text.count("*")
    if stars:
        return min(stars, 5)
    return parse_int(value)


_YES = {"yes", "y", "true", "1"}
_NO = {"no", "n", "false", "0"}


def parse_bool(value: object) -> bool | None:
    text = clean(value).lower()
    if text in _YES:
        return True
    if text in _NO:
        return False
    return None


def money_range(value: object) -> tuple[float | None, float | None]:
    """'$3-5/g' -> (3, 5); '$18/g' -> (18, 18); '' -> (None, None)."""
    text = clean(value)
    if not text:
        return (None, None)
    nums = re.findall(r"\d+(?:\.\d+)?", text.replace(",", ""))
    if not nums:
        return (None, None)
    if len(nums) == 1:
        return (float(nums[0]), float(nums[0]))
    return (float(nums[0]), float(nums[1]))


def grams(value: object) -> float | None:
    """Weight in grams from cells like '15', '20g', '85g (3oz)'."""
    return first_number(value)


# --- domain-specific normalizers ------------------------------------------- #

def library_status(status_text: str) -> str:
    """Map a free-text Status cell to the app's library_status vocabulary
    (active/colonizing/inoculating/awaiting/ordered/fridge/en_route)."""
    t = clean(status_text).lower()
    if not t:
        return ""
    for key in ("active", "colonizing", "inoculating", "awaiting", "ordered", "en route", "en_route"):
        if key in t:
            return key.replace(" ", "_")
    if "fridge" in t:
        return "fridge"
    if "inoculated" in t:
        return "inoculating"
    if "play" in t or "coming soon" in t:
        return "coming_soon"
    return t.split("—")[0].split("-")[0].strip()


def customer_status(status_text: str) -> str:
    """Buyer pipeline Status -> a stable token. The sheet uses emoji + prose
    ('🟢 In contact', 'Active', 'Not contacted', 'Integrated')."""
    t = clean(status_text).lower()
    # Drop any leading emoji / non-alphanumeric decoration.
    t = re.sub(r"^[^a-z]+", "", t)
    if not t:
        return "lead"
    if "not contacted" in t:
        return "not_contacted"
    if "in contact" in t:
        return "in_contact"
    if "integrated" in t:
        return "integrated"
    if "active" in t:
        return "active"
    return t.replace(" ", "_")


def channel_for_tier(tier_text: str) -> str:
    """Best-fit sales channel from a buyer's tier label."""
    t = clean(tier_text).lower()
    if "wholesale" in t and "restaurant" in t:
        return "restaurant"
    if "restaurant" in t:
        return "restaurant"
    if "wholesale" in t:
        return "wholesale"
    if "distributor" in t:
        return "distributor"
    if "retail" in t and "direct" in t:
        return "farmers_market"
    if "wellness" in t or "retail" in t:
        return "retail"
    return "wholesale"


def species_from_notes(notes: str) -> str:
    """Pull a species out of the free-text notes when the operator stated it
    ('P. cubensis', 'P. natalensis', 'Trametes versicolor', 'Hericium...')."""
    t = clean(notes)
    m = re.search(r"\bP(?:\.|silocybe)\s*([A-Za-z]+)", t)
    if m:
        return f"Psilocybe {m.group(1).lower()}"
    for genus in ("Hericium erinaceus", "Pleurotus eryngii", "Pleurotus ostreatus",
                  "Pleurotus", "Trametes versicolor", "Lentinula edodes", "Ganoderma"):
        if genus.lower() in t.lower():
            return genus
    return ""
