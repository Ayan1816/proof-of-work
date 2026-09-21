# Independently verifiable evidence — Proof of Work

**Do not treat this markdown as the implementation.** The implementation is
Python and TypeScript in this GitHub repository. Open the linked files and
read the functions. If a Studio explorer hash cannot be loaded, the source
links below are still sufficient to verify Jaccard, stemming, second-source
fetch, `gl.vm.UserError`, refund, and history.

| Item | Canonical location |
| --- | --- |
| GitHub repo | https://github.com/Ayan1816/proof-of-work |
| Mirror remote | https://github.com/Ayan1816/genlayer-project-boilerplate |
| Contract (single source) | [`contracts/proof_of_work.py`](https://github.com/Ayan1816/proof-of-work/blob/main/contracts/proof_of_work.py) |
| Helper tests | [`tests/direct/test_verdict_parse.py`](https://github.com/Ayan1816/proof-of-work/blob/main/tests/direct/test_verdict_parse.py) |
| Direct contract tests | [`tests/direct/test_proof_of_work.py`](https://github.com/Ayan1816/proof-of-work/blob/main/tests/direct/test_proof_of_work.py) |
| History UI | [`frontend/app/history/page.tsx`](https://github.com/Ayan1816/proof-of-work/blob/main/frontend/app/history/page.tsx) |

Verify from a clone (no Studio, no wallet):

```bash
git clone https://github.com/Ayan1816/proof-of-work.git
cd proof-of-work
rg -n "def _same_judgment|def _token_jaccard|def _stem_token|def _corroboration_url|gl.vm.UserError|def refund" contracts/proof_of_work.py
python3 tests/direct/test_verdict_parse.py
```

---

## 1. Jaccard similarity + token stemming (source, not a write-up)

File: [`contracts/proof_of_work.py`](https://github.com/Ayan1816/proof-of-work/blob/main/contracts/proof_of_work.py)

| Function | Lines (approx.) | GitHub |
| --- | --- | --- |
| `MIN_TOKEN_JACCARD = 12` | 22–24 | [L22–L24](https://github.com/Ayan1816/proof-of-work/blob/main/contracts/proof_of_work.py#L22-L24) |
| `_stem_token` | 197–206 | [L197–L206](https://github.com/Ayan1816/proof-of-work/blob/main/contracts/proof_of_work.py#L197-L206) |
| `_significant_tokens` | 209–230 | [L209–L230](https://github.com/Ayan1816/proof-of-work/blob/main/contracts/proof_of_work.py#L209-L230) |
| `_token_jaccard` | 233–240 | [L233–L240](https://github.com/Ayan1816/proof-of-work/blob/main/contracts/proof_of_work.py#L233-L240) |
| `_same_judgment` | 307–338 | [L307–L338](https://github.com/Ayan1816/proof-of-work/blob/main/contracts/proof_of_work.py#L307-L338) |
| `validator_fn` uses `_same_judgment` | 725–738, 768–781 | [L725–L738](https://github.com/Ayan1816/proof-of-work/blob/main/contracts/proof_of_work.py#L725-L738) |

Integer Jaccard (not floats, not string equality):

```python
def _token_jaccard(left: set, right: set) -> int:
    """Jaccard similarity of two token sets, as an integer percent 0–100."""
    if not left or not right:
        return 0
    union = left | right
    if not union:
        return 0
    return (len(left & right) * 100) // len(union)
```

Stemming + synonym canonicalization:

```python
def _stem_token(word: str) -> str:
    """Light stemmer plus synonym canonicalization for evidence terms."""
    text = str(word or "").lower()
    for suffix in ("ational", "ation", "ness", "ment", "ing", "ers", "ies", "es", "ed", "er", "ly", "s"):
        if len(text) > len(suffix) + 3 and text.endswith(suffix):
            stem = text[: -len(suffix)]
            if suffix == "ies":
                stem += "y"
            return _SYNONYM_STEMS.get(stem, stem)
    return _SYNONYM_STEMS.get(text, text)
```

`_same_judgment` requires matching Approved/Rejected **and** stemmed overlap
(Jaccard ≥ 12% or ≥ 2 content stems). It does **not** accept a non-empty
reasoning string alone.

Unit tests that execute this code:  
[`tests/direct/test_verdict_parse.py`](https://github.com/Ayan1816/proof-of-work/blob/main/tests/direct/test_verdict_parse.py)
(`test_stemmed_paraphrase_is_same_judgment`,
`test_synonym_stems_count_as_semantic_overlap`,
`test_generic_independent_reasoning_rejected`).

---

## 2. Wikipedia REST + Jina second-source corroboration (source)

Same file: [`contracts/proof_of_work.py`](https://github.com/Ayan1816/proof-of-work/blob/main/contracts/proof_of_work.py)

| Function | Lines | GitHub |
| --- | --- | --- |
| `JINA_READER_PREFIX` | 26 | [L26](https://github.com/Ayan1816/proof-of-work/blob/main/contracts/proof_of_work.py#L26) |
| `_corroboration_url` | 450–483 | [L450–L483](https://github.com/Ayan1816/proof-of-work/blob/main/contracts/proof_of_work.py#L450-L483) |
| `_fetch_corroboration` | 498–528 | [L498–L528](https://github.com/Ayan1816/proof-of-work/blob/main/contracts/proof_of_work.py#L498-L528) |
| `_prepared_work` (primary `web.get` + corroboration) | 608–624 | [L608–L624](https://github.com/Ayan1816/proof-of-work/blob/main/contracts/proof_of_work.py#L608-L624) |
| `_compose_work` (`<evidence-secondary>`) | 547–606 | [L547–L606](https://github.com/Ayan1816/proof-of-work/blob/main/contracts/proof_of_work.py#L547-L606) |
| `_build_judge_prompt` (treat secondary as untrusted) | 284–304 | [L284–L304](https://github.com/Ayan1816/proof-of-work/blob/main/contracts/proof_of_work.py#L284-L304) |

`_corroboration_url` maps:

- `wikipedia.org/wiki/{title}` → `{host}/api/rest_v1/page/summary/{title}`
- GitHub blob/raw → `api.github.com/repos/.../contents/...?ref=...`
- other http(s) → `https://r.jina.ai/{url}`

Second fetch is `gl.nondet.web.get` inside `_fetch_corroboration`. Low
stemmed overlap (`MIN_CORROBORATION_OVERLAP = 8`) adds a corroboration
warning. Injection is stripped by `_sanitize_untrusted`
([L397–L410](https://github.com/Ayan1816/proof-of-work/blob/main/contracts/proof_of_work.py#L397-L410)).

Tests: `test_corroboration_url_uses_wikipedia_rest_and_jina`,
`test_github_blob_corroborates_via_contents_api` in
[`tests/direct/test_verdict_parse.py`](https://github.com/Ayan1816/proof-of-work/blob/main/tests/direct/test_verdict_parse.py).

---

## 3. `gl.vm.UserError` (source)

Bare `Exception` is not used for user-facing contract errors. Search:

```bash
rg -n "raise gl.vm.UserError" contracts/proof_of_work.py
rg -n "raise Exception\\(" contracts/proof_of_work.py   # should be empty
```

Examples in
[`contracts/proof_of_work.py`](https://github.com/Ayan1816/proof-of-work/blob/main/contracts/proof_of_work.py):

- [L716–L717](https://github.com/Ayan1816/proof-of-work/blob/main/contracts/proof_of_work.py#L716-L717) — failed verdict parse
- [L820](https://github.com/Ayan1816/proof-of-work/blob/main/contracts/proof_of_work.py#L820) — bounty not found
- [L868–L870](https://github.com/Ayan1816/proof-of-work/blob/main/contracts/proof_of_work.py#L868-L870) — refund not allowed
- [L1094](https://github.com/Ayan1816/proof-of-work/blob/main/contracts/proof_of_work.py#L1094) — non-creator refund
- [L1115–L1119](https://github.com/Ayan1816/proof-of-work/blob/main/contracts/proof_of_work.py#L1115-L1119) — appeal guards

---

## 4. Refund / cancel escrow (source)

There is no `cancel` method. Creator `refund` is the cancel path.

| Function | Lines | GitHub |
| --- | --- | --- |
| `_refund_allowed` | 852–861 | [L852–L861](https://github.com/Ayan1816/proof-of-work/blob/main/contracts/proof_of_work.py#L852-L861) |
| `_refund_escrow` | 863–884 | [L863–L884](https://github.com/Ayan1816/proof-of-work/blob/main/contracts/proof_of_work.py#L863-L884) |
| `refund` (public write) | 1086–1104 | [L1086–L1104](https://github.com/Ayan1816/proof-of-work/blob/main/contracts/proof_of_work.py#L1086-L1104) |
| `appeal` | 1106–1126 | [L1106–L1126](https://github.com/Ayan1816/proof-of-work/blob/main/contracts/proof_of_work.py#L1106-L1126) |

Allowed when: `Open` past deadline, or `Rejected`, or rejected with
`appeal_count >= MAX_APPEALS`. Tests:
[`tests/direct/test_proof_of_work.py`](https://github.com/Ayan1816/proof-of-work/blob/main/tests/direct/test_proof_of_work.py)
(`test_refund_requires_rejected_or_expired`,
`test_non_creator_cannot_refund`).

---

## 5. Transaction history (source)

Not a Studio log. Frontend code:

| File | GitHub |
| --- | --- |
| History page | [`frontend/app/history/page.tsx`](https://github.com/Ayan1816/proof-of-work/blob/main/frontend/app/history/page.tsx) |
| Row UI | [`frontend/components/HistoryEntry.tsx`](https://github.com/Ayan1816/proof-of-work/blob/main/frontend/components/HistoryEntry.tsx) |
| `localStorage` `pow:tx-history:v1:` | [`frontend/lib/history/store.ts`](https://github.com/Ayan1816/proof-of-work/blob/main/frontend/lib/history/store.ts) |
| Merge with `list_bounties()` | [`frontend/lib/history/merge.ts`](https://github.com/Ayan1816/proof-of-work/blob/main/frontend/lib/history/merge.ts) |
| Record on every `write()` | [`frontend/lib/contracts/ProofOfWork.ts`](https://github.com/Ayan1816/proof-of-work/blob/main/frontend/lib/contracts/ProofOfWork.ts) (`upsertHistoryItem`) |

---

## Optional Studio explorer cross-check (not a substitute for source)

If a reviewer also wants on-chain lifecycle hashes, query Studio RPC. These
values were read from `eth_getTransactionByHash` against
`https://studio.genlayer.com/api` and the public explorer page
https://explorer-studio.genlayer.com/address/0x6E64B75d36E72c0553A14a595940E793BCd17765
during development. **If any hash 404s, ignore this section and verify the
Python/TS links above.** This document does not invent placeholder ids such
as `testnet_deploy_tx` or `tx_1799`.

Contract: [`0x6E64B75d36E72c0553A14a595940E793BCd17765`](https://explorer-studio.genlayer.com/address/0x6E64B75d36E72c0553A14a595940E793BCd17765)

| Method | Hash (verify on explorer or via RPC) |
| --- | --- |
| Deploy | [`0xa533c826b9e85b178e41234c9602344f4f96986a2f044d3697bee24f49ddf3be`](https://explorer-studio.genlayer.com/tx/0xa533c826b9e85b178e41234c9602344f4f96986a2f044d3697bee24f49ddf3be) |
| `create_bounty` | [`0xdb26ba0035ac19b249873c65f14fbee8250230e2fbcd5ffbee76c55948d1d5b3`](https://explorer-studio.genlayer.com/tx/0xdb26ba0035ac19b249873c65f14fbee8250230e2fbcd5ffbee76c55948d1d5b3) |
| `submit_work` | [`0xc11ba6d48c2df418f486a59fb8a2ea0dcff1d8f6457e9f8f72c2a4ef40c9f314`](https://explorer-studio.genlayer.com/tx/0xc11ba6d48c2df418f486a59fb8a2ea0dcff1d8f6457e9f8f72c2a4ef40c9f314) |
| `judge_submission` | [`0x151862a8c832dc575daf4710acf33e6c5bcad4ff98704a33759e5f34fe7ada77`](https://explorer-studio.genlayer.com/tx/0x151862a8c832dc575daf4710acf33e6c5bcad4ff98704a33759e5f34fe7ada77) |
| `appeal` | [`0xe54b0f910809595615a5842c30fa8a1064b6501903e2457836089590d1b05781`](https://explorer-studio.genlayer.com/tx/0xe54b0f910809595615a5842c30fa8a1064b6501903e2457836089590d1b05781) |
| `release_payment` | [`0x60076039531aa2e2fb435a68b6a8baa5ac83947fac092d45f1d77b9880b2eabf`](https://explorer-studio.genlayer.com/tx/0x60076039531aa2e2fb435a68b6a8baa5ac83947fac092d45f1d77b9880b2eabf) |
| `refund` | [`0x66838c01099585363292f496778fbc02da99c8284ff441ee54ea2cf08cadbc35`](https://explorer-studio.genlayer.com/tx/0x66838c01099585363292f496778fbc02da99c8284ff441ee54ea2cf08cadbc35) |

RPC check:

```bash
curl -sS -X POST https://studio.genlayer.com/api \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_getTransactionByHash","params":["0xe54b0f910809595615a5842c30fa8a1064b6501903e2457836089590d1b05781"]}'
```

A `FINALIZED` receipt with method `appeal` confirms the hash. A null result
means the Studio explorer rotated state; **use the GitHub source links**,
not a reconstructed log.

---

## What this file is not

- It is not the contract.
- It is not a substitute for opening `contracts/proof_of_work.py`.
- It does not contain dummy ids (`testnet_deploy_tx`, `tx_1799`, …).
- Implementation of Jaccard, stemming, Jina/Wikipedia corroboration, and
  `gl.vm.UserError` is only in the linked Python module, which reviewers
  can clone and grep.
