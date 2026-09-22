# Independently verifiable evidence — Proof of Work

Open the Python. This file only points at it. There are no transaction-hash
placeholders here. If you need a chain receipt, query Studio yourself; do
not treat any id in a write-up as proof of the logic.

Repository: https://github.com/Ayan1816/proof-of-work

Contract: [`contracts/proof_of_work.py`](https://github.com/Ayan1816/proof-of-work/blob/main/contracts/proof_of_work.py)

```bash
git clone https://github.com/Ayan1816/proof-of-work.git
cd proof-of-work
rg -n "def _semantic_equivalent|def _independent_lookup_url|def _same_judgment|gl.vm.UserError|def refund" contracts/proof_of_work.py
python3 tests/direct/test_verdict_parse.py
```

---

## 1. Semantic equivalence replaced token/Jaccard overlap

`_same_judgment` no longer counts stems or computes Jaccard. After the
Approved/Rejected bits match and both reasonings are real sentences, it
calls `gl.nondet.exec_prompt` and accepts the leader only when the model
returns `{"equivalent": true}`.

| Function | Lines | GitHub |
| --- | --- | --- |
| `_semantic_equivalence_prompt` | 174–193 | [L174–L193](https://github.com/Ayan1816/proof-of-work/blob/main/contracts/proof_of_work.py#L174-L193) |
| `_parse_semantic_equivalent` | 196–212 | [L196–L212](https://github.com/Ayan1816/proof-of-work/blob/main/contracts/proof_of_work.py#L196-L212) |
| `_semantic_equivalent` (`gl.nondet.exec_prompt`) | 217–223 | [L217–L223](https://github.com/Ayan1816/proof-of-work/blob/main/contracts/proof_of_work.py#L217-L223) |
| `_same_judgment` | 226–238 | [L226–L238](https://github.com/Ayan1816/proof-of-work/blob/main/contracts/proof_of_work.py#L226-L238) |
| Validator calls `_same_judgment` | 661 and 703 | [L661](https://github.com/Ayan1816/proof-of-work/blob/main/contracts/proof_of_work.py#L661) · [L703](https://github.com/Ayan1816/proof-of-work/blob/main/contracts/proof_of_work.py#L703) |

The prompt says "Do not count shared words. Compare meaning only."
A verdict JSON without `equivalent: true` is not agreement
(`_parse_semantic_equivalent`).

Removed from this file: `_stem_token`, `_significant_tokens`,
`_token_jaccard`, `MIN_TOKEN_JACCARD`. Confirm with:

```bash
rg -n "_token_jaccard|MIN_TOKEN_JACCARD|_stem_token" contracts/proof_of_work.py
```

That search must print nothing.

Tests: [`tests/direct/test_verdict_parse.py`](https://github.com/Ayan1816/proof-of-work/blob/main/tests/direct/test_verdict_parse.py)
(`test_semantic_prompt_asks_for_meaning_not_tokens`,
`test_parse_semantic_equivalent_requires_explicit_true`).

Direct-mode mocks answer the semantic prompt and the judge prompt
separately in [`tests/direct/test_proof_of_work.py`](https://github.com/Ayan1816/proof-of-work/blob/main/tests/direct/test_proof_of_work.py)
(`_mock_llms`).

---

## 2. Second evidence fetch is not derived from the proof URL

`_fetch_independent_evidence(spec)` does not take a proof link. Both
branches build a URL from the bounty specification only:

1. Wikipedia opensearch: `_independent_lookup_url(spec)`
2. If that fetch fails, Jina reads a Wikipedia search page:
   `_independent_jina_lookup_url(spec)`

`_prepared_work` still fetches the submitter URL as the primary page, then
calls `_fetch_independent_evidence(spec)` for the second page.

| Function | Lines | GitHub |
| --- | --- | --- |
| `WIKIPEDIA_SEARCH` / `JINA_READER_PREFIX` | 24–25 | [L24–L25](https://github.com/Ayan1816/proof-of-work/blob/main/contracts/proof_of_work.py#L24-L25) |
| `_spec_claim_query` | 337–381 | [L337–L381](https://github.com/Ayan1816/proof-of-work/blob/main/contracts/proof_of_work.py#L337-L381) |
| `_independent_lookup_url` | 384–392 | [L384–L392](https://github.com/Ayan1816/proof-of-work/blob/main/contracts/proof_of_work.py#L384-L392) |
| `_independent_jina_lookup_url` | 395–402 | [L395–L402](https://github.com/Ayan1816/proof-of-work/blob/main/contracts/proof_of_work.py#L395-L402) |
| `_fetch_independent_evidence` | 419–448 | [L419–L448](https://github.com/Ayan1816/proof-of-work/blob/main/contracts/proof_of_work.py#L419-L448) |
| `_prepared_work` | 535–549 | [L535–L549](https://github.com/Ayan1816/proof-of-work/blob/main/contracts/proof_of_work.py#L535-L549) |

`_corroboration_url` (the old helper that rewrote the submitter link into
Wikipedia REST, GitHub Contents, or `r.jina.ai/{proof}`) is gone.

Test: `test_independent_lookup_uses_spec_not_submitter_url` in
[`tests/direct/test_verdict_parse.py`](https://github.com/Ayan1816/proof-of-work/blob/main/tests/direct/test_verdict_parse.py).
It builds a lookup from a spec about artificial intelligence and asserts
the submitter host `evil.example` is not in the URL.

---

## 3. Still in the same contract (unchanged paths)

| Behavior | Where |
| --- | --- |
| `gl.vm.UserError` instead of bare `Exception` | search `raise gl.vm.UserError` in the contract |
| Creator refund / cancel escrow | [`refund` L1004](https://github.com/Ayan1816/proof-of-work/blob/main/contracts/proof_of_work.py#L1004) |
| Transaction history UI | [`frontend/app/history/page.tsx`](https://github.com/Ayan1816/proof-of-work/blob/main/frontend/app/history/page.tsx) and [`frontend/lib/history/store.ts`](https://github.com/Ayan1816/proof-of-work/blob/main/frontend/lib/history/store.ts) |

On-chain receipts are not listed in this file. Confirm logic by reading
the functions above.

## 4. Input and payout guards

These do not replace the semantic check or the spec-only lookup. They stop
naive URL and escrow mistakes:

| Guard | Function |
| --- | --- |
| Reject loopback, link-local, private hosts, and URLs with credentials or whitespace | `_proof_url_error`, `_host_is_blocked`, `_require_http_url` |
| Pay and refund only to a 20-byte `0x` address | `_require_address` |
| Cap title, spec, description, reasoning, and reward | `MAX_TITLE_LEN`, `MAX_TEXT_LEN`, `MAX_REASONING_LEN`, `MAX_REWARD` |
| Strip prompt-injection markers before both LLM prompts | `_sanitize_untrusted` inside `_build_judge_prompt` and `_semantic_equivalence_prompt` |
| Refuse to judge when the spec-only Wikipedia/Jina lookup returns nothing | `_prepared_work` |

```bash
rg -n "def _proof_url_error|def _require_address|Independent spec lookup failed" contracts/proof_of_work.py
```
