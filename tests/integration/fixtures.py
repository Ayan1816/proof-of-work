"""Expected contract state fixtures for Roy Judge Arena integration tests."""

roy_arena_contract_schema = {
    "id": 1,
    "jsonrpc": "2.0",
    "result": {
        "ctor": {"kwparams": {}, "params": []},
        "methods": {
            "submit_and_judge": {
                "kwparams": {},
                "params": [
                    ["user_addr", "string"],
                    ["cat", "string"],
                    ["content", "string"],
                ],
                "readonly": False,
                "ret": "string",
            },
            "get_submission": {
                "kwparams": {},
                "params": [["sub_id", "string"]],
                "readonly": True,
                "ret": "dict",
            },
            "get_player_points": {
                "kwparams": {},
                "params": [["player_address", "string"]],
                "readonly": True,
                "ret": "int",
            },
            "get_leaderboard": {
                "kwparams": {},
                "params": [],
                "readonly": True,
                "ret": "dict",
            },
            "get_submissions": {
                "kwparams": {},
                "params": [],
                "readonly": True,
                "ret": "array",
            },
            "get_points_board": {
                "kwparams": {},
                "params": [],
                "readonly": True,
                "ret": "dict",
            },
            "get_submission_count": {
                "kwparams": {},
                "params": [],
                "readonly": True,
                "ret": "int",
            },
        },
    },
}

SAMPLE_MEME = "Why did the validator cross the chain? To get to the other fork."
SAMPLE_POEM = "Silicon dreams in quiet blocks, a poem of hashes and clocks."
SAMPLE_STARTUP = (
    "We match idle GPUs with researchers who need cheap inference tonight."
)
