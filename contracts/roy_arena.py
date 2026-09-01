# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
"""Roy Judge Arena — taste now, reality later.

Validators do not rubber-stamp the leader. Each validator independently reads
the submission (and, at resolve time, re-fetches the evidence URL), re-runs the
same judgment, and accepts the result only when the independent evaluation
agrees on substance.
"""
from dataclasses import dataclass
from genlayer import *
import genlayer.gl.vm as glvm
import json


ALLOWED_CATEGORIES = ("Startup", "Meme", "Poem")
MIN_CONTENT_LEN = 20
MIN_CLAIM_LEN = 20
MAX_CLAIM_LEN = 400
MAX_URL_LEN = 512
MAX_EVIDENCE_CHARS = 8000
MIN_FEEDBACK_LEN = 8
SCORE_TOLERANCE = 3
UNRESOLVED = "unresolved"
REALITY_TRUE = "true"
REALITY_FALSE = "false"
REALITY_TOO_EARLY = "too_early"
FINAL_REALITY = (REALITY_TRUE, REALITY_FALSE)
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
    claim: str
    deadline: str
    evidence_url: str
    resolved: bool
    reality_outcome: str
    reality_note: str


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


def _parse_json_object(raw):
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str):
        text = raw.strip().replace("```json", "").replace("```", "").strip()
        start, end = text.find("{"), text.rfind("}") + 1
        if start < 0 or end <= start:
            return None
        try:
            parsed = json.loads(text[start:end])
        except json.JSONDecodeError:
            return None
        if isinstance(parsed, dict):
            return parsed
    return None


def _try_parse_verdict(raw, *, require_substantive_feedback: bool = True):
    """Parse an AI verdict. Returns None when the result is not a real judgment."""
    raw = _parse_json_object(raw)
    if raw is None:
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


def _normalize_reality_outcome(value) -> str:
    text = str(value or "").strip().lower()
    if text in (REALITY_TRUE, "yes", "confirmed", "hit"):
        return REALITY_TRUE
    if text in (REALITY_FALSE, "no", "denied", "miss"):
        return REALITY_FALSE
    if text in (REALITY_TOO_EARLY, "pending", "not_yet", "inconclusive"):
        return REALITY_TOO_EARLY
    return ""


def _try_parse_reality(raw, *, require_substantive_note: bool = True):
    """Parse a reality verdict. Returns None when the result is not a real judgment."""
    raw = _parse_json_object(raw)
    if raw is None:
        return None
    outcome = _normalize_reality_outcome(raw.get("outcome", raw.get("result")))
    if outcome not in (REALITY_TRUE, REALITY_FALSE, REALITY_TOO_EARLY):
        return None
    note = str(raw.get("evidence_note", raw.get("note", raw.get("feedback", "")))).strip()
    if require_substantive_note:
        if not _feedback_is_substantive(note):
            return None
    elif not note:
        return None
    return {"outcome": outcome, "evidence_note": note}


def _parse_iso_date(text: str):
    value = str(text or "").strip()
    if len(value) != 10 or value[4] != "-" or value[7] != "-":
        return None
    try:
        year = int(value[0:4])
        month = int(value[5:7])
        day = int(value[8:10])
    except ValueError:
        return None
    if year < 2020 or year > 2100 or month < 1 or month > 12 or day < 1 or day > 31:
        return None
    leap = year % 4 == 0 and (year % 100 != 0 or year % 400 == 0)
    month_days = (31, 29 if leap else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31)
    if day > month_days[month - 1]:
        return None
    return value


def _is_http_url(url: str) -> bool:
    text = str(url or "").strip()
    if len(text) < 11 or len(text) > MAX_URL_LEN:
        return False
    lowered = text.lower()
    if not (lowered.startswith("https://") or lowered.startswith("http://")):
        return False
    if " " in text or "\n" in text or "\t" in text:
        return False
    rest = text.split("://", 1)[1]
    host = rest.split("/")[0].split("?")[0].split("#")[0]
    if not host or "." not in host:
        return False
    return True


