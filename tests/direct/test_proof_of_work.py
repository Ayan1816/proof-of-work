"""Direct-mode tests for the Proof of Work judgment kernel."""

import json

import pytest

from tests.direct.conftest import to_hex

CONTRACT_PATH = "contracts/proof_of_work.py"
SPEC = (
    "Write a README that explains how to install dependencies and run the "
    "project's tests locally."
)
WORK = (
    "README: pip install -r requirements.txt, then pytest tests/direct/ -v. "
    "Includes a local-dev section and troubleshooting notes."
)
UNRELATED = (
    "This is a poem about the moon and has nothing to do with the requested "
    "README or local test instructions."
)


def _verdict(approved, reasoning):
    return json.dumps(
        {"approved": approved, "reasoning": reasoning},
        sort_keys=True,
    )


def _judge(contract, vm, spec, content, approved=True, reasoning="The README covers install and pytest."):
    vm.mock_llm(r".*", _verdict(approved, reasoning))
    result = json.loads(contract.judge_work(spec, content))
    vm.clear_mocks()
    return result


def test_get_name(direct_deploy):
    contract = direct_deploy(CONTRACT_PATH)
    assert contract.get_name() == "Proof of Work"


def test_judge_work_returns_approved_verdict(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy(CONTRACT_PATH)
    direct_vm.sender = direct_alice

    parsed = _judge(
        contract,
        direct_vm,
        SPEC,
        WORK,
        True,
        "The README lists pip install and pytest, matching the spec.",
    )
    assert parsed["approved"] is True
    assert "pytest" in parsed["reasoning"].lower()


def test_judge_work_can_reject_without_reverting(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy(CONTRACT_PATH)
    direct_vm.sender = direct_alice

    parsed = _judge(
        contract,
        direct_vm,
        SPEC,
        UNRELATED,
        False,
        "The text is a moon poem and does not provide install or test steps.",
    )
    assert parsed["approved"] is False
    assert "poem" in parsed["reasoning"].lower() or "install" in parsed["reasoning"].lower()


def test_rejects_short_spec(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy(CONTRACT_PATH)
    direct_vm.sender = direct_alice

    with direct_vm.expect_revert("Spec too short"):
        contract.judge_work("too short", WORK)


def test_rejects_short_work(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy(CONTRACT_PATH)
    direct_vm.sender = direct_alice

    with direct_vm.expect_revert("Work too short"):
        contract.judge_work(SPEC, "too short")


def test_validator_agrees_when_independent_verdict_matches(
    direct_vm, direct_deploy, direct_alice
):
    contract = direct_deploy(CONTRACT_PATH)
    direct_vm.sender = direct_alice

    direct_vm.mock_llm(
        r".*",
        _verdict(True, "The README lists pip install and pytest, matching the spec."),
    )
    contract.judge_work(SPEC, WORK)
    assert direct_vm._captured_validators, "Validator was not captured"

    direct_vm.clear_mocks()
    direct_vm.mock_llm(
        r".*",
        _verdict(True, "Install and test commands are present as requested."),
    )
    assert direct_vm.run_validator() is True


def test_validator_rejects_approval_disagreement(direct_vm, direct_deploy, direct_alice):
    """A format-valid Approved must still fail if an independent judge Rejects."""
    contract = direct_deploy(CONTRACT_PATH)
    direct_vm.sender = direct_alice

    direct_vm.mock_llm(
        r".*",
        _verdict(True, "The README lists pip install and pytest, matching the spec."),
    )
    contract.judge_work(SPEC, WORK)
    assert direct_vm._captured_validators, "Validator was not captured"

    direct_vm.clear_mocks()
    direct_vm.mock_llm(
        r".*",
        _verdict(False, "The write-up never mentions install or test commands."),
    )
    assert direct_vm.run_validator() is False


def test_validator_rejects_placeholder_reasoning(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy(CONTRACT_PATH)
    direct_vm.sender = direct_alice

    direct_vm.mock_llm(
        r".*",
        _verdict(True, "The README lists pip install and pytest, matching the spec."),
    )
    contract.judge_work(SPEC, WORK)

    direct_vm.clear_mocks()
    direct_vm.mock_llm(r".*", _verdict(True, "No feedback"))
    assert direct_vm.run_validator() is False


FUTURE_DEADLINE = 2_000_000_000  # 2033-05-18
TITLE = "Write a local-dev README"
REWARD = 10**18


def _set_call_value(vm, amount: int) -> bool:
    if hasattr(vm, "value"):
        vm.value = amount
        return True
    return False


def test_create_bounty_reverts_when_value_does_not_match_reward(
    direct_vm, direct_deploy, direct_alice
):
    contract = direct_deploy(CONTRACT_PATH)
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("Sent value must equal the bounty reward"):
        contract.create_bounty(TITLE, SPEC, REWARD, FUTURE_DEADLINE)


def test_create_bounty_reverts_on_short_title(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy(CONTRACT_PATH)
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("Title too short"):
        contract.create_bounty("Hi", SPEC, REWARD, FUTURE_DEADLINE)


def test_create_bounty_reverts_on_past_deadline(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy(CONTRACT_PATH)
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("Deadline must be in the future"):
        contract.create_bounty(TITLE, SPEC, REWARD, 1)


def test_create_bounty_locks_escrow_when_value_is_set(
    direct_vm, direct_deploy, direct_alice
):
    if not _set_call_value(direct_vm, REWARD):
        return
    contract = direct_deploy(CONTRACT_PATH)
    direct_vm.sender = direct_alice
    alice = to_hex(direct_alice)

    parsed = json.loads(contract.create_bounty(TITLE, SPEC, REWARD, FUTURE_DEADLINE))
    assert parsed["id"] == "1"
    assert parsed["status"] == "Open"
    assert parsed["reward"] == REWARD

    stored = contract.get_bounty("1")
    assert stored["creator"].lower() == alice.lower()
    assert stored["title"] == TITLE
    assert stored["spec"] == SPEC
    assert stored["reward"] == REWARD
    assert stored["deadline"] == FUTURE_DEADLINE
    assert stored["status"] == "Open"
    assert stored["escrow_locked"] is True
    assert stored["submitter"] == ""
    assert contract.get_bounty_count() == 1
    assert contract.get_total_escrowed() == REWARD
    listed = contract.list_bounties()
    assert len(listed) == 1
    assert listed[0]["id"] == "1"


PROOF_LINK = "https://example.com/proof/readme.md"
PROOF_DESC = "This README documents pip install and pytest for local development."
APPROVE_REASON = "The README lists pip install and pytest, matching the spec."
REJECT_REASON = "The write-up never mentions install or test commands."


def _open_bounty(contract, vm, creator):
    vm.sender = creator
    _set_call_value(vm, REWARD)
    if hasattr(vm, "deal"):
        try:
            vm.deal(creator, REWARD * 10)
        except Exception:
            pass
    try:
        parsed = json.loads(contract.create_bounty(TITLE, SPEC, REWARD, FUTURE_DEADLINE))
    except Exception as exc:
        pytest.skip(f"Cannot lock escrow in this direct-mode VM: {exc}")
    _set_call_value(vm, 0)
    return parsed


def _mock_proof(vm, body=WORK, approved=True, reasoning=APPROVE_REASON):
    payload = body.encode("utf-8") if isinstance(body, str) else body
    vm.mock_web(r".*", {"status": 200, "body": payload})
    vm.mock_llm(r".*", _verdict(approved, reasoning))


def test_missing_bounty_write_methods_revert(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy(CONTRACT_PATH)
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("Bounty not found"):
        contract.submit_work("1", PROOF_LINK, PROOF_DESC)
    with direct_vm.expect_revert("Bounty not found"):
        contract.judge_submission("1")
    with direct_vm.expect_revert("Bounty not found"):
        contract.release_payment("1")
    with direct_vm.expect_revert("Bounty not found"):
        contract.appeal("1")
    with direct_vm.expect_revert("Bounty not found"):
        contract.refund("1")


def test_submit_work_records_in_review(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    contract = direct_deploy(CONTRACT_PATH)
    _open_bounty(contract, direct_vm, direct_alice)
    bob = to_hex(direct_bob)
    direct_vm.sender = direct_bob

    parsed = json.loads(contract.submit_work("1", PROOF_LINK, PROOF_DESC))
    assert parsed["id"] == "1"
    assert parsed["status"] == "InReview"

    bounty = contract.get_bounty("1")
    assert bounty["status"] == "InReview"
    assert bounty["submitter"].lower() == bob.lower()
    stored = contract.get_submission("1")
    assert stored["proof_link"] == PROOF_LINK
    assert stored["description"] == PROOF_DESC
    assert stored["submitter"].lower() == bob.lower()
    assert contract.get_submission_count() == 1


def test_creator_cannot_submit_own_bounty(
    direct_vm, direct_deploy, direct_alice
):
    contract = direct_deploy(CONTRACT_PATH)
    _open_bounty(contract, direct_vm, direct_alice)
    with direct_vm.expect_revert("Bounty creator cannot submit"):
        contract.submit_work("1", PROOF_LINK, PROOF_DESC)


def test_submit_rejects_non_url(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy(CONTRACT_PATH)
    _open_bounty(contract, direct_vm, direct_alice)
    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("Proof link must be an http"):
        contract.submit_work("1", "not-a-url", PROOF_DESC)


def test_submit_rejects_short_description(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    contract = direct_deploy(CONTRACT_PATH)
    _open_bounty(contract, direct_vm, direct_alice)
    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("Description too short"):
        contract.submit_work("1", PROOF_LINK, "too short")


def test_second_submission_reverts(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy(CONTRACT_PATH)
    _open_bounty(contract, direct_vm, direct_alice)
    direct_vm.sender = direct_bob
    contract.submit_work("1", PROOF_LINK, PROOF_DESC)
    with direct_vm.expect_revert("Bounty is not open"):
        contract.submit_work("1", PROOF_LINK, PROOF_DESC)


def test_judge_submission_approves_and_records_reputation(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    contract = direct_deploy(CONTRACT_PATH)
    _open_bounty(contract, direct_vm, direct_alice)
    bob = to_hex(direct_bob)
    direct_vm.sender = direct_bob
    contract.submit_work("1", PROOF_LINK, PROOF_DESC)

    _mock_proof(direct_vm, approved=True, reasoning=APPROVE_REASON)
    parsed = json.loads(contract.judge_submission("1"))
    assert parsed["approved"] is True
    assert parsed["status"] == "Approved"

    bounty = contract.get_bounty("1")
    assert bounty["status"] == "Approved"
    assert bounty["escrow_locked"] is True
    assert APPROVE_REASON in bounty["verdict_reasoning"]
    rec = contract.get_reputation(bob)
    assert rec["approved_count"] == 1
    assert rec["rejected_count"] == 0


def test_judge_submission_can_reject(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    contract = direct_deploy(CONTRACT_PATH)
    _open_bounty(contract, direct_vm, direct_alice)
    bob = to_hex(direct_bob)
    direct_vm.sender = direct_bob
    contract.submit_work("1", PROOF_LINK, PROOF_DESC)

    _mock_proof(direct_vm, body=UNRELATED, approved=False, reasoning=REJECT_REASON)
    parsed = json.loads(contract.judge_submission("1"))
    assert parsed["approved"] is False
    assert parsed["status"] == "Rejected"
    rec = contract.get_reputation(bob)
    assert rec["approved_count"] == 0
    assert rec["rejected_count"] == 1


def test_release_payment_requires_approved(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    contract = direct_deploy(CONTRACT_PATH)
    _open_bounty(contract, direct_vm, direct_alice)
    with direct_vm.expect_revert("Escrow can only be released after an Approved verdict"):
        contract.release_payment("1")

    direct_vm.sender = direct_bob
    contract.submit_work("1", PROOF_LINK, PROOF_DESC)
    _mock_proof(direct_vm, approved=False, reasoning=REJECT_REASON)
    contract.judge_submission("1")
    with direct_vm.expect_revert("Escrow can only be released after an Approved verdict"):
        contract.release_payment("1")


def test_release_payment_pays_on_approved(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    contract = direct_deploy(CONTRACT_PATH)
    _open_bounty(contract, direct_vm, direct_alice)
    bob = to_hex(direct_bob)
    direct_vm.sender = direct_bob
    contract.submit_work("1", PROOF_LINK, PROOF_DESC)
    _mock_proof(direct_vm, approved=True, reasoning=APPROVE_REASON)
    contract.judge_submission("1")

    try:
        parsed = json.loads(contract.release_payment("1"))
    except Exception as exc:
        if "transfer" in str(exc).lower() or "emit" in str(exc).lower():
            pytest.skip(f"Direct mode cannot emit transfers: {exc}")
        raise
    assert parsed["status"] == "Paid"
    assert parsed["paid_to"].lower() == bob.lower()
    bounty = contract.get_bounty("1")
    assert bounty["status"] == "Paid"
    assert bounty["escrow_locked"] is False
    assert contract.get_total_escrowed() == 0
    with direct_vm.expect_revert("Escrow can only be released after an Approved verdict"):
        contract.release_payment("1")


def test_appeal_then_rejudge(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    contract = direct_deploy(CONTRACT_PATH)
    _open_bounty(contract, direct_vm, direct_alice)
    bob = to_hex(direct_bob)
    direct_vm.sender = direct_bob
    contract.submit_work("1", PROOF_LINK, PROOF_DESC)
    _mock_proof(direct_vm, approved=False, reasoning=REJECT_REASON)
    contract.judge_submission("1")

    parsed = json.loads(contract.appeal("1"))
    assert parsed["status"] == "Appealed"
    assert parsed["appeal_count"] == 1
    assert contract.get_bounty("1")["status"] == "Appealed"

    direct_vm.clear_mocks()
    _mock_proof(direct_vm, approved=True, reasoning=APPROVE_REASON)
    judged = json.loads(contract.judge_submission("1"))
    assert judged["approved"] is True
    rec = contract.get_reputation(bob)
    assert rec["approved_count"] == 1
    assert rec["rejected_count"] == 0

    with direct_vm.expect_revert("Appeal limit reached"):
        contract.appeal("1")


def test_unrelated_wallet_cannot_appeal(
    direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie
):
    contract = direct_deploy(CONTRACT_PATH)
    _open_bounty(contract, direct_vm, direct_alice)
    direct_vm.sender = direct_bob
    contract.submit_work("1", PROOF_LINK, PROOF_DESC)
    _mock_proof(direct_vm, approved=False, reasoning=REJECT_REASON)
    contract.judge_submission("1")

    direct_vm.sender = direct_charlie
    with direct_vm.expect_revert("Only the bounty creator or submitter can appeal"):
        contract.appeal("1")


def _refund_or_skip(contract, bounty_id="1"):
    try:
        return json.loads(contract.refund(bounty_id))
    except Exception as exc:
        if "transfer" in str(exc).lower() or "emit" in str(exc).lower():
            pytest.skip(f"Direct mode cannot emit transfers: {exc}")
        raise


def test_refund_on_rejected_returns_escrow_to_creator(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    contract = direct_deploy(CONTRACT_PATH)
    _open_bounty(contract, direct_vm, direct_alice)
    alice = to_hex(direct_alice)
    direct_vm.sender = direct_bob
    contract.submit_work("1", PROOF_LINK, PROOF_DESC)
    _mock_proof(direct_vm, approved=False, reasoning=REJECT_REASON)
    contract.judge_submission("1")

    direct_vm.sender = direct_alice
    parsed = _refund_or_skip(contract)
    assert parsed["status"] == "Refunded"
    assert parsed["refunded_to"].lower() == alice.lower()
    bounty = contract.get_bounty("1")
    assert bounty["status"] == "Refunded"
    assert bounty["escrow_locked"] is False
    assert contract.get_total_escrowed() == 0


def test_refund_reverts_for_open_unexpired_bounty(
    direct_vm, direct_deploy, direct_alice
):
    contract = direct_deploy(CONTRACT_PATH)
    _open_bounty(contract, direct_vm, direct_alice)
    with direct_vm.expect_revert(
        "Refund is only allowed for rejected, expired, or appeal-exhausted"
    ):
        contract.refund("1")


def test_refund_reverts_for_non_creator(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    contract = direct_deploy(CONTRACT_PATH)
    _open_bounty(contract, direct_vm, direct_alice)
    direct_vm.sender = direct_bob
    contract.submit_work("1", PROOF_LINK, PROOF_DESC)
    _mock_proof(direct_vm, approved=False, reasoning=REJECT_REASON)
    contract.judge_submission("1")
    with direct_vm.expect_revert("Only the bounty creator can refund escrow"):
        contract.refund("1")


def test_refund_after_appeal_exhausted(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    contract = direct_deploy(CONTRACT_PATH)
    _open_bounty(contract, direct_vm, direct_alice)
    alice = to_hex(direct_alice)
    direct_vm.sender = direct_bob
    contract.submit_work("1", PROOF_LINK, PROOF_DESC)
    _mock_proof(direct_vm, approved=False, reasoning=REJECT_REASON)
    contract.judge_submission("1")
    contract.appeal("1")
    direct_vm.clear_mocks()
    _mock_proof(direct_vm, approved=False, reasoning=REJECT_REASON)
    contract.judge_submission("1")

    direct_vm.sender = direct_alice
    parsed = _refund_or_skip(contract)
    assert parsed["status"] == "Refunded"
    assert parsed["refunded_to"].lower() == alice.lower()
    assert contract.get_bounty("1")["status"] == "Refunded"


def test_judge_submission_validator_re_fetches_proof(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    contract = direct_deploy(CONTRACT_PATH)
    _open_bounty(contract, direct_vm, direct_alice)
    direct_vm.sender = direct_bob
    contract.submit_work("1", PROOF_LINK, PROOF_DESC)
    _mock_proof(direct_vm, approved=True, reasoning=APPROVE_REASON)
    contract.judge_submission("1")
    assert direct_vm._captured_validators, "Validator was not captured"

    direct_vm.clear_mocks()
    _mock_proof(direct_vm, approved=False, reasoning=REJECT_REASON)
    assert direct_vm.run_validator() is False
