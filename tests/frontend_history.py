"""Guards for the frontend transaction history feature."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONTRACT = ROOT / "contracts" / "proof_of_work.py"
CI = ROOT / ".github" / "workflows" / "ci.yml"
PACKAGE = ROOT / "package.json"
FRONTEND_PKG = ROOT / "frontend" / "package.json"
HISTORY_PAGE = ROOT / "frontend" / "app" / "history" / "page.tsx"
STORE = ROOT / "frontend" / "lib" / "history" / "store.ts"
MERGE = ROOT / "frontend" / "lib" / "history" / "merge.ts"
POW = ROOT / "frontend" / "lib" / "contracts" / "ProofOfWork.ts"


def test_history_files_exist():
    assert HISTORY_PAGE.exists()
    assert STORE.exists()
    assert MERGE.exists()
    page = HISTORY_PAGE.read_text()
    assert "Bounty Created" not in page or "History" in page
    store = STORE.read_text()
    assert "localStorage" in store
    assert "pow:tx-history:v1:" in store
    merge = MERGE.read_text()
    assert "historyFromBounties" in merge
    assert "release_payment" in merge
    pow_src = POW.read_text()
    assert "upsertHistoryItem" in pow_src
    assert "ensureGenLayerNetwork" in pow_src


def test_preserved_contract_and_ci_untouched_by_history_feature():
    contract = CONTRACT.read_text()
    assert "def _same_judgment" in contract
    assert "MIN_TOKEN_JACCARD" in contract
    assert "_corroboration_url" in contract
    assert "r.jina.ai" in contract
    assert "@gl.public.write" in contract
    assert "def refund" in contract
    ci = CI.read_text()
    assert "npm ci" in ci
    assert "npm run build" in ci
    assert '"name": "proof-of-work"' in FRONTEND_PKG.read_text()
    assert '"name": "genlayer-project"' in PACKAGE.read_text()


if __name__ == "__main__":
    test_history_files_exist()
    test_preserved_contract_and_ci_untouched_by_history_feature()
    print("ALL HISTORY FEATURE CHECKS PASSED")
