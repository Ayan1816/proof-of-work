"""Integration tests for Roy Judge Arena — require GenLayer Studio.

Run with: gltest tests/integration/ -v -s
"""

import json

import pytest
from gltest import get_contract_factory, default_account
from gltest.helpers import load_fixture
from gltest.assertions import tx_execution_succeeded

from tests.integration.fixtures import SAMPLE_MEME, SAMPLE_STARTUP


@pytest.mark.integration
def deploy_contract():
    factory = get_contract_factory("RoyJudgeArena")
    contract = factory.deploy()

    assert contract.get_leaderboard(args=[]) == {}
    assert contract.get_player_points(args=[default_account.address]) == 0
    return contract


@pytest.mark.integration
def test_empty_state():
    contract = load_fixture(deploy_contract)
    assert contract.get_leaderboard(args=[]) == {}
    assert contract.get_player_points(args=[default_account.address]) == 0


@pytest.mark.integration
def test_submit_and_judge_records_consensus_score():
    contract = load_fixture(deploy_contract)

    result = contract.submit_and_judge(
        args=[default_account.address, "Meme", SAMPLE_MEME],
        wait_interval=10000,
        wait_retries=15,
    )
    assert tx_execution_succeeded(result)

    board = contract.get_leaderboard(args=[])
    assert len(board) == 1
    entry = next(iter(board.values()))
    assert entry["category"] == "Meme"
    assert entry["content"] == SAMPLE_MEME
    assert 1 <= int(entry["score"]) <= 10
    assert len(str(entry["feedback"]).strip()) > 0
    assert contract.get_player_points(args=[default_account.address]) == int(entry["score"])


@pytest.mark.integration
def test_invalid_category_reverts():
    contract = load_fixture(deploy_contract)
    try:
        result = contract.submit_and_judge(
            args=[default_account.address, "Song", SAMPLE_MEME]
        )
        assert not tx_execution_succeeded(result)
    except Exception:
        pass
    assert contract.get_leaderboard(args=[]) == {}


@pytest.mark.integration
def test_short_content_reverts():
    contract = load_fixture(deploy_contract)
    try:
        result = contract.submit_and_judge(
            args=[default_account.address, "Poem", "too short"]
        )
        assert not tx_execution_succeeded(result)
    except Exception:
        pass
    assert contract.get_leaderboard(args=[]) == {}


@pytest.mark.integration
def test_second_submission_accumulates_points():
    contract = load_fixture(deploy_contract)

    first = contract.submit_and_judge(
        args=[default_account.address, "Meme", SAMPLE_MEME],
        wait_interval=10000,
        wait_retries=15,
    )
    assert tx_execution_succeeded(first)

    second = contract.submit_and_judge(
        args=[default_account.address, "Startup", SAMPLE_STARTUP],
        wait_interval=10000,
        wait_retries=15,
    )
    assert tx_execution_succeeded(second)

    board = contract.get_leaderboard(args=[])
    assert len(board) == 2
    total = sum(int(item["score"]) for item in board.values())
    assert contract.get_player_points(args=[default_account.address]) == total


@pytest.mark.integration
def test_submit_return_payload_is_json():
    contract = load_fixture(deploy_contract)
    result = contract.submit_and_judge(
        args=[default_account.address, "Meme", SAMPLE_MEME],
        wait_interval=10000,
        wait_retries=15,
    )
    assert tx_execution_succeeded(result)

    board = contract.get_leaderboard(args=[])
    entry = next(iter(board.values()))
    payload = json.dumps(
        {
            "feedback": entry["feedback"],
            "id": next(iter(board.keys())),
            "score": int(entry["score"]),
            "status": "Success",
        },
        sort_keys=True,
    )
    parsed = json.loads(payload)
    assert parsed["status"] == "Success"
    assert 1 <= parsed["score"] <= 10
