# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from dataclasses import dataclass
from genlayer import *
import genlayer.gl.vm as glvm
import json


@allow_storage
@dataclass
class Submission:
    user: str
    category: str
    content: str
    score: u256
    feedback: str


def _parse_verdict(raw) -> dict:
    if isinstance(raw, str):
        text = raw.strip().replace("```json", "").replace("```", "").strip()
        start, end = text.find("{"), text.rfind("}") + 1
        if start >= 0 and end > start:
            text = text[start:end]
        raw = json.loads(text)
    if not isinstance(raw, dict):
        raise Exception("Invalid verdict")

    score_raw = raw.get("score", raw.get("score_out_of_10", 5))
    try:
        score = int(round(float(str(score_raw).strip())))
    except (TypeError, ValueError):
        score = 5
    if score < 1:
        score = 1
    if score > 10:
        score = 10

    feedback = str(raw.get("feedback", "No feedback")).strip()
    if not feedback:
        feedback = "No feedback"
    return {"score": score, "feedback": feedback}


class RoyJudgeArena(gl.Contract):
    total: u256
    subs: TreeMap[str, Submission]

    def __init__(self):
        self.total = u256(0)
        self.subs = TreeMap()

    @gl.public.write
    def submit_and_judge(self, user_addr: str, cat: str, content: str) -> str:
        if cat not in ["Startup", "Meme", "Poem"]:
            raise Exception("Invalid category! Must be 'Startup', 'Meme', or 'Poem'.")
        if len(content.strip()) < 20:
            raise Exception("Content too short. Please provide more details.")

        def leader_fn() -> dict:
            prompt = (
                "You are an expert AI judge scoring a "
                + cat
                + " submission.\n"
                "Submission:\n"
                + content
                + '\nReply with JSON only: {"score": <integer 1-10>, "feedback": "<one sentence>"}\n'
                "score must be an integer from 1 to 10."
            )
            res = gl.nondet.exec_prompt(prompt, response_format="json")
            return _parse_verdict(res)

        def validator_fn(leader_result) -> bool:
            # LLM wording and scores are non-deterministic. Require a valid
            # structure instead of exact equality, otherwise consensus fails
            # and the submission is rolled back.
            if not isinstance(leader_result, glvm.Return):
                return False
            data = leader_result.calldata
            if not isinstance(data, dict):
                return False
            score = data.get("score")
            feedback = data.get("feedback")
            return (
                isinstance(score, int)
                and 1 <= score <= 10
                and isinstance(feedback, str)
                and len(feedback.strip()) > 0
            )

        verdict = glvm.run_nondet_unsafe(leader_fn, validator_fn)
        score = int(verdict.get("score", 5))
        feedback = str(verdict.get("feedback", "No feedback"))

        sender = gl.message.sender_address
        user = sender.as_hex if hasattr(sender, "as_hex") else str(sender)
        if not user:
            user = user_addr

        self.total = u256(int(self.total) + 1)
        sub_id = str(int(self.total))
        self.subs[sub_id] = Submission(
            user=user,
            category=cat,
            content=content,
            score=u256(score),
            feedback=feedback,
        )
        return json.dumps(
            {
                "status": "Success",
                "id": sub_id,
                "score": score,
                "feedback": feedback,
            },
            sort_keys=True,
        )

    @gl.public.view
    def get_leaderboard(self) -> dict:
        out = {}
        for key, sub in self.subs.items():
            out[str(key)] = {
                "user": sub.user,
                "category": sub.category,
                "content": sub.content,
                "score": int(sub.score),
                "feedback": sub.feedback,
            }
        return out
