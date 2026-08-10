#!/usr/bin/env python3
"""Refresh website/desktop-os/safety/hosts from StevenBlack/hosts porn extensions.

Why not only hot-link raw GitHub at runtime?
  - Full hosts files are multi-MB; guest desktop should not download that every visit.
  - Same-origin shards in *our* public repo = audit trail + CDN cache + offline-ish GH Pages.

Usage (operator machine with network):
  python3 website/desktop-os/tools/refresh_safety_hosts.py
"""
from __future__ import annotations

import json
import re
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "safety" / "hosts"
SHARD = 8000
SOURCES = [
    "extensions/porn/sinfonietta/hosts",
    "extensions/porn/sinfonietta-snuff/hosts",
    "extensions/porn/tiuxo/hosts",
    "extensions/porn/clefspeare13/hosts",
    "extensions/porn/bigdargon/hosts",
    "extensions/porn/brijrajparmar27/hosts",
]
BASE = "https://raw.githubusercontent.com/StevenBlack/hosts/master/"
PAT = re.compile(r"^(?:0\.0\.0\.0|127\.0\.0\.1)\s+(\S+)", re.I)


def main() -> None:
    domains: set[str] = set()
    for rel in SOURCES:
        url = BASE + rel
        print("fetch", url)
        try:
            with urllib.request.urlopen(url, timeout=120) as r:
                text = r.read().decode("utf-8", errors="ignore")
        except Exception as e:
            print("  skip", e)
            continue
        for line in text.splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            m = PAT.match(line)
            if not m:
                continue
            host = m.group(1).lower().strip(".")
            if host.startswith("www."):
                host = host[4:]
            if host in ("localhost", "0.0.0.0") or "." not in host:
                continue
            domains.add(host)

    ordered = sorted(domains)
    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob("adult-*.txt"):
        old.unlink()
    parts: list[str] = []
    for i in range(0, len(ordered), SHARD):
        chunk = ordered[i : i + SHARD]
        name = f"adult-{(i // SHARD) + 1:02d}.txt"
        (OUT / name).write_text("\n".join(chunk) + "\n", encoding="utf-8")
        parts.append(name)
        print(name, len(chunk))

    man = {
        "source": "StevenBlack/hosts extensions/porn/* (MIT)",
        "source_url": "https://github.com/StevenBlack/hosts",
        "license": "MIT (upstream)",
        "format": "one bare domain per line, no www., no IP",
        "count": len(ordered),
        "parts": parts,
        "fetched": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "note": "Runtime loader uses same-origin safety/hosts; optional raw GH is for this refresh script only.",
    }
    (OUT / "manifest.json").write_text(json.dumps(man, indent=2) + "\n", encoding="utf-8")
    print("wrote", len(ordered), "domains →", OUT)


if __name__ == "__main__":
    main()