def _tx_date_str() -> str:
    getter = getattr(glvm, "get_timestamp", None)
    if getter is None:
        getter = getattr(getattr(gl, "vm", None), "get_timestamp", None)
    if callable(getter):
        try:
            ts = getter()
            if hasattr(ts, "date"):
                parsed = _parse_iso_date(ts.date().isoformat())
                if parsed:
                    return parsed
            text = str(ts)
            parsed = _parse_iso_date(text[:10])
            if parsed:
                return parsed
        except Exception:
            pass
    raw_msg = getattr(gl.message, "raw", None)
    raw_dt = None
    if isinstance(raw_msg, dict):
        raw_dt = raw_msg.get("datetime")
    elif raw_msg is not None:
        raw_dt = getattr(raw_msg, "get", lambda *_: None)("datetime")
        if raw_dt is None:
            raw_dt = getattr(raw_msg, "datetime", None)
    for source in (getattr(gl.message, "datetime", None), raw_dt):
        if source is None:
            continue
        text = str(source)
        parsed = _parse_iso_date(text[:10])
        if parsed:
            return parsed
    raise Exception("Could not read transaction time.")


def _build_judge_prompt(
    category: str, content: str, claim: str, deadline: str, evidence_url: str
) -> str:
    criteria = CATEGORY_CRITERIA[category]
    return (
        "You are an independent expert judge for Roy Judge Arena.\n"
        "Read the submission carefully and evaluate its substance, not its length "
        "or formatting.\n\n"
        f"Category: {category}\n"
        f"Judging criteria: {criteria}\n"
        f"Projection claim: {claim}\n"
        f"Deadline: {deadline}\n"
        f"Evidence URL: {evidence_url}\n\n"
        "Submission:\n"
        f'"""{content}"""\n\n'
        f"If the text is spam, gibberish, off-topic for {category}, or too "
        "low-effort to judge, set is_valid to false and score 1.\n"
        "If the projection claim is not a falsifiable statement about the world, "
        "set is_valid to false and score 1.\n"
        "Otherwise set is_valid to true and score it from 1 (very poor) to 10 "
        "(outstanding) using only the criteria above.\n"
        "score MUST be a whole integer from 1 to 10, never a float or a fraction.\n"
        "Feedback must mention a specific strength or weakness of THIS "
        "submission, never generic praise.\n\n"
        "Reply with JSON only:\n"
        '{"is_valid": true, "score": <integer 1-10>, "feedback": "<one specific sentence>"}'
    )


def _build_reality_prompt(
    category: str,
    content: str,
    claim: str,
    deadline: str,
    evidence_url: str,
    status: int,
    page_text: str,
) -> str:
    excerpt = content if len(content) <= 500 else content[:500]
    page = page_text if len(page_text) <= MAX_EVIDENCE_CHARS else page_text[:MAX_EVIDENCE_CHARS]
    return (
        "You are an independent adjudicator for Roy Judge Arena.\n"
        "Decide whether live public evidence confirms this projection.\n"
        "Do not reuse the leader's wording. Read the page yourself.\n\n"
        f"Category: {category}\n"
        f"Original idea:\n\"\"\"{excerpt}\"\"\"\n"
        f"Projection claim: {claim}\n"
        f"Deadline: {deadline}\n"
        f"Evidence URL: {evidence_url}\n"
        f"HTTP status: {status}\n"
        "Page text:\n"
        f'"""{page}"""\n\n'
        "Set outcome to \"true\" if the page clearly confirms the claim.\n"
        "Set outcome to \"false\" if the page clearly contradicts the claim "
        "or the claim is not supported.\n"
        "Set outcome to \"too_early\" if the page exists but the event has not "
        "happened yet, or the evidence is inconclusive.\n"
        "evidence_note must cite a specific detail from THIS page.\n\n"
        "Reply with JSON only:\n"
        '{"outcome": "true"|"false"|"too_early", "evidence_note": "<one specific sentence>"}'
    )


def _decode_body(body) -> str:
    if body is None:
        return ""
    if isinstance(body, bytes):
        return body.decode("utf-8", errors="replace")
    return str(body)


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


def _same_reality(leader: dict, independent: dict) -> bool:
    """Accept the leader only when an independent re-fetch agrees on the outcome."""
    if leader["outcome"] != independent["outcome"]:
        return False
    if not _feedback_is_substantive(leader["evidence_note"]):
        return False
    if independent["evidence_note"].strip().lower() in PLACEHOLDER_FEEDBACK:
        return False
    return True


def _sender_hex() -> str:
    sender = gl.message.sender_address
    if hasattr(sender, "as_hex"):
        return sender.as_hex
    return str(sender)


def _norm_addr(addr: str) -> str:
    return str(addr or "").strip().lower()


