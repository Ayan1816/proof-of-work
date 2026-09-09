"""Tests for Proof of Work read-only view methods."""

from tests.direct.conftest import to_hex

CONTRACT_PATH = "contracts/proof_of_work.py"


def test_get_name(direct_deploy):
    contract = direct_deploy(CONTRACT_PATH)
    assert contract.get_name() == "Proof of Work"


def test_empty_data_model(direct_deploy):
    contract = direct_deploy(CONTRACT_PATH)
    assert contract.get_bounty_count() == 0
    assert contract.get_submission_count() == 0
    assert contract.get_total_escrowed() == 0
    assert contract.list_bounties() == []


def test_unknown_bounty_reverts(direct_vm, direct_deploy):
    contract = direct_deploy(CONTRACT_PATH)
    with direct_vm.expect_revert("Bounty not found"):
        contract.get_bounty("1")


def test_reputation_defaults_to_zero(direct_deploy, direct_alice):
    contract = direct_deploy(CONTRACT_PATH)
    alice = to_hex(direct_alice)
    rec = contract.get_reputation(alice)
    assert rec == {"approved_count": 0, "rejected_count": 0}


def test_unknown_submission_reverts(direct_vm, direct_deploy):
    contract = direct_deploy(CONTRACT_PATH)
    with direct_vm.expect_revert("Submission not found"):
        contract.get_submission("1")
