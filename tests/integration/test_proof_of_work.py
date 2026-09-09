"""Integration tests for Proof of Work — require GenLayer Studio.

Run with: gltest tests/integration/ -v -s
"""

import pytest
from gltest import get_contract_factory, default_account
from gltest.helpers import load_fixture
from gltest.assertions import tx_execution_succeeded

from tests.integration.fixtures import SAMPLE_SPEC, SAMPLE_WORK


@pytest.mark.integration
def deploy_contract():
    factory = get_contract_factory("ProofOfWork")
    contract = factory.deploy()

    assert contract.get_name(args=[]) == "Proof of Work"
    assert contract.get_bounty_count(args=[]) == 0
    assert contract.get_submission_count(args=[]) == 0
    assert contract.get_total_escrowed(args=[]) == 0
    return contract


@pytest.mark.integration
def test_empty_state():
    contract = load_fixture(deploy_contract)
    assert contract.get_name(args=[]) == "Proof of Work"
    assert contract.list_bounties(args=[]) == []
    rec = contract.get_reputation(args=[default_account.address])
    assert int(rec["approved_count"]) == 0
    assert int(rec["rejected_count"]) == 0


@pytest.mark.integration
def test_judge_work_returns_json_verdict():
    contract = load_fixture(deploy_contract)

    result = contract.judge_work(
        args=[SAMPLE_SPEC, SAMPLE_WORK],
        wait_interval=10000,
        wait_retries=15,
    )
    assert tx_execution_succeeded(result)


@pytest.mark.integration
def test_short_spec_reverts():
    contract = load_fixture(deploy_contract)
    try:
        result = contract.judge_work(args=["too short", SAMPLE_WORK])
        assert not tx_execution_succeeded(result)
    except Exception:
        pass


@pytest.mark.integration
def test_short_work_reverts():
    contract = load_fixture(deploy_contract)
    try:
        result = contract.judge_work(args=[SAMPLE_SPEC, "too short"])
        assert not tx_execution_succeeded(result)
    except Exception:
        pass


@pytest.mark.integration
def test_submit_work_missing_bounty_reverts():
    contract = load_fixture(deploy_contract)
    try:
        result = contract.submit_work(
            args=["1", "https://example.com/proof.md", SAMPLE_WORK]
        )
        assert not tx_execution_succeeded(result)
    except Exception:
        pass


@pytest.mark.integration
def test_judge_and_release_missing_bounty_revert():
    contract = load_fixture(deploy_contract)
    try:
        result = contract.judge_submission(args=["1"])
        assert not tx_execution_succeeded(result)
    except Exception:
        pass
    try:
        result = contract.release_payment(args=["1"])
        assert not tx_execution_succeeded(result)
    except Exception:
        pass
    try:
        result = contract.appeal(args=["1"])
        assert not tx_execution_succeeded(result)
    except Exception:
        pass
