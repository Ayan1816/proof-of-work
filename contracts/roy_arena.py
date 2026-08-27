# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from dataclasses import dataclass
from genlayer import *
import json


@allow_storage
@dataclass
class Submission:
    user: str
    category: str
    content: str
    score: u256
    feedback: str


class RoyJudgeArena(gl.Contract):
    total: u256
    subs: TreeMap[str, Submission]

    def __init__(self):
        self.total = u256(0)
        self.subs = TreeMap()

    @gl.public.write
    def submit_and_judge(self, user_addr: str, cat: str, content: str) -> str:
        def get_judgment() -> str:
            prompt = (
                "Evaluate "
                + cat
                + ": "
                + content
                + '. Reply strictly in JSON format: {"score": 8, "feedback": "Good"}'
            )
            res = gl.nondet.exec_prompt(prompt, response_format="json")
            return json.dumps(res, sort_keys=True)

        try:
            raw = json.loads(gl.eq_principle.strict_eq(get_judgment))
            score = int(raw.get("score", 5))
            feedback = str(raw.get("feedback", "No feedback"))
        except Exception:
            score = 5
            feedback = "No feedback"

        self.total = u256(int(self.total) + 1)
        self.subs[str(int(self.total))] = Submission(
            user=user_addr,
            category=cat,
            content=content,
            score=u256(score),
            feedback=feedback,
        )
        return "Success"

    @gl.public.view
    def get_leaderboard(self) -> str:
        out = {}
        for key, sub in self.subs.items():
            out[key] = {
                "user": sub.user,
                "category": sub.category,
                "content": sub.content,
                "score": int(sub.score),
                "feedback": sub.feedback,
            }
        return json.dumps(out, sort_keys=True)
