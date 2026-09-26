"""Create -> submit -> judge -> release, then prove the winner was paid.

This fails when the triggered payout transaction reports a GenVM ERROR or
when the winner's native GEN balance does not increase by the bounty reward.

Run against Studio:

    gltest tests/test_lifecycle.py -v -s --network localnet
"""

import json

import pytest

gltest = pytest.importorskip("gltest")
from gltest import get_contract_factory
from gltest.assertions import tx_execution_succeeded

from tests.integration.fixtures import LIVE_DESCRIPTION, LIVE_PROOF_URL, LIVE_SPEC

REWARD = 10**15
DEADLINE = 2_000_000_000


def _address(account) -> str:
    value = getattr(account, "address", None) or account
    return str(value)


def _triggered_error(receipt) -> str:
    """Return a message if any child transaction executed with an error."""
    raw = receipt
    if not isinstance(raw, dict):
        raw = getattr(receipt, "__dict__", {}) or {}
    blobs = []
    for key in (
        "triggered_transactions",
        "triggeredTransactions",
        "children",
        "child_transactions",
    ):
        value = raw.get(key) if isinstance(raw, dict) else None
        if value:
            blobs.extend(value if isinstance(value, list) else [value])
    for child in blobs:
        data = child if isinstance(child, dict) else getattr(child, "__dict__", {})
        text = json.dumps(data, default=str)
        upper = text.upper()
        if "FINISHED_WITH_ERROR" in upper or '"ERROR"' in upper or "EXECUTION_RESULT\": \"ERROR" in text:
            return text[:2000]
        result = str(
            data.get("execution_result")
            or data.get("tx_execution_result")
            or data.get("txExecutionResult")
            or data.get("genvm_result")
            or ""
        ).upper()
        if result in {"ERROR", "FINISHED_WITH_ERROR"}:
            return text[:2000]
    return ""


@pytest.mark.integration
def test_release_pays_winner_and_child_transfer_succeeds(accounts):
    factory = get_contract_factory("ProofOfWork")
    creator = accounts[0]
    winner = accounts[1]
    winner_addr = _address(winner)
    contract = factory.deploy(account=creator)

    winner_before = int(contract.get_account_balance(args=[winner_addr]))
    contract_before = int(contract.get_contract_balance(args=[]))

    created = contract.create_bounty(
        args=["Example domain page", LIVE_SPEC, REWARD, DEADLINE],
        value=REWARD,
        account=creator,
        wait_interval=8000,
        wait_retries=30,
        wait_triggered_transactions=True,
    )
    assert tx_execution_succeeded(created)
    contract_locked = int(contract.get_contract_balance(args=[]))
    assert contract_locked >= contract_before + REWARD, (
        f"Contract balance did not lock the reward: before={contract_before} "
        f"after={contract_locked} reward={REWARD}"
    )

    submitted = contract.submit_work(
        args=["1", LIVE_PROOF_URL, LIVE_DESCRIPTION],
        account=winner,
        wait_interval=8000,
        wait_retries=30,
    )
    assert tx_execution_succeeded(submitted)

    judged = contract.judge_submission(
        args=["1"],
        wait_interval=15000,
        wait_retries=40,
    )
    assert tx_execution_succeeded(judged)
    bounty = contract.get_bounty(args=["1"])
    assert bounty["status"] == "Approved", bounty

    released = contract.release_payment(
        args=["1"],
        account=creator,
        wait_interval=8000,
        wait_retries=40,
        wait_triggered_transactions=True,
    )
    assert tx_execution_succeeded(released)
    child_error = _triggered_error(released)
    assert not child_error, f"Triggered payout transaction errored: {child_error}"

    winner_after = int(contract.get_account_balance(args=[winner_addr]))
    contract_after = int(contract.get_contract_balance(args=[]))
    assert winner_after >= winner_before + REWARD, (
        f"Winner balance did not increase: before={winner_before} "
        f"after={winner_after} reward={REWARD}"
    )
    assert contract_after <= contract_locked - REWARD, (
        f"Contract balance did not drop by the payout: locked={contract_locked} "
        f"after={contract_after} reward={REWARD}"
    )
    paid = contract.get_bounty(args=["1"])
    assert paid["status"] == "Paid"
    assert str(paid["submitter"]).lower() == winner_addr.lower()
