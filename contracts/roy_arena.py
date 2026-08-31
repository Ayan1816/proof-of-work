# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
"""Roy Judge Arena — on-chain AI judging for Startup, Meme, and Poem submissions.

Validators do not rubber-stamp the leader. Each validator independently reads
the submission, re-runs the same judgment, and accepts the leaderboard score
only when the independent evaluation agrees on substance.
"""
from dataclasses import dataclass
from genlayer import *
import genlayer.gl.vm as glvm
import json


ALLOWED_CATEGORIES = ("Startup", "Meme", "Poem")
MIN_CONTENT_LEN = 20
MIN_FEEDBACK_LEN = 8
SCORE_TOLERANCE = 3
PLACEHOLDER_FEEDBACK = {
    "no feedback",
    "n/a",
    "none",
    "ok",
    "good",
    "nice",
    "fine",
    "average",
}

CATEGORY_CRITERIA = {
    "Startup": (
        "innovation, practicality, clarity of the problem and solution, "
        "and whether the idea could actually create value"
    ),
    "Meme": (
        "humor, originality, relatability, timing, and whether it actually "
        "works as a meme rather than a generic joke"
    ),
    "Poem": (
        "creativity, imagery, rhythm, language, and emotional or intellectual impact"
    ),
}


@allow_storage
@dataclass
class Submission:
    user: str
    category: str
    content: str
    score: u256
    feedback: str


def _as_bool(value):
    if isinstance(value, bool):
        return value
    if isinstance(value, int) and value in (0, 1):
        return bool(value)
    if isinstance(value, str):
        lowered = value.strip().lower()
        if lowered in ("true", "1", "yes"):
            return True
        if lowered in ("false", "0", "no"):
            return False
    return None


def _first_integer(text: str):
    digits = ""
    for ch in str(text):
        if ch.isdigit():
            digits += ch
        elif digits:
            break
    if not digits:
        return None
    return int(digits)


def _as_score(value):
    """Accept int/float/'8'/'8.0'/'8/10'. Reject bools and out-of-range values."""
    if isinstance(value, bool):
        return None
    score = None
    if isinstance(value, int):
        score = value
    elif isinstance(value, float):
        if value != value:  # NaN
            return None
        score = int(round(value))
    else:
        text = str(value).strip()
        if "/" in text:
            text = text.split("/", 1)[0].strip()
        try:
            score = int(round(float(text)))
        except (TypeError, ValueError):
            score = _first_integer(text)
            if score is None:
                return None
    if score < 1 or score > 10:
        return None
    return score


def _feedback_is_substantive(feedback: str) -> bool:
    cleaned = feedback.strip()
    if len(cleaned) < MIN_FEEDBACK_LEN:
        return False
    return cleaned.lower() not in PLACEHOLDER_FEEDBACK


def _try_parse_verdict(raw, *, require_substantive_feedback: bool = True):
    """Parse an AI verdict. Returns None when the result is not a real judgment."""
    if isinstance(raw, str):
        text = raw.strip().replace("```json", "").replace("```", "").strip()
        start, end = text.find("{"), text.rfind("}") + 1
        if start < 0 or end <= start:
            return None
        try:
            raw = json.loads(text[start:end])
        except json.JSONDecodeError:
            return None
    if not isinstance(raw, dict):
        return None

    score = _as_score(raw.get("score", raw.get("score_out_of_10")))
    if score is None:
        return None

    is_valid = _as_bool(raw.get("is_valid", True))
    if is_valid is None:
        return None

    feedback = str(raw.get("feedback", "")).strip()
    if require_substantive_feedback:
        if not _feedback_is_substantive(feedback):
            return None
    elif not feedback:
        return None

    return {
        "is_valid": bool(is_valid),
        "score": int(score),
        "feedback": feedback,
    }


def _build_judge_prompt(category: str, content: str) -> str:
    criteria = CATEGORY_CRITERIA[category]
    return (
        "You are an independent expert judge for Roy Judge Arena.\n"
        "Read the submission carefully and evaluate its substance, not its length "
        "or formatting.\n\n"
        f"Category: {category}\n"
        f"Judging criteria: {criteria}\n\n"
        "Submission:\n"
        f'"""{content}"""\n\n'
        f"If the text is spam, gibberish, off-topic for {category}, or too "
        "low-effort to judge, set is_valid to false and score 1.\n"
        "Otherwise set is_valid to true and score it from 1 (very poor) to 10 "
        "(outstanding) using only the criteria above.\n"
        "score MUST be a whole integer from 1 to 10, never a float or a fraction.\n"
        "Feedback must mention a specific strength or weakness of THIS "
        "submission, never generic praise.\n\n"
        "Reply with JSON only:\n"
        '{"is_valid": true, "score": <integer 1-10>, "feedback": "<one specific sentence>"}'
    )


