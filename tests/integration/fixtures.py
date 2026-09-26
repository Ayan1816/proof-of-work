"""Expected contract state fixtures for Proof of Work integration tests."""

proof_of_work_contract_schema = {
    "id": 1,
    "jsonrpc": "2.0",
    "result": {
        "ctor": {"kwparams": {}, "params": []},
        "methods": {
            "judge_work": {
                "kwparams": {},
                "params": [
                    ["spec", "string"],
                    ["content", "string"],
                ],
                "readonly": False,
                "ret": "string",
            },
            "get_name": {
                "kwparams": {},
                "params": [],
                "readonly": True,
                "ret": "string",
            },
            "create_bounty": {
                "kwparams": {},
                "params": [
                    ["title", "string"],
                    ["spec", "string"],
                    ["reward", "int"],
                    ["deadline", "int"],
                ],
                "readonly": False,
                "ret": "string",
            },
            "get_bounty": {
                "kwparams": {},
                "params": [["bounty_id", "string"]],
                "readonly": True,
                "ret": "dict",
            },
            "list_bounties": {
                "kwparams": {},
                "params": [],
                "readonly": True,
                "ret": "array",
            },
            "get_reputation": {
                "kwparams": {},
                "params": [["contributor", "string"]],
                "readonly": True,
                "ret": "dict",
            },
            "get_bounty_count": {
                "kwparams": {},
                "params": [],
                "readonly": True,
                "ret": "int",
            },
            "get_submission_count": {
                "kwparams": {},
                "params": [],
                "readonly": True,
                "ret": "int",
            },
            "get_total_escrowed": {
                "kwparams": {},
                "params": [],
                "readonly": True,
                "ret": "int",
            },
            "get_contract_balance": {
                "kwparams": {},
                "params": [],
                "readonly": True,
                "ret": "int",
            },
            "get_account_balance": {
                "kwparams": {},
                "params": [["account", "string"]],
                "readonly": True,
                "ret": "int",
            },
            "submit_work": {
                "kwparams": {},
                "params": [
                    ["bounty_id", "string"],
                    ["proof_link", "string"],
                    ["description", "string"],
                ],
                "readonly": False,
                "ret": "string",
            },
            "judge_submission": {
                "kwparams": {},
                "params": [["bounty_id", "string"]],
                "readonly": False,
                "ret": "string",
            },
            "release_payment": {
                "kwparams": {},
                "params": [["bounty_id", "string"]],
                "readonly": False,
                "ret": "string",
            },
            "appeal": {
                "kwparams": {},
                "params": [["bounty_id", "string"]],
                "readonly": False,
                "ret": "string",
            },
            "refund": {
                "kwparams": {},
                "params": [["bounty_id", "string"]],
                "readonly": False,
                "ret": "string",
            },
            "get_submission": {
                "kwparams": {},
                "params": [["submission_id", "string"]],
                "readonly": True,
                "ret": "dict",
            },
        },
    },
}

SAMPLE_SPEC = (
    "Write a README that explains how to install dependencies and run the "
    "project's tests locally."
)
SAMPLE_WORK = (
    "README: pip install -r requirements.txt, then pytest tests/direct/ -v. "
    "Includes a local-dev section and troubleshooting notes."
)
SAMPLE_UNRELATED = (
    "This is a poem about the moon and has nothing to do with the requested "
    "README or local test instructions."
)
LIVE_PROOF_URL = "https://example.com/"
LIVE_SPEC = (
    "The submitted page must identify itself as Example Domain and state that "
    "this domain is for use in illustrative examples in documents."
)
LIVE_DESCRIPTION = (
    "Public example.com homepage used as published proof of the domain page."
)
