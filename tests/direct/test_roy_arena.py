"""Direct-mode tests for RoyJudgeArena."""

import json

from tests.direct.conftest import to_hex

CONTRACT_PATH = "contracts/roy_arena.py"
MEME = "Why did the validator cross the chain? To get to the other fork."
POEM = "Silicon dreams in quiet blocks, a poem of hashes and clocks."
STARTUP = "We match idle GPUs with researchers who need cheap inference tonight."


def _verdict(score, feedback, is_valid=True):
    return json.dumps(
        {"is_valid": is_valid, "score": score, "feedback": feedback},
        sort_keys=True,
    )


def _submit(contract, vm, address, category, content, score=8, feedback="Sharp and original work."):
    vm.mock_llm(r".*", _verdict(score, feedback))
    result = json.loads(contract.submit_and_judge(address, category, content))
    vm.clear_mocks()
    return result


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

    board = contract.get_leaderboard()
    assert len(board) == 1
    entry = next(iter(board.values()))
    assert entry["user"].lower() == alice.lower()
    assert entry["category"] == "Meme"
    assert entry["content"] == MEME
    assert entry["score"] == 8
    assert entry["feedback"]


def test_rejects_short_content(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy(CONTRACT_PATH)
    direct_vm.sender = direct_alice
    alice = to_hex(direct_alice)

    with direct_vm.expect_revert("Content too short"):
        contract.submit_and_judge(alice, "Poem", "too short")


def test_rejects_invalid_category(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy(CONTRACT_PATH)
    direct_vm.sender = direct_alice
    alice = to_hex(direct_alice)

    with direct_vm.expect_revert("Invalid category"):
        contract.submit_and_judge(alice, "Song", MEME)


def test_rejects_spam_when_judges_agree_invalid(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy(CONTRACT_PATH)
    direct_vm.sender = direct_alice
    alice = to_hex(direct_alice)

    direct_vm.mock_llm(
        r".*",
        _verdict(1, "This is unrelated spam, not a meme at all.", is_valid=False),
    )
    with direct_vm.expect_revert("Submission rejected"):
        contract.submit_and_judge(alice, "Meme", "asdf asdf asdf asdf asdf asdf")


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

    with direct_vm.expect_revert("Submission not found"):
        contract.get_submission("999")


def test_validator_agrees_when_independent_score_is_close(
    direct_vm, direct_deploy, direct_alice
):
    contract = direct_deploy(CONTRACT_PATH)
    direct_vm.sender = direct_alice
    alice = to_hex(direct_alice)

    direct_vm.mock_llm(r".*", _verdict(8, "Sharp and funny chain joke."))
    contract.submit_and_judge(alice, "Meme", MEME)
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
    contract.submit_and_judge(alice, "Meme", MEME)
    assert direct_vm._captured_validators, "Validator was not captured"

    direct_vm.clear_mocks()
    direct_vm.mock_llm(r".*", _verdict(2, "The joke is thin and does not land."))
    assert direct_vm.run_validator() is False


def test_validator_rejects_validity_disagreement(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy(CONTRACT_PATH)
    direct_vm.sender = direct_alice
    alice = to_hex(direct_alice)

    direct_vm.mock_llm(r".*", _verdict(8, "Sharp and funny chain joke."))
    contract.submit_and_judge(alice, "Meme", MEME)

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
    contract.submit_and_judge(alice, "Meme", MEME)

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
    parsed = json.loads(contract.submit_and_judge(alice, "Meme", MEME))
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
    contract.submit_and_judge(alice, "Meme", MEME)

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
