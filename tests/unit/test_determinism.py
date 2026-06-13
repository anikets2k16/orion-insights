"""NFR-1 — determinism primitives."""
from infrastructure.determinism import now_iso, session_id, stable_hash


def test_stable_hash_order_independent():
    assert stable_hash({"a": 1, "b": 2}) == stable_hash({"b": 2, "a": 1})


def test_session_id_reproducible():
    a = session_id("AI in 2026", "researcher", {"x": 1})
    b = session_id("AI in 2026", "researcher", {"x": 1})
    assert a == b


def test_session_id_varies_by_input():
    assert session_id("topic A", "researcher", {}) != session_id("topic B", "researcher", {})


def test_frozen_clock_in_deterministic_mode():
    assert now_iso() == now_iso()  # frozen epoch
