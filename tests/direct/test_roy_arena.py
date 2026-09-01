"""Direct-mode tests for RoyJudgeArena."""

import json

from tests.direct.conftest import to_hex

CONTRACT_PATH = "contracts/roy_arena.py"
MEME = "Why did the validator cross the chain? To get to the other fork."
POEM = "Silicon dreams in quiet blocks, a poem of hashes and clocks."
STARTUP = "We match idle GPUs with researchers who need cheap inference tonight."
CLAIM = "A public page at this URL will describe live GPU inventory for researchers."
DEADLINE = "2026-12-31"
EVIDENCE_URL = "https://example.com/gpu-status"
PAST_DEADLINE = "2020-01-01"
FUTURE_DEADLINE = "2099-12-31"


def _verdict(score, feedback, is_valid=True):
    return json.dumps(
        {"is_valid": is_valid, "score": score, "feedback": feedback},
        sort_keys=True,
    )


def _reality(outcome, note):
    return json.dumps(
        {"outcome": outcome, "evidence_note": note},
        sort_keys=True,
    )


def _submit(
    contract,
    vm,
    address,
    category,
    content,
    score=8,
    feedback="Sharp and original work.",
    claim=CLAIM,
    deadline=DEADLINE,
    evidence_url=EVIDENCE_URL,
):
    vm.mock_llm(r".*", _verdict(score, feedback))
    result = json.loads(
        contract.submit_and_judge(
            address, category, content, claim, deadline, evidence_url
        )
    )
    vm.clear_mocks()
    return result


def _judge_args(address, category, content, claim=CLAIM, deadline=DEADLINE, evidence_url=EVIDENCE_URL):
    return (address, category, content, claim, deadline, evidence_url)


def test_empty_leaderboard(direct_deploy):
    contract = direct_deploy(CONTRACT_PATH)
    assert contract.get_leaderboard() == {}
    assert contract.get_submissions() == []
    assert contract.get_points_board() == {}


