"""Register structure and preserved IDs; no runtime or acceptance inference."""

from pathlib import Path

import pytest

from scripts.check_owner_requirements import audit, parse_register

SINGLE = """| S0 | Current owner directive | DO |
| <a id="vis-01"></a>VIS-01 | Alive | S0 DO | IM; G-open | Owner acceptance | P1 · RENDER · V |
"""


def test_current_register_retains_all_material_ids_and_resolved_dependencies():
    result = audit(Path(__file__).resolve().parents[2])
    assert result["requirements"] >= 66
    assert result["styles"] >= 11
    assert result["acceptance_inferred"] is False


@pytest.mark.parametrize(
    "text, message",
    [
        (SINGLE + SINGLE.splitlines()[1], "Duplicate"),
        (SINGLE.replace("S0 DO", "S99 DO"), "Unknown or absent source"),
        (SINGLE.replace("RENDER", "VIS-99"), "Unknown dependencies"),
        (SINGLE.replace("RENDER", "VIS-01"), "Circular prerequisite"),
        (SINGLE.replace("| Owner acceptance", "|"), "six complete"),
    ],
)
def test_malformed_registers_fail_instead_of_silently_losing_requests(text, message):
    with pytest.raises(ValueError, match=message):
        parse_register(text)


def test_missing_old_requirement_is_not_erased_by_a_shorter_new_register():
    with pytest.raises(ValueError, match="Missing preserved"):
        parse_register(SINGLE, required_ids={"VIS-01", "UX-11"})