def _same_judgment(leader: dict, independent: dict) -> bool:
    """Accept the leader only when an independent evaluation agrees on substance."""
    if bool(leader["is_valid"]) != bool(independent["is_valid"]):
        return False
    if abs(int(leader["score"]) - int(independent["score"])) > SCORE_TOLERANCE:
        return False
    if not _feedback_is_substantive(leader["feedback"]):
        return False
    # Independent wording can be shorter, but placeholder rubber-stamps are not a judgment.
    if independent["feedback"].strip().lower() in PLACEHOLDER_FEEDBACK:
        return False
    return True


def _sender_hex() -> str:
    sender = gl.message.sender_address
    if hasattr(sender, "as_hex"):
        return sender.as_hex
    return str(sender)


def _submission_to_dict(sub: Submission) -> dict:
    return {
        "user": sub.user,
        "category": sub.category,
        "content": sub.content,
        "score": int(sub.score),
        "feedback": sub.feedback,
    }


class RoyJudgeArena(gl.Contract):
    total: u256
    subs: TreeMap[str, Submission]

    def __init__(self):
        self.total = u256(0)
        self.subs = TreeMap()

    def _append_submission(self, user: str, cat: str, content: str, score: int, feedback: str) -> str:
        self.total = u256(int(self.total) + 1)
        sub_id = str(int(self.total))
        self.subs[sub_id] = Submission(
            user=user,
            category=cat,
            content=content,
            score=u256(score),
            feedback=feedback,
        )
        return sub_id

    @gl.public.write
    def submit_and_judge(self, user_addr: str, cat: str, content: str) -> str:
        if cat not in ALLOWED_CATEGORIES:
            raise Exception("Invalid category! Must be 'Startup', 'Meme', or 'Poem'.")
        if len(content.strip()) < MIN_CONTENT_LEN:
            raise Exception("Content too short. Please provide more details.")

        def leader_fn() -> dict:
            raw = gl.nondet.exec_prompt(
                _build_judge_prompt(cat, content),
                response_format="json",
            )
            parsed = _try_parse_verdict(raw)
            if parsed is None:
                raise Exception("Failed to parse AI verdict. Please try again.")
            return parsed

        def validator_fn(leader_result) -> bool:
            # Independently read and judge the same submission. A score in 1-10
            # with non-empty feedback is not enough: the validator must reach
            # a comparable quality assessment of this specific content.
            if not isinstance(leader_result, glvm.Return):
                return False
            leader = _try_parse_verdict(leader_result.calldata)
            if leader is None:
                return False
            try:
                raw = gl.nondet.exec_prompt(
                    _build_judge_prompt(cat, content),
                    response_format="json",
                )
                # Independent wording varies; score + validity are the consensus
                # signal. Do not drop a matching score just because feedback is
                # shorter than the leader's sentence.
                independent = _try_parse_verdict(
                    raw, require_substantive_feedback=False
                )
            except Exception:
                return False
            if independent is None:
                return False
            return _same_judgment(leader, independent)

        verdict = glvm.run_nondet_unsafe.lazy(leader_fn, validator_fn).get()
        parsed = _try_parse_verdict(verdict)
        if parsed is None:
            raise Exception("Failed to parse AI verdict. Please try again.")
        if not parsed["is_valid"]:
            raise Exception("Submission rejected by AI: Deemed as spam or irrelevant.")

        user = _sender_hex() or user_addr
        sub_id = self._append_submission(
            user, cat, content, parsed["score"], parsed["feedback"]
        )
        return json.dumps(
            {
                "status": "Success",
                "id": sub_id,
                "score": parsed["score"],
                "feedback": parsed["feedback"],
            },
            sort_keys=True,
        )

    @gl.public.view
    def get_submission(self, sub_id: str) -> dict:
        sub = self.subs.get(str(sub_id))
        if sub is None:
            raise Exception("Submission not found.")
        return _submission_to_dict(sub)

    @gl.public.view
    def get_player_points(self, player_address: str) -> int:
        target = player_address.lower()
        total = 0
        for sub in self.subs.values():
            if sub.user.lower() == target:
                total += int(sub.score)
        return total

    @gl.public.view
    def get_submission_count(self) -> int:
        return int(self.total)

    @gl.public.view
    def get_leaderboard(self) -> dict:
        out = {}
        for key, sub in self.subs.items():
            item = _submission_to_dict(sub)
            item["id"] = str(key)
            out[str(key)] = item
        return out