def _submission_to_dict(sub: Submission) -> dict:
    return {
        "user": sub.user,
        "category": sub.category,
        "content": sub.content,
        "score": int(sub.score),
        "feedback": sub.feedback,
        "claim": sub.claim,
        "deadline": sub.deadline,
        "evidence_url": sub.evidence_url,
        "resolved": bool(sub.resolved),
        "reality_outcome": sub.reality_outcome,
        "reality_note": sub.reality_note,
    }


class RoyJudgeArena(gl.Contract):
    total: u256
    # Append-only list so a second meme/poem from the same wallet is stored
    # as a new row instead of replacing the previous one.
    subs: DynArray[Submission]
    player_points: TreeMap[str, u256]

    def __init__(self):
        self.total = u256(0)
        self.player_points = TreeMap()

    def _item(self, sub: Submission, sub_id: str) -> dict:
        item = _submission_to_dict(sub)
        item["id"] = str(sub_id)
        return item

    def _add_points(self, user: str, score: int) -> None:
        key = _norm_addr(user)
        if not key:
            return
        existing = self.player_points.get(key)
        current = int(existing) if existing is not None else 0
        self.player_points[key] = u256(current + int(score))

    def _append_submission(
        self,
        user: str,
        cat: str,
        content: str,
        score: int,
        feedback: str,
        claim: str,
        deadline: str,
        evidence_url: str,
    ) -> str:
        self.subs.append(
            Submission(
                user=user,
                category=cat,
                content=content,
                score=u256(score),
                feedback=feedback,
                claim=claim,
                deadline=deadline,
                evidence_url=evidence_url,
                resolved=False,
                reality_outcome=UNRESOLVED,
                reality_note="",
            )
        )
        sub_id = str(len(self.subs))
        self.total = u256(len(self.subs))
        self._add_points(user, score)
        return sub_id

    @gl.public.write
    def submit_and_judge(
        self,
        user_addr: str,
        cat: str,
        content: str,
        claim: str,
        deadline: str,
        evidence_url: str,
    ) -> str:
        if cat not in ALLOWED_CATEGORIES:
            raise Exception("Invalid category! Must be 'Startup', 'Meme', or 'Poem'.")
        content = content.strip()
        claim = claim.strip()
        deadline = deadline.strip()
        evidence_url = evidence_url.strip()
        if len(content) < MIN_CONTENT_LEN:
            raise Exception("Content too short. Please provide more details.")
        if len(claim) < MIN_CLAIM_LEN:
            raise Exception("Claim too short. Write a falsifiable projection.")
        if len(claim) > MAX_CLAIM_LEN:
            raise Exception("Claim too long.")
        parsed_deadline = _parse_iso_date(deadline)
        if parsed_deadline is None:
            raise Exception("Deadline must be a date in YYYY-MM-DD format.")
        deadline = parsed_deadline
        if not _is_http_url(evidence_url):
            raise Exception("Evidence URL must be a public http(s) page.")

        def leader_fn() -> dict:
            raw = gl.nondet.exec_prompt(
                _build_judge_prompt(cat, content, claim, deadline, evidence_url),
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
                    _build_judge_prompt(cat, content, claim, deadline, evidence_url),
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
            user,
            cat,
            content,
            parsed["score"],
            parsed["feedback"],
            claim,
            deadline,
            evidence_url,
        )
        return json.dumps(
            {
                "status": "Success",
                "id": sub_id,
                "score": parsed["score"],
                "feedback": parsed["feedback"],
                "claim": claim,
                "deadline": deadline,
                "evidence_url": evidence_url,
                "reality_outcome": UNRESOLVED,
            },
            sort_keys=True,
        )

    def _parse_sub_index(self, sub_id: str) -> int:
        text = str(sub_id).strip()
        if text.startswith("id_"):
            text = text[3:]
        try:
            idx = int(text)
        except (TypeError, ValueError):
            raise Exception("Submission not found.")
        if idx < 1 or idx > len(self.subs):
            raise Exception("Submission not found.")
        return idx - 1

    @gl.public.write
    def resolve_projection(self, sub_id: str) -> str:
        idx = self._parse_sub_index(sub_id)
        stored = self.subs[idx]
        if bool(stored.resolved) or stored.reality_outcome in FINAL_REALITY:
            raise Exception("Projection is already resolved.")
        claim = str(stored.claim)
        deadline = str(stored.deadline)
        evidence_url = str(stored.evidence_url)
        category = str(stored.category)
        content = str(stored.content)
        if _tx_date_str() < deadline:
            raise Exception("Projection is not due yet.")

        def leader_fn() -> dict:
            resp = gl.nondet.web.get(evidence_url)
            status = int(getattr(resp, "status", 0) or 0)
            text = _decode_body(getattr(resp, "body", None))
            image = None
            try:
                image = gl.nondet.web.render(evidence_url, mode="screenshot")
            except Exception:
                image = None
            if status < 200 or status >= 400:
                raise Exception("Could not read evidence URL.")
            if not text.strip() and image is None:
                raise Exception("Evidence page was empty.")
            prompt = _build_reality_prompt(
                category, content, claim, deadline, evidence_url, status, text
            )
            if image is not None:
                try:
                    raw = gl.nondet.exec_prompt(
                        prompt, response_format="json", image=image
                    )
                except Exception:
                    raw = gl.nondet.exec_prompt(prompt, response_format="json")
            else:
                raw = gl.nondet.exec_prompt(prompt, response_format="json")
            parsed = _try_parse_reality(raw)
            if parsed is None:
                raise Exception("Failed to parse reality verdict. Please try again.")
            return parsed

        def validator_fn(leader_result) -> bool:
            # Independently re-fetch the same URL and re-score the claim.
            # A well-formed outcome string is not enough: the validator must
            # look at the live page.
            if not isinstance(leader_result, glvm.Return):
                return False
            leader = _try_parse_reality(leader_result.calldata)
            if leader is None:
                return False
            try:
                resp = gl.nondet.web.get(evidence_url)
                status = int(getattr(resp, "status", 0) or 0)
                text = _decode_body(getattr(resp, "body", None))
                image = None
                try:
                    image = gl.nondet.web.render(evidence_url, mode="screenshot")
                except Exception:
                    image = None
                if status < 200 or status >= 400:
                    return False
                prompt = _build_reality_prompt(
                    category, content, claim, deadline, evidence_url, status, text
                )
                if image is not None:
                    try:
                        raw = gl.nondet.exec_prompt(
                            prompt, response_format="json", image=image
                        )
                    except Exception:
                        raw = gl.nondet.exec_prompt(prompt, response_format="json")
                else:
                    raw = gl.nondet.exec_prompt(prompt, response_format="json")
                independent = _try_parse_reality(
                    raw, require_substantive_note=False
                )
            except Exception:
                return False
            if independent is None:
                return False
            return _same_reality(leader, independent)

        verdict = glvm.run_nondet_unsafe.lazy(leader_fn, validator_fn).get()
        parsed = _try_parse_reality(verdict)
        if parsed is None:
            raise Exception("Failed to parse reality verdict. Please try again.")

        is_final = parsed["outcome"] in FINAL_REALITY
        item = self.subs[idx]
        item.reality_outcome = parsed["outcome"]
        item.reality_note = parsed["evidence_note"]
        item.resolved = is_final

        return json.dumps(
            {
                "status": "Success",
                "id": str(idx + 1),
                "outcome": parsed["outcome"],
                "evidence_note": parsed["evidence_note"],
                "resolved": is_final,
            },
            sort_keys=True,
        )

    @gl.public.view
    def get_submission(self, sub_id: str) -> dict:
        idx = self._parse_sub_index(sub_id)
        return self._item(self.subs[idx], str(idx + 1))

    @gl.public.view
    def get_player_points(self, player_address: str) -> int:
        target = _norm_addr(player_address)
        stored = self.player_points.get(target)
        if stored is not None:
            return int(stored)
        total = 0
        for sub in self.subs:
            if _norm_addr(sub.user) == target:
                total += int(sub.score)
        return total

    @gl.public.view
    def get_submission_count(self) -> int:
        return len(self.subs)

    @gl.public.view
    def get_submissions(self) -> list:
        """Return every judged entry, including multiple from the same wallet."""
        out = []
        idx = 1
        for sub in self.subs:
            out.append(self._item(sub, str(idx)))
            idx += 1
        return out

    @gl.public.view
    def get_points_board(self) -> dict:
        out = {}
        for addr, pts in self.player_points.items():
            out[str(addr)] = int(pts)
        if out:
            return out
        # Fallback for empty map: derive from the append-only list.
        for sub in self.subs:
            key = _norm_addr(sub.user)
            if not key:
                continue
            out[key] = int(out.get(key, 0)) + int(sub.score)
        return out

    @gl.public.view
    def get_leaderboard(self) -> dict:
        out = {}
        idx = 1
        for sub in self.subs:
            sid = str(idx)
            out[sid] = self._item(sub, sid)
            idx += 1
        return out
