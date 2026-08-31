"""Tests for Roy Judge Arena read-only view methods."""

from tests.direct.conftest import to_hex
from tests.direct.test_roy_arena import CONTRACT_PATH, MEME, POEM, _submit


def test_empty_leaderboard(direct_deploy):
    contract = direct_deploy(CONTRACT_PATH)
    assert contract.get_leaderboard() == {}
    assert contract.get_submissions() == []
    assert contract.get_points_board() == {}
    assert contract.get_submission_count() == 0


def test_get_player_points_default_zero(direct_deploy, direct_alice):
    contract = direct_deploy(CONTRACT_PATH)
    alice = to_hex(direct_alice)
    assert contract.get_player_points(alice) == 0


def test_get_player_points_unknown_address(direct_deploy):
    contract = direct_deploy(CONTRACT_PATH)
    assert contract.get_player_points("0x" + "11" * 20) == 0


def test_points_accumulate(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy(CONTRACT_PATH)
    direct_vm.sender = direct_alice
    alice = to_hex(direct_alice)

    _submit(contract, direct_vm, alice, "Meme", MEME, 8, "Sharp and funny chain joke.")
    _submit(contract, direct_vm, alice, "Poem", POEM, 6, "Nice rhythm and a clean closing image.")

    assert contract.get_player_points(alice) == 14
    board = contract.get_leaderboard()
    listed = contract.get_submissions()
    assert len(board) == 2
    assert len(listed) == 2
    assert contract.get_submission_count() == 2
    scores = sorted(item["score"] for item in board.values())
    assert scores == [6, 8]
    assert sorted(item["score"] for item in listed) == [6, 8]
    assert contract.get_points_board()[alice.lower()] == 14
