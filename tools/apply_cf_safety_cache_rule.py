#!/usr/bin/env python3
"""
Apply Cloudflare Cache Rule for /safety/* on alisonscorpion.com.

Uses Rulesets API phase http_request_cache_settings.
Preserves existing rules; upserts ASX safety hosts rule by description match.

Env:
  CLOUDFLARE_API_TOKEN  (required) — Zone Cache Rules Edit
  CF_ZONE_ID            (optional) — default alisonscorpion.com zone from workers config
"""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request

ZONE_ID = os.environ.get("CF_ZONE_ID", "fdfc2f6f3598393dc37bd9a4bed467b6")
API = "https://api.cloudflare.com/client/v4"
RULE_DESC = "ASX: cache safety hosts lists (public blocklist shards)"
# Match apex + www, safety path only
EXPRESSION = (
    '(http.host in {"alisonscorpion.com" "www.alisonscorpion.com"}) '
    'and starts_with(http.request.uri.path, "/safety/")'
)

# Edge 1 day; browser 1 day; respect origin Cache-Control when present but force cache eligibility
NEW_RULE = {
    "description": RULE_DESC,
    "expression": EXPRESSION,
    "action": "set_cache_settings",
    "enabled": True,
    "action_parameters": {
        "cache": True,
        "edge_ttl": {
            "mode": "override_origin",
            "default": 86400,
        },
        "browser_ttl": {
            "mode": "override_origin",
            "default": 86400,
        },
    },
}


def api(method: str, path: str, body: dict | None = None) -> dict:
    token = os.environ.get("CLOUDFLARE_API_TOKEN") or os.environ.get("CF_API_TOKEN")
    if not token:
        print("ERROR: set CLOUDFLARE_API_TOKEN", file=sys.stderr)
        sys.exit(2)
    data = None if body is None else json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        f"{API}{path}",
        data=data,
        method=method,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        err = e.read().decode()
        print(f"HTTP {e.code} {path}\n{err}", file=sys.stderr)
        sys.exit(1)


def main() -> None:
    # GET phase entrypoint
    ep = api(
        "GET",
        f"/zones/{ZONE_ID}/rulesets/phases/http_request_cache_settings/entrypoint",
    )
    if not ep.get("success"):
        # Create empty phase ruleset then re-get
        print("entrypoint missing or failed; creating zone ruleset…")
        created = api(
            "POST",
            f"/zones/{ZONE_ID}/rulesets",
            {
                "name": "default",
                "kind": "zone",
                "phase": "http_request_cache_settings",
                "rules": [NEW_RULE],
            },
        )
        print(json.dumps(created.get("result", created), indent=2)[:2000])
        print("OK: created cache phase with safety rule")
        return

    result = ep["result"]
    ruleset_id = result["id"]
    rules = list(result.get("rules") or [])

    # Upsert by description
    found = False
    out_rules = []
    for r in rules:
        # Strip read-only fields for PUT
        clean = {
            k: r[k]
            for k in (
                "id",
                "ref",
                "expression",
                "description",
                "action",
                "action_parameters",
                "enabled",
            )
            if k in r
        }
        if r.get("description") == RULE_DESC:
            clean.update(NEW_RULE)
            # keep id for stable update
            if "id" in r:
                clean["id"] = r["id"]
            found = True
            out_rules.append(clean)
        else:
            out_rules.append(clean)

    if not found:
        out_rules.append(NEW_RULE)

    updated = api(
        "PUT",
        f"/zones/{ZONE_ID}/rulesets/{ruleset_id}",
        {"rules": out_rules},
    )
    if not updated.get("success"):
        print(json.dumps(updated, indent=2), file=sys.stderr)
        sys.exit(1)

    descs = [r.get("description") for r in updated["result"].get("rules") or []]
    print("OK: cache ruleset updated")
    print("zone:", ZONE_ID)
    print("ruleset:", ruleset_id)
    print("rule count:", len(descs))
    print("has ASX safety rule:", RULE_DESC in descs)
    for d in descs:
        print(" -", d)


if __name__ == "__main__":
    main()