def test_submit_and_judge_persists_score(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy(CONTRACT_PATH)
    direct_vm.sender = direct_alice
    alice = to_hex(direct_alice)

    parsed = _submit(contract, direct_vm, alice, "Meme", MEME, 8, "Sharp and funny chain joke.")
    assert parsed["status"] == "Success"
    assert parsed["score"] == 8
    assert "funny" in parsed["feedback"].lower()
    assert parsed["claim"] == CLAIM
    assert parsed["deadline"] == DEADLINE
    assert parsed["evidence_url"] == EVIDENCE_URL
    assert parsed["reality_outcome"] == "unresolved"

    board = contract.get_leaderboard()
    assert len(board) == 1
    entry = next(iter(board.values()))
    assert entry["user"].lower() == alice.lower()
    assert entry["category"] == "Meme"
    assert entry["content"] == MEME
    assert entry["score"] == 8
    assert entry["feedback"]
    assert entry["claim"] == CLAIM
    assert entry["deadline"] == DEADLINE
    assert entry["evidence_url"] == EVIDENCE_URL
    assert entry["resolved"] is False
    assert entry["reality_outcome"] == "unresolved"


def test_rejects_short_content(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy(CONTRACT_PATH)
    direct_vm.sender = direct_alice
    alice = to_hex(direct_alice)

    with direct_vm.expect_revert("Content too short"):
        contract.submit_and_judge(*_judge_args(alice, "Poem", "too short"))


def test_rejects_invalid_category(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy(CONTRACT_PATH)
    direct_vm.sender = direct_alice
    alice = to_hex(direct_alice)

    with direct_vm.expect_revert("Invalid category"):
        contract.submit_and_judge(*_judge_args(alice, "Song", MEME))


def test_rejects_short_claim(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy(CONTRACT_PATH)
    direct_vm.sender = direct_alice
    alice = to_hex(direct_alice)

    with direct_vm.expect_revert("Claim too short"):
        contract.submit_and_judge(*_judge_args(alice, "Meme", MEME, claim="too short"))


def test_rejects_bad_deadline(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy(CONTRACT_PATH)
    direct_vm.sender = direct_alice
    alice = to_hex(direct_alice)

    with direct_vm.expect_revert("Deadline must be a date"):
        contract.submit_and_judge(*_judge_args(alice, "Meme", MEME, deadline="31-12-2026"))


def test_rejects_bad_evidence_url(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy(CONTRACT_PATH)
    direct_vm.sender = direct_alice
    alice = to_hex(direct_alice)

    with direct_vm.expect_revert("Evidence URL"):
        contract.submit_and_judge(
            *_judge_args(alice, "Meme", MEME, evidence_url="not-a-url")
        )


def test_rejects_spam_when_judges_agree_invalid(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy(CONTRACT_PATH)
    direct_vm.sender = direct_alice
    alice = to_hex(direct_alice)

    direct_vm.mock_llm(
        r".*",
        _verdict(1, "This is unrelated spam, not a meme at all.", is_valid=False),
    )
    with direct_vm.expect_revert("Submission rejected"):
        contract.submit_and_judge(
            *_judge_args(alice, "Meme", "asdf asdf asdf asdf asdf asdf")
        )


def test_multiple_users_and_categories(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy(CONTRACT_PATH)
    alice = to_hex(direct_alice)
    bob = to_hex(direct_bob)

    direct_vm.sender = direct_alice
    _submit(contract, direct_vm, alice, "Meme", MEME, 8, "Sharp and funny chain joke.")

    direct_vm.sender = direct_bob
    _submit(contract, direct_vm, bob, "Startup", STARTUP, 7, "Clear problem and a practical GPU marketplace.")

    board = contract.get_leaderboard()
    assert len(board) == 2
    assert contract.get_player_points(alice) == 8
    assert contract.get_player_points(bob) == 7


def test_points_accumulate_for_same_user(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy(CONTRACT_PATH)
    direct_vm.sender = direct_alice
    alice = to_hex(direct_alice)

    _submit(contract, direct_vm, alice, "Meme", MEME, 8, "Sharp and funny chain joke.")
    _submit(contract, direct_vm, alice, "Poem", POEM, 6, "Nice rhythm and a clean closing image.")

    assert contract.get_player_points(alice) == 14
    assert len(contract.get_leaderboard()) == 2
    listed = contract.get_submissions()
    assert len(listed) == 2
    assert {item["id"] for item in listed} == {"1", "2"}
    assert contract.get_points_board()[alice.lower()] == 14


def test_get_submission_and_missing_id(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy(CONTRACT_PATH)
    direct_vm.sender = direct_alice
    alice = to_hex(direct_alice)

    parsed = _submit(contract, direct_vm, alice, "Poem", POEM, 9, "Vivid imagery and a confident cadence.")
    stored = contract.get_submission(parsed["id"])
    assert stored["category"] == "Poem"
    assert stored["score"] == 9
    assert stored["id"] == parsed["id"]
    assert stored["claim"] == CLAIM
    assert stored["deadline"] == DEADLINE
    assert stored["evidence_url"] == EVIDENCE_URL
    assert stored["resolved"] is False

    with direct_vm.expect_revert("Submission not found"):
        contract.get_submission("999")


def test_validator_agrees_when_independent_score_is_close(
    direct_vm, direct_deploy, direct_alice
):
    contract = direct_deploy(CONTRACT_PATH)
    direct_vm.sender = direct_alice
    alice = to_hex(direct_alice)

    direct_vm.mock_llm(r".*", _verdict(8, "Sharp and funny chain joke."))
    contract.submit_and_judge(*_judge_args(alice, "Meme", MEME))
    assert direct_vm._captured_validators, "Validator was not captured"

    # Independent judge lands nearby (within SCORE_TOLERANCE of 3).
    direct_vm.clear_mocks()
    direct_vm.mock_llm(r".*", _verdict(7, "Witty enough, with a solid chain punchline."))
    assert direct_vm.run_validator() is True


def test_validator_rejects_divergent_score(direct_vm, direct_deploy, direct_alice):
    """A format-valid 9/10 must still fail if an independent judge scores 2."""
    contract = direct_deploy(CONTRACT_PATH)
    direct_vm.sender = direct_alice
    alice = to_hex(direct_alice)

    direct_vm.mock_llm(r".*", _verdict(9, "Outstanding original chain humor."))
    contract.submit_and_judge(*_judge_args(alice, "Meme", MEME))
    assert direct_vm._captured_validators, "Validator was not captured"

    direct_vm.clear_mocks()
    direct_vm.mock_llm(r".*", _verdict(2, "The joke is thin and does not land."))
    assert direct_vm.run_validator() is False


def test_validator_rejects_validity_disagreement(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy(CONTRACT_PATH)
    direct_vm.sender = direct_alice
    alice = to_hex(direct_alice)

    direct_vm.mock_llm(r".*", _verdict(8, "Sharp and funny chain joke."))
    contract.submit_and_judge(*_judge_args(alice, "Meme", MEME))

    direct_vm.clear_mocks()
    direct_vm.mock_llm(
        r".*",
        _verdict(1, "This is unrelated spam rather than a meme.", is_valid=False),
    )
    assert direct_vm.run_validator() is False


def test_validator_rejects_placeholder_feedback(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy(CONTRACT_PATH)
    direct_vm.sender = direct_alice
    alice = to_hex(direct_alice)

    direct_vm.mock_llm(r".*", _verdict(8, "Sharp and funny chain joke."))
    contract.submit_and_judge(*_judge_args(alice, "Meme", MEME))

    direct_vm.clear_mocks()
    direct_vm.mock_llm(r".*", _verdict(8, "No feedback"))
    assert direct_vm.run_validator() is False


def test_float_score_from_llm_is_persisted(direct_vm, direct_deploy, direct_alice):
    """LLM JSON often yields 8.0 instead of 8. That must still commit."""
    contract = direct_deploy(CONTRACT_PATH)
    direct_vm.sender = direct_alice
    alice = to_hex(direct_alice)

    direct_vm.mock_llm(
        r".*",
        json.dumps(
            {"is_valid": True, "score": 8.0, "feedback": "Sharp and funny chain joke."}
        ),
    )
    parsed = json.loads(contract.submit_and_judge(*_judge_args(alice, "Meme", MEME)))
    assert parsed["status"] == "Success"
    assert parsed["score"] == 8
    assert len(contract.get_leaderboard()) == 1
    assert contract.get_submission_count() == 1


def test_validator_agrees_when_score_diff_is_within_tolerance(
    direct_vm, direct_deploy, direct_alice
):
    contract = direct_deploy(CONTRACT_PATH)
    direct_vm.sender = direct_alice
    alice = to_hex(direct_alice)

    direct_vm.mock_llm(r".*", _verdict(8, "Sharp and funny chain joke."))
    contract.submit_and_judge(*_judge_args(alice, "Meme", MEME))

    direct_vm.clear_mocks()
    direct_vm.mock_llm(r".*", _verdict(5, "The joke works, even if the punchline is mild."))
    assert direct_vm.run_validator() is True


def test_more_than_two_valid_submissions_all_persist(
    direct_vm, direct_deploy, direct_alice
):
    contract = direct_deploy(CONTRACT_PATH)
    direct_vm.sender = direct_alice
    alice = to_hex(direct_alice)

    _submit(contract, direct_vm, alice, "Meme", MEME, 8, "Sharp and funny chain joke.")
    _submit(contract, direct_vm, alice, "Poem", POEM, 6, "Nice rhythm and a clean closing image.")
    _submit(
        contract,
        direct_vm,
        alice,
        "Startup",
        STARTUP,
        7,
        "Clear problem and a practical GPU marketplace.",
    )

    board = contract.get_leaderboard()
    listed = contract.get_submissions()
    assert len(board) == 3
    assert isinstance(listed, list)
    assert len(listed) == 3
    assert contract.get_submission_count() == 3
    assert contract.get_player_points(alice) == 21
    assert contract.get_points_board()[alice.lower()] == 21
    assert {item["category"] for item in board.values()} == {"Meme", "Poem", "Startup"}
    assert {item["category"] for item in listed} == {"Meme", "Poem", "Startup"}
    assert len({item["id"] for item in listed}) == 3
    assert all(item["reality_outcome"] == "unresolved" for item in listed)


def _due_submit(contract, vm, address, category, content):
    return _submit(
        contract,
        vm,
        address,
        category,
        content,
        deadline=PAST_DEADLINE,
    )


def test_resolve_projection_confirms_live_evidence(
    direct_vm, direct_deploy, direct_alice
):
    contract = direct_deploy(CONTRACT_PATH)
    direct_vm.sender = direct_alice
    alice = to_hex(direct_alice)

    parsed = _due_submit(contract, direct_vm, alice, "Startup", STARTUP)
    direct_vm.mock_web(
        r".*example\.com.*",
        {"status": 200, "body": b"Live GPU inventory is listed for researchers."},
    )
    direct_vm.mock_llm(
        r".*",
        _reality("true", "The status page lists live GPU inventory for researchers."),
    )

    result = json.loads(contract.resolve_projection(parsed["id"]))
    assert result["status"] == "Success"
    assert result["outcome"] == "true"
    assert result["resolved"] is True
    assert "inventory" in result["evidence_note"].lower()

    stored = contract.get_submission(parsed["id"])
    assert stored["resolved"] is True
    assert stored["reality_outcome"] == "true"
    assert stored["reality_note"] == result["evidence_note"]


def test_resolve_projection_denies_when_page_contradicts(
    direct_vm, direct_deploy, direct_alice
):
    contract = direct_deploy(CONTRACT_PATH)
    direct_vm.sender = direct_alice
    alice = to_hex(direct_alice)

    parsed = _due_submit(contract, direct_vm, alice, "Startup", STARTUP)
    direct_vm.mock_web(
        r".*example\.com.*",
        {"status": 200, "body": b"This domain is for sale. No product exists."},
    )
    direct_vm.mock_llm(
        r".*",
        _reality("false", "The page is a parked domain and shows no live product."),
    )

    result = json.loads(contract.resolve_projection(parsed["id"]))
    assert result["outcome"] == "false"
    assert result["resolved"] is True
    stored = contract.get_submission(parsed["id"])
    assert stored["reality_outcome"] == "false"


def test_too_early_reality_does_not_lock(
    direct_vm, direct_deploy, direct_alice
):
    contract = direct_deploy(CONTRACT_PATH)
    direct_vm.sender = direct_alice
    alice = to_hex(direct_alice)

    parsed = _due_submit(contract, direct_vm, alice, "Startup", STARTUP)
    direct_vm.mock_web(
        r".*example\.com.*",
        {"status": 200, "body": b"Coming soon. Inventory goes live next quarter."},
    )
    direct_vm.mock_llm(
        r".*",
        _reality("too_early", "The page only says inventory is coming soon."),
    )

    result = json.loads(contract.resolve_projection(parsed["id"]))
    assert result["outcome"] == "too_early"
    assert result["resolved"] is False
    stored = contract.get_submission(parsed["id"])
    assert stored["resolved"] is False
    assert stored["reality_outcome"] == "too_early"

    direct_vm.clear_mocks()
    direct_vm.mock_web(
        r".*example\.com.*",
        {"status": 200, "body": b"Live GPU inventory is listed for researchers."},
    )
    direct_vm.mock_llm(
        r".*",
        _reality("true", "The status page now lists live GPU inventory."),
    )
    locked = json.loads(contract.resolve_projection(parsed["id"]))
    assert locked["outcome"] == "true"
    assert locked["resolved"] is True
    assert contract.get_submission(parsed["id"])["resolved"] is True


def test_resolve_before_deadline_reverts(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy(CONTRACT_PATH)
    direct_vm.sender = direct_alice
    alice = to_hex(direct_alice)

    parsed = _submit(
        contract,
        direct_vm,
        alice,
        "Startup",
        STARTUP,
        deadline=FUTURE_DEADLINE,
    )
    with direct_vm.expect_revert("Projection is not due yet"):
        contract.resolve_projection(parsed["id"])


def test_resolve_twice_reverts(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy(CONTRACT_PATH)
    direct_vm.sender = direct_alice
    alice = to_hex(direct_alice)

    parsed = _due_submit(contract, direct_vm, alice, "Startup", STARTUP)
    direct_vm.mock_web(
        r".*example\.com.*",
        {"status": 200, "body": b"Live GPU inventory is listed for researchers."},
    )
    direct_vm.mock_llm(
        r".*",
        _reality("true", "The status page lists live GPU inventory for researchers."),
    )
    json.loads(contract.resolve_projection(parsed["id"]))
    with direct_vm.expect_revert("already resolved"):
        contract.resolve_projection(parsed["id"])


def test_reality_validator_agrees_on_same_outcome(
    direct_vm, direct_deploy, direct_alice
):
    contract = direct_deploy(CONTRACT_PATH)
    direct_vm.sender = direct_alice
    alice = to_hex(direct_alice)

    parsed = _due_submit(contract, direct_vm, alice, "Startup", STARTUP)
    direct_vm.mock_web(
        r".*example\.com.*",
        {"status": 200, "body": b"Live GPU inventory is listed for researchers."},
    )
    direct_vm.mock_llm(
        r".*",
        _reality("true", "The status page lists live GPU inventory for researchers."),
    )
    contract.resolve_projection(parsed["id"])
    assert direct_vm._captured_validators, "Validator was not captured"

    direct_vm.clear_mocks()
    direct_vm.mock_web(
        r".*example\.com.*",
        {"status": 200, "body": b"Researchers can rent idle GPUs from this page."},
    )
    direct_vm.mock_llm(
        r".*",
        _reality("true", "The page still shows a live GPU rental marketplace."),
    )
    assert direct_vm.run_validator() is True


def test_reality_validator_rejects_divergent_outcome(
    direct_vm, direct_deploy, direct_alice
):
    contract = direct_deploy(CONTRACT_PATH)
    direct_vm.sender = direct_alice
    alice = to_hex(direct_alice)

    parsed = _due_submit(contract, direct_vm, alice, "Startup", STARTUP)
    direct_vm.mock_web(
        r".*example\.com.*",
        {"status": 200, "body": b"Live GPU inventory is listed for researchers."},
    )
    direct_vm.mock_llm(
        r".*",
        _reality("true", "The status page lists live GPU inventory for researchers."),
    )
    contract.resolve_projection(parsed["id"])

    direct_vm.clear_mocks()
    direct_vm.mock_web(
        r".*example\.com.*",
        {"status": 200, "body": b"This domain is for sale. No product exists."},
    )
    direct_vm.mock_llm(
        r".*",
        _reality("false", "The page is a parked domain with no live inventory."),
    )
    assert direct_vm.run_validator() is False


def test_resolve_missing_submission_reverts(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy(CONTRACT_PATH)
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("Submission not found"):
        contract.resolve_projection("999")
