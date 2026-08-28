"""Direct-mode tests for RoyJudgeArena."""

import json

from tests.direct.conftest import to_hex

CONTRACT_PATH = "contracts/roy_arena.py"


def test_empty_leaderboard(direct_deploy):
    contract = direct_deploy(CONTRACT_PATH)
    assert contract.get_leaderboard() == {}


def test_submit_and_judge_persists_score(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy(CONTRACT_PATH)
    direct_vm.sender = direct_alice
    alice = to_hex(direct_alice)

    direct_vm.mock_llm(
        r".*",
        json.dumps({"score": 8, "feedback": "Sharp and funny."}),
    )

    result = contract.submit_and_judge(alice, "Meme", "Why did the validator cross the chain? To get to the other fork.")
    parsed = json.loads(result)
    assert parsed["status"] == "Success"
    assert parsed["score"] == 8
    assert "funny" in parsed["feedback"].lower()

    board = contract.get_leaderboard()
    assert len(board) == 1
    entry = next(iter(board.values()))
    assert entry["user"].lower() == alice.lower()
    assert entry["category"] == "Meme"
    assert entry["score"] == 8
    assert entry["feedback"]


def test_rejects_short_content(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy(CONTRACT_PATH)
    direct_vm.sender = direct_alice
    alice = to_hex(direct_alice)

    with direct_vm.expect_revert("Content too short"):
        contract.submit_and_judge(alice, "Poem", "too short")
