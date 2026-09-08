"""Reproduce report metrics and figures from a captured JSON snapshot (no network)."""

import argparse
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
import hashlib
import json
from pathlib import Path


def analyze(snapshot):
    daily = snapshot["tables"]["DailyStats"]
    contracts = snapshot["tables"]["StylusContract"]
    builders = sorted(snapshot["tables"]["DeployerRegistry"],
                      key=lambda row: (-row["stylusContractCount"], row["id"]))
    summary = snapshot["summaryAfter"]
    global_stats = summary["GlobalStats"][0]
    cutoff = datetime.fromisoformat(snapshot["startedAt"]).astimezone(timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0)

    def period(start, end):
        rows = [r for r in daily if start.timestamp() <= r["date"] < end.timestamp()]
        result = {"fromInclusive": start.date().isoformat(), "toExclusive": end.date().isoformat()}
        for field in ["stylusActivations", "stylusReactivations", "uniqueStylusDeployers",
                      "evmDeployments", "cacheEvents"]:
            result[field] = sum(row[field] for row in rows)
        active_wallets = {c["deployer"] for c in contracts
                          if start.timestamp() <= c["activatedAt"] < end.timestamp()}
        result["activatingWallets"] = len(active_wallets)
        total = result["stylusActivations"] + result["evmDeployments"]
        result["observedSharePercent"] = 100 * result["stylusActivations"] / total if total else None
        return result

    monthly = defaultdict(lambda: {"activations": 0, "newWallets": 0, "evmCreations": 0})
    for row in daily:
        if row["date"] >= cutoff.timestamp():
            continue
        month = row["id"][:7]
        monthly[month]["activations"] += row["stylusActivations"]
        monthly[month]["newWallets"] += row["uniqueStylusDeployers"]
        monthly[month]["evmCreations"] += row["evmDeployments"]

    count = len(contracts)
    evm = global_stats["totalEvmContracts"]
    return {
        "cutoffExclusive": cutoff.isoformat(),
        "observedStylusAddresses": count, "observedCodehashes": len({c["codehash"] for c in contracts}),
        "stylusWallets": len(builders), "evmAddresses": evm,
        "observedSharePercent": 100 * count / (count + evm),
        "repeatWallets": sum(b["stylusContractCount"] > 1 for b in builders),
        "returningWallets": sum(b["stylusWeeks"] > 1 for b in builders),
        "returningPercent": 100 * sum(b["stylusWeeks"] > 1 for b in builders) / len(builders),
        "observedStylusWalletsAlsoEvm": sum(b["deployerType"] == "both" for b in builders),
        "top1SharePercent": 100 * builders[0]["stylusContractCount"] / count,
        "top5SharePercent": 100 * sum(b["stylusContractCount"] for b in builders[:5]) / count,
        "top10SharePercent": 100 * sum(b["stylusContractCount"] for b in builders[:10]) / count,
        "estimatedExpired": summary["expired"]["aggregate"]["count"],
        "estimatedExpiring7d": summary["expiring"]["aggregate"]["count"],
        "observedCached": summary["cached"]["aggregate"]["count"],
        "last30CompletedDays": period(cutoff - timedelta(days=30), cutoff),
        "prior30CompletedDays": period(cutoff - timedelta(days=60), cutoff - timedelta(days=30)),
        "last7CompletedDays": period(cutoff - timedelta(days=7), cutoff),
        "monthly": dict(sorted(monthly.items())), "top10Wallets": builders[:10],
    }


def figures(snapshot, metrics, output):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib.ticker import MaxNLocator

    plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 11,
                         "axes.spines.top": False, "axes.spines.right": False,
                         "svg.hashsalt": "stylus-report-2026-09-08"})
    fig, axes = plt.subplots(3, 1, figsize=(12, 12), constrained_layout=True)
    monthly = metrics["monthly"]
    months = list(monthly)
    axes[0].bar(months, [monthly[m]["activations"] for m in months], color="#2563eb")
    axes[0].set_title("First observed Stylus activations by month", loc="left", weight="bold")
    axes[0].set_ylabel("Program addresses")
    axes[0].tick_params(axis="x", rotation=60, labelsize=8)
    axes[0].text(0.99, 0.95, "Sep 2026: through Sep 7 only", transform=axes[0].transAxes,
                 ha="right", va="top", fontsize=10)

    cutoff = datetime.fromisoformat(metrics["cutoffExclusive"])
    first_days = Counter(datetime.fromtimestamp(b["firstStylusAt"], timezone.utc).date()
                         for b in snapshot["tables"]["DeployerRegistry"]
                         if b["firstStylusAt"] < cutoff.timestamp())
    days, totals, running = [], [], 0
    day = min(first_days)
    while day < cutoff.date():
        running += first_days[day]
        days.append(day)
        totals.append(running)
        day += timedelta(days=1)
    axes[1].step(days, totals, where="post", color="#08916e", linewidth=2)
    axes[1].set_title("Cumulative wallets with an observed first activation", loc="left", weight="bold")
    axes[1].set_ylabel("Wallet addresses")
    axes[1].yaxis.set_major_locator(MaxNLocator(integer=True))
    axes[1].set_ylim(bottom=0)

    top = metrics["top10Wallets"]
    labels = [f'{b["id"][:6]}…{b["id"][-4:]}' for b in top] + ["All other wallets"]
    values = [b["stylusContractCount"] for b in top]
    values.append(metrics["observedStylusAddresses"] - sum(values))
    axes[2].barh(labels[::-1], values[::-1], color=(["#2563eb"] * 10 + ["#64748b"])[::-1])
    axes[2].set_title("Activation concentration at capture time", loc="left", weight="bold")
    axes[2].set_xlabel("Observed program addresses attributed to each wallet")
    for i, v in enumerate(values[::-1]):
        axes[2].text(v + 3, i, str(v), va="center", fontsize=9)
    axes[2].set_xlim(0, max(values) * 1.14)
    fig.suptitle("Stylus Ecosystem Dashboard · 8 September 2026\n"
                 "Arbitrum One · activation-based observations, not a complete usage census",
                 fontsize=15, weight="bold")
    fig.savefig(output / "adoption.png", dpi=160, metadata={"Software": "Matplotlib"})
    fig.savefig(output / "adoption.svg", metadata={"Date": None})
    plt.close(fig)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("snapshot", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--figures", action="store_true", help="Requires matplotlib")
    args = parser.parse_args()
    raw = args.snapshot.read_bytes()
    snapshot = json.loads(raw)
    if not all(snapshot["checks"].values()):
        parser.error("Snapshot checks failed; investigate consistency before publishing metrics")
    metrics = analyze(snapshot)
    metrics["snapshotSha256"] = hashlib.sha256(raw).hexdigest()
    args.output.mkdir(parents=True, exist_ok=True)
    (args.output / "metrics.json").write_text(json.dumps(metrics, indent=2) + "\n")
    if args.figures:
        figures(snapshot, metrics, args.output)
    print(json.dumps({k: v for k, v in metrics.items() if k not in ["monthly", "top10Wallets"]}, indent=2))
