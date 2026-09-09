"""Unit tests for Proof of Work verdict parsing — no GenLayer runtime required."""
import ast
from pathlib import Path


def _load_helpers():
    contract = Path(__file__).resolve().parents[2] / "contracts" / "proof_of_work.py"
    module = ast.parse(contract.read_text())
    keep = {
        "MIN_REASONING_LEN",
        "PLACEHOLDER_REASONING",
        "_as_bool",
        "_reasoning_is_substantive",
        "_try_parse_verdict",
        "_same_judgment",
        "_normalize_proof_url",
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


def test_as_bool_accepts_common_shapes():
    assert H["_as_bool"](True) is True
    assert H["_as_bool"](False) is False
    assert H["_as_bool"](1) is True
    assert H["_as_bool"]("yes") is True
    assert H["_as_bool"]("no") is False
    assert H["_as_bool"]("maybe") is None


def test_approved_verdict_parses():
    parsed = H["_try_parse_verdict"](
        {
            "approved": True,
            "reasoning": "The README lists pip install and pytest, matching the spec.",
        }
    )
    assert parsed == {
        "approved": True,
        "reasoning": "The README lists pip install and pytest, matching the spec.",
    }


def test_legacy_is_valid_feedback_shape_still_parses():
    parsed = H["_try_parse_verdict"](
        {
            "is_valid": False,
            "feedback": "The text is a moon poem and does not provide install steps.",
        }
    )
    assert parsed["approved"] is False
    assert "poem" in parsed["reasoning"].lower()


def test_status_string_verdict_parses():
    parsed = H["_try_parse_verdict"](
        {
            "verdict": "Rejected",
            "reasoning": "The write-up never mentions install or test commands.",
        }
    )
    assert parsed["approved"] is False


def test_independent_matching_verdict_agrees():
    leader = {
        "approved": True,
        "reasoning": "The README lists pip install and pytest, matching the spec.",
    }
    independent = {
        "approved": True,
        "reasoning": "Install and test commands are present.",
    }
    assert H["_same_judgment"](leader, independent) is True


def test_divergent_approval_still_rejected():
    leader = {
        "approved": True,
        "reasoning": "The README lists pip install and pytest, matching the spec.",
    }
    independent = {
        "approved": False,
        "reasoning": "The write-up never mentions install or test commands.",
    }
    assert H["_same_judgment"](leader, independent) is False


def test_rejecting_judges_can_agree():
    leader = {
        "approved": False,
        "reasoning": "The text is a moon poem and does not provide install steps.",
    }
    independent = {
        "approved": False,
        "reasoning": "Unrelated poem rather than a README.",
    }
    assert H["_same_judgment"](leader, independent) is True


def test_placeholder_independent_reasoning_rejected():
    leader = {
        "approved": True,
        "reasoning": "The README lists pip install and pytest, matching the spec.",
    }
    independent = {"approved": True, "reasoning": "No feedback"}
    assert H["_same_judgment"](leader, independent) is False


def test_github_blob_url_normalizes_to_raw():
    blob = "https://github.com/acme/app/blob/main/README.md"
    assert H["_normalize_proof_url"](blob) == (
        "https://raw.githubusercontent.com/acme/app/main/README.md"
    )
    other = "https://example.com/proof.md"
    assert H["_normalize_proof_url"](other) == other


def test_loose_parse_allows_short_independent_reasoning():
    loose = H["_try_parse_verdict"](
        {"approved": True, "reasoning": "Match."},
        require_substantive_reasoning=False,
    )
    assert loose["approved"] is True
    assert H["_try_parse_verdict"](
        {"approved": True, "reasoning": "Match."}
    ) is None


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_") and callable(fn):
            fn()
            print(f"ok  {name}")
    print("ALL PARSE HELPER CHECKS PASSED")
