"""Sanity checks for frontend wallet-error copy (no Node runtime required)."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ERROR_FILE = ROOT / "frontend" / "lib" / "utils" / "errorMessage.ts"
CLIENT_FILE = ROOT / "frontend" / "lib" / "genlayer" / "client.ts"
CONTRACT_CLIENT = ROOT / "frontend" / "lib" / "contracts" / "ProofOfWork.ts"


def test_gas_error_is_humanized():
    source = ERROR_FILE.read_text()
    assert "gas balance is not enough" in source.lower()
    assert "chain ID 61999" in source
    assert "humanizeWalletError" in source


def test_write_path_uses_injected_provider_and_network_guard():
    source = CONTRACT_CLIENT.read_text()
    assert "ensureGenLayerNetwork" in source
    assert "getEthereumProvider" in source
    assert "forWrite" in source
    assert "Not enough GEN to lock this reward" in source


def test_chain_id_hex_is_lowercase():
    source = CLIENT_FILE.read_text()
    assert "toLowerCase()" in source
    assert "getWalletRpcUrl" in source
    assert "getGenLayerNetworkParams" in source


if __name__ == "__main__":
    test_gas_error_is_humanized()
    test_write_path_uses_injected_provider_and_network_guard()
    test_chain_id_hex_is_lowercase()
    print("ALL FRONTEND WALLET HEALTH CHECKS PASSED")
