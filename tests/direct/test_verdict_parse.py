"""Unit tests for Roy Arena verdict parsing — no GenLayer runtime required."""
import ast
from pathlib import Path


def _load_helpers():
    contract = Path(__file__).resolve().parents[2] / "contracts" / "roy_arena.py"
    module = ast.parse(contract.read_text())
    keep = {
        "MIN_FEEDBACK_LEN",
        "MAX_URL_LEN",
        "PLACEHOLDER_FEEDBACK",
        "SCORE_TOLERANCE",
        "REALITY_TRUE",
        "REALITY_FALSE",
        "REALITY_TOO_EARLY",
        "_as_bool",
        "_first_integer",
        "_as_score",
        "_feedback_is_substantive",
        "_parse_json_object",
        "_try_parse_verdict",
        "_normalize_reality_outcome",
        "_try_parse_reality",
        "_same_judgment",
        "_same_reality",
        "_parse_iso_date",
        "_is_http_url",
    }
    body = []
    for node in module.body:
        if isinstance(node, ast.Assign):
            names = [t.id for t in node.targets if isinstance(t, ast.Name)]
            if any(name in keep for name in names):
                body.append(node)
        elif isinstance(node, ast.FunctionDef) and node.name in keep:
            body.append(node)
    ns: dict = {}
    exec(compile(ast.Module(body=body, type_ignores=[]), str(contract), "exec"), ns)
    return ns


H = _load_helpers()


def test_as_score_accepts_float_and_fraction():
    assert H["_as_score"](8) == 8
    assert H["_as_score"](8.0) == 8
    assert H["_as_score"]("8.0") == 8
    assert H["_as_score"]("8/10") == 8
    assert H["_as_score"](True) is None
    assert H["_as_score"](11) is None


def test_float_verdict_parses_and_commits_shape():
    parsed = H["_try_parse_verdict"](
        {"is_valid": True, "score": 8.0, "feedback": "Sharp and funny chain joke."}
    )
    assert parsed == {
        "is_valid": True,
        "score": 8,
        "feedback": "Sharp and funny chain joke.",
    }


def test_independent_score_within_tolerance_agrees():
    leader = {"is_valid": True, "score": 8, "feedback": "Sharp and funny chain joke."}
    independent = {"is_valid": True, "score": 5, "feedback": "The joke works."}
    assert H["_same_judgment"](leader, independent) is True
    assert H["SCORE_TOLERANCE"] == 3


def test_divergent_score_still_rejected():
    leader = {"is_valid": True, "score": 9, "feedback": "Outstanding original chain humor."}
    independent = {
        "is_valid": True,
        "score": 2,
        "feedback": "The joke is thin and does not land.",
    }
    assert H["_same_judgment"](leader, independent) is False


def test_spam_judges_can_agree_to_reject():
    leader = {
        "is_valid": False,
        "score": 1,
        "feedback": "This is unrelated spam, not a meme at all.",
    }
    independent = {
        "is_valid": False,
        "score": 1,
        "feedback": "Unrelated spam rather than a meme.",
    }
    assert H["_same_judgment"](leader, independent) is True


def test_placeholder_independent_feedback_rejected():
    leader = {"is_valid": True, "score": 8, "feedback": "Sharp and funny chain joke."}
    independent = {"is_valid": True, "score": 8, "feedback": "No feedback"}
    assert H["_same_judgment"](leader, independent) is False


def test_loose_parse_allows_short_independent_feedback():
    loose = H["_try_parse_verdict"](
        {"is_valid": True, "score": 8, "feedback": "Funny."},
        require_substantive_feedback=False,
    )
    assert loose["score"] == 8
    assert H["_try_parse_verdict"](
        {"is_valid": True, "score": 8, "feedback": "Funny."}
    ) is None


def test_reality_parse_and_independent_outcome_match():
    parsed = H["_try_parse_reality"](
        {
            "outcome": "confirmed",
            "evidence_note": "The status page lists live GPU inventory.",
        }
    )
    assert parsed["outcome"] == "true"
    leader = parsed
    independent = H["_try_parse_reality"](
        {
            "outcome": "true",
            "evidence_note": "Inventory is live on the public page.",
        },
        require_substantive_note=False,
    )
    assert H["_same_reality"](leader, independent) is True


def test_divergent_reality_outcome_rejected():
    leader = {
        "outcome": "true",
        "evidence_note": "The status page lists live GPU inventory.",
    }
    independent = {
        "outcome": "false",
        "evidence_note": "The page is a parked domain with no product.",
    }
    assert H["_same_reality"](leader, independent) is False


def test_deadline_and_url_helpers():
    assert H["_parse_iso_date"]("2026-12-31") == "2026-12-31"
    assert H["_parse_iso_date"]("2026-13-01") is None
    assert H["_is_http_url"]("https://example.com/gpu-status") is True
    assert H["_is_http_url"]("not-a-url") is False


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_") and callable(fn):
            fn()
            print(f"ok  {name}")
    print("ALL PARSE HELPER CHECKS PASSED")
