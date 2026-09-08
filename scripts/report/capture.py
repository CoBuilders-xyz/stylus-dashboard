"""Capture public dashboard data without credentials; Python 3 standard library only."""

import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import subprocess
from urllib.request import Request, urlopen

HERE = Path(__file__).resolve().parent


def capture(endpoint):
    started = datetime.now(timezone.utc)
    now = int(started.timestamp()) // 3600 * 3600
    requests = []

    def query(name, variables):
        document = (HERE / f"{name}.graphql").read_text()
        request = {"query": document, "variables": variables}
        with urlopen(Request(endpoint, data=json.dumps(request).encode(),
                             headers={"Content-Type": "application/json"}), timeout=60) as response:
            result = json.load(response)
        if result.get("errors") or "data" not in result:
            raise RuntimeError(f"{name}: {result}")
        requests.append({"document": f"{name}.graphql", "variables": variables,
                         "sha256": hashlib.sha256(document.encode()).hexdigest()})
        return result["data"]

    variables = {"now": now, "d7": now + 7 * 86400}
    before = query("summary", variables)
    if len(before["_meta"]) != 1 or before["_meta"][0]["chainId"] != 42161:
        raise RuntimeError("This report requires a single Arbitrum One dataset")
    tables = {}
    for name, entity in [("daily", "DailyStats"), ("contracts", "StylusContract"),
                         ("builders", "DeployerRegistry")]:
        rows, after = [], ""
        # Continue until an empty page, even if Hasura caps pages below our limit.
        for _ in range(10000):
            page = query(name, {"after": after, "limit": 250})[entity]
            if not page:
                break
            if any(row["id"] <= after for row in page):
                raise RuntimeError(f"{entity}: pagination did not advance")
            rows.extend(page)
            after = page[-1]["id"]
        else:
            raise RuntimeError(f"{entity}: pagination exceeded safety bound")
        tables[entity] = rows
    after = query("summary", variables)
    count = after["StylusContract_aggregate"]["aggregate"]["count"]
    checks = {
        "contract_rows_match_aggregate": len(tables["StylusContract"]) == count,
        "daily_activations_match_contracts": sum(r["stylusActivations"] for r in tables["DailyStats"]) == count,
        "builder_contract_counts_match_contracts": sum(r["stylusContractCount"] for r in tables["DeployerRegistry"]) == count,
        "builder_rows_match_global": len(tables["DeployerRegistry"]) == after["GlobalStats"][0]["cumulativeDeployers"],
        "daily_evm_deployments_match_global": sum(r["evmDeployments"] for r in tables["DailyStats"]) == after["GlobalStats"][0]["totalEvmContracts"],
        "all_contracts_on_arbitrum_one": all(r["chainId"] == 42161 for r in tables["StylusContract"]),
        "indexer_ready_before_and_after": all(s["_meta"][0]["isReady"] for s in [before, after]),
    }
    return {"formatVersion": 1, "endpoint": endpoint, "startedAt": started.isoformat(),
            "finishedAt": datetime.now(timezone.utc).isoformat(), "expiryReference": now,
            "sourceCommit": subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip(),
            "consistency": "Sequential reads of a live indexer, not a block-pinned database transaction.",
            "requests": requests, "summaryBefore": before, "summaryAfter": after,
            "checks": checks, "tables": tables}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--endpoint", default="https://stylus-dashboard-hql.up.railway.app/v1/graphql")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if args.output.exists():
        parser.error("Output exists; use a new path to preserve the original snapshot")
    snapshot = capture(args.endpoint)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(snapshot, indent=2) + "\n")
    print(json.dumps({"output": str(args.output), "checks": snapshot["checks"]}, indent=2))
