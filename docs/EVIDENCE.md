# Durable Evidence — Proof of Work on GenLayer Studio

Reviewers can verify the live appeal-to-payout lifecycle from the links below.
Nothing here requires re-running Studio, funding accounts, or waiting for
consensus. Every hash is `FINALIZED` / `Accepted` on
[GenLayer Studio](https://studio.genlayer.com/).

## Deployment

| Field | Value |
| --- | --- |
| Network | GenLayer Studio (`studionet`) |
| RPC | `https://studio.genlayer.com/api` |
| Chain ID | `61999` |
| Contract | [`0x6E64B75d36E72c0553A14a595940E793BCd17765`](https://explorer-studio.genlayer.com/address/0x6E64B75d36E72c0553A14a595940E793BCd17765) |
| Contract name | `Proof of Work` (`get_name`) |
| Creator / deployer | [`0x111Aab63c14D781cDECAAF8ab8AC46c7c7441a8E`](https://explorer-studio.genlayer.com/address/0x111Aab63c14D781cDECAAF8ab8AC46c7c7441a8E) |
| Contributor (submitter) | [`0xF38F8e5009F02a4d8334e3B5a6BA2A0021449F76`](https://explorer-studio.genlayer.com/address/0xF38F8e5009F02a4d8334e3B5a6BA2A0021449F76) |
| Deploy transaction | [`0xa533c826b9e85b178e41234c9602344f4f96986a2f044d3697bee24f49ddf3be`](https://explorer-studio.genlayer.com/tx/0xa533c826b9e85b178e41234c9602344f4f96986a2f044d3697bee24f49ddf3be) |
| Deployed | 17 Sep 2026, 18:39 UTC |
| Frontend env | `frontend/.env.example` → `NEXT_PUBLIC_CONTRACT_ADDRESS=0x6E64B75d36E72c0553A14a595940E793BCd17765` |
| Deploy script | `deploy/deployWithKey.mjs` |
| Lifecycle script | `deploy/lifecycleTestnet.mjs` |

Explorer contract page (all 29 transactions):
https://explorer-studio.genlayer.com/address/0x6E64B75d36E72c0553A14a595940E793BCd17765

---

## Appeal-to-payout lifecycle (bounty `2`)

This is the path the judges asked to see: create → submit → independent
judgment → appeal → re-judgment → escrow payout.

**Bounty spec (on-chain):** “Submit a valid public URL of an article that
discusses Artificial Intelligence. The web page must contain information
about AI.”

**Proof link:** `https://en.wikipedia.org/wiki/Artificial_intelligence`

**Reward locked:** `1000000000000000000` wei (1 GEN)

| Step | Method | Tx hash | From | Decoded return | Status |
| --- | --- | --- | --- | --- | --- |
| 1 | `create_bounty` | [`0xdb26ba0035ac19b249873c65f14fbee8250230e2fbcd5ffbee76c55948d1d5b3`](https://explorer-studio.genlayer.com/tx/0xdb26ba0035ac19b249873c65f14fbee8250230e2fbcd5ffbee76c55948d1d5b3) | creator `0x111Aab…441a8E` | `{"id":"2","reward":1000000000000000000,"status":"Open"}` | FINALIZED / Accepted |
| 2 | `submit_work` | [`0xc11ba6d48c2df418f486a59fb8a2ea0dcff1d8f6457e9f8f72c2a4ef40c9f314`](https://explorer-studio.genlayer.com/tx/0xc11ba6d48c2df418f486a59fb8a2ea0dcff1d8f6457e9f8f72c2a4ef40c9f314) | submitter `0xF38F8e…449F76` | `{"bounty_id":"2","id":"1","status":"InReview"}` | FINALIZED / Accepted |
| 3 | `judge_submission` | [`0x151862a8c832dc575daf4710acf33e6c5bcad4ff98704a33759e5f34fe7ada77`](https://explorer-studio.genlayer.com/tx/0x151862a8c832dc575daf4710acf33e6c5bcad4ff98704a33759e5f34fe7ada77) | submitter `0xF38F8e…449F76` | `{"approved":true,"id":"2","status":"Approved","reasoning":"The submitted URL (https://en.wikipedia.org/wiki/Artificial_intelligence) and the fetched evidence clearly show a Wikipedia article titled 'Artificial intelligence'…"}` | FINALIZED / Accepted (3 agree) |
| 4 | `appeal` | [`0xe54b0f910809595615a5842c30fa8a1064b6501903e2457836089590d1b05781`](https://explorer-studio.genlayer.com/tx/0xe54b0f910809595615a5842c30fa8a1064b6501903e2457836089590d1b05781) | submitter `0xF38F8e…449F76` | `{"appeal_count":1,"id":"2","status":"Appealed"}` | FINALIZED / Accepted (5 agree) |
| 5 | `judge_submission` (after appeal) | [`0x88b0b0e2fef6476511278701acb99511b2533b60bbbde3a49f26ea2d162013bb`](https://explorer-studio.genlayer.com/tx/0x88b0b0e2fef6476511278701acb99511b2533b60bbbde3a49f26ea2d162013bb) | `0x07cbe0…5bf80c` | `{"approved":true,"id":"2","status":"Approved","reasoning":"The submitted proof link is https://en.wikipedia.org/wiki/Artificial_intelligence, whose fetched HTML title is 'Artificial intelligence - Wikipedia'…"}` | FINALIZED / Accepted (3 agree) |
| 6 | `release_payment` | [`0x60076039531aa2e2fb435a68b6a8baa5ac83947fac092d45f1d77b9880b2eabf`](https://explorer-studio.genlayer.com/tx/0x60076039531aa2e2fb435a68b6a8baa5ac83947fac092d45f1d77b9880b2eabf) | `0x07cbe0…5bf80c` | `{"id":"2","paid_to":"0xF38F8e5009F02a4d8334e3B5a6BA2A0021449F76","status":"Paid"}` | FINALIZED / Accepted |

Escrow left the contract on step 6 (outgoing transfer to the original
submitter). Explorer shows the matching outbound call from
`0x6E64B7…d17765` immediately after `release_payment`.

---

## Direct approve-to-payout (bounty `3`)

A second full lifecycle without an appeal, proving payout is not unique to
the appealed bounty.

| Step | Method | Tx hash | Decoded return |
| --- | --- | --- | --- |
| 1 | `create_bounty` | [`0xd831c3c79fc3beeacba688ce90b89a60a54101786c2e6c5251c20c82a249af7c`](https://explorer-studio.genlayer.com/tx/0xd831c3c79fc3beeacba688ce90b89a60a54101786c2e6c5251c20c82a249af7c) | `{"id":"3","reward":1000000000000000000,"status":"Open"}` |
| 2 | `submit_work` | [`0x43e3c981caa698b8e3728f5bd00cc23e6e6c5a4d748d829e81d9d3d10672deaa`](https://explorer-studio.genlayer.com/tx/0x43e3c981caa698b8e3728f5bd00cc23e6e6c5a4d748d829e81d9d3d10672deaa) | InReview (bounty `3`) |
| 3 | `judge_submission` | [`0xa3158c98db75e8e1d6a90655a6754af917decacd4feb6bf6c1f3420ec1f61ef4`](https://explorer-studio.genlayer.com/tx/0xa3158c98db75e8e1d6a90655a6754af917decacd4feb6bf6c1f3420ec1f61ef4) | Approved (bounty `3`) |
| 4 | `release_payment` | [`0x97e0af023a6c87cc4d4b38278dd635daf1d7cf2ff2ac50930b81b5f4083487db`](https://explorer-studio.genlayer.com/tx/0x97e0af023a6c87cc4d4b38278dd635daf1d7cf2ff2ac50930b81b5f4083487db) | `{"id":"3","paid_to":"0xF38F8e5009F02a4d8334e3B5a6BA2A0021449F76","status":"Paid"}` |

---

## Captured lifecycle script log (reconstructed from Studio receipts)

The commands below are what `node deploy/lifecycleTestnet.mjs` prints. The
hashes and return blobs are copied from `eth_getTransactionByHash` on
`https://studio.genlayer.com/api`, not re-simulated.

```
Network: studionet
Contract: 0x6E64B75d36E72c0553A14a595940E793BCd17765
Creator:  0x111Aab63c14D781cDECAAF8ab8AC46c7c7441a8E
Contributor: 0xF38F8e5009F02a4d8334e3B5a6BA2A0021449F76
get_name: Proof of Work

>> create_bounty
tx: 0xdb26ba0035ac19b249873c65f14fbee8250230e2fbcd5ffbee76c55948d1d5b3
status: 6 FINALIZED
return: {
  "id": "2",
  "reward": 1000000000000000000,
  "status": "Open"
}

>> submit_work
tx: 0xc11ba6d48c2df418f486a59fb8a2ea0dcff1d8f6457e9f8f72c2a4ef40c9f314
status: 6 FINALIZED
return: {
  "bounty_id": "2",
  "id": "1",
  "status": "InReview"
}

>> judge_submission
tx: 0x151862a8c832dc575daf4710acf33e6c5bcad4ff98704a33759e5f34fe7ada77
status: 6 FINALIZED
votes: 3 agree / 2 idle
return: {
  "approved": true,
  "id": "2",
  "reasoning": "The submitted URL (https://en.wikipedia.org/wiki/Artificial_intelligence) and the fetched evidence clearly show a Wikipedia article titled 'Artificial intelligence', which satisfies the spec's requirement for a valid public URL of an article that discusses and contains information about AI.",
  "status": "Approved"
}

>> appeal
tx: 0xe54b0f910809595615a5842c30fa8a1064b6501903e2457836089590d1b05781
status: 6 FINALIZED
votes: 5 agree
return: {
  "appeal_count": 1,
  "id": "2",
  "status": "Appealed"
}

>> judge_submission (after appeal)
tx: 0x88b0b0e2fef6476511278701acb99511b2533b60bbbde3a49f26ea2d162013bb
status: 6 FINALIZED
votes: 3 agree / 2 idle
return: {
  "approved": true,
  "id": "2",
  "reasoning": "The submitted proof link is https://en.wikipedia.org/wiki/Artificial_intelligence, whose fetched HTML title is 'Artificial intelligence - Wikipedia' and whose body is the Wikipedia article on AI, satisfying the spec's requirement for a valid public URL of an article that discusses and contains information about Artificial Intelligence.",
  "status": "Approved"
}

>> release_payment
tx: 0x60076039531aa2e2fb435a68b6a8baa5ac83947fac092d45f1d77b9880b2eabf
status: 6 FINALIZED
return: {
  "id": "2",
  "paid_to": "0xF38F8e5009F02a4d8334e3B5a6BA2A0021449F76",
  "status": "Paid"
}

=== LIFECYCLE RESULT ===
LIFECYCLE OK: create → submit → judge → appeal → rejudge → payout
```

---

## Instant verification (no reproduction)

1. Open the [contract page](https://explorer-studio.genlayer.com/address/0x6E64B75d36E72c0553A14a595940E793BCd17765).
2. Confirm `Deploy Tx` is `0xa533c826…49ddf3be` and creator is `0x111Aab…441a8E`.
3. Click the six appeal-to-payout hashes in order. Each page must show
   `FINALIZED`, method name matching the table, and `Consensus Result: Accepted`.
4. Optional RPC check:

```bash
curl -sS -X POST https://studio.genlayer.com/api \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_getTransactionByHash","params":["0xe54b0f910809595615a5842c30fa8a1064b6501903e2457836089590d1b05781"]}'
```

The result’s `status` is `"FINALIZED"`. Validator `result` blobs are
base64-encoded JSON; the appeal payload decodes to
`{"appeal_count": 1, "id": "2", "status": "Appealed"}`.

To re-run the script against a **new** bounty (not required for review):

```bash
# requires PRIVATE_KEY and CONTRACT_ADDRESS in repo-root .env
node deploy/lifecycleTestnet.mjs
```

---

## Related on-chain refunds

Creator-only `refund` after a rejected / unused bounty, proving escrow also
returns to the creator:

| Method | Tx hash |
| --- | --- |
| `refund` | [`0x66838c01099585363292f496778fbc02da99c8284ff441ee54ea2cf08cadbc35`](https://explorer-studio.genlayer.com/tx/0x66838c01099585363292f496778fbc02da99c8284ff441ee54ea2cf08cadbc35) |
| `refund` | [`0x965590cbc97dadfaf21331530e5f1e9503a9304a51783e2fcdd122eb76bc4aff`](https://explorer-studio.genlayer.com/tx/0x965590cbc97dadfaf21331530e5f1e9503a9304a51783e2fcdd122eb76bc4aff) |
| `refund` | [`0xf8744bbe2cf07cdf5d764260b53c260f69a72be063a51fb1bdf5c1089b07e13f`](https://explorer-studio.genlayer.com/tx/0xf8744bbe2cf07cdf5d764260b53c260f69a72be063a51fb1bdf5c1089b07e13f) |
