#!/usr/bin/env python3
"""
Upsert Cloudflare Cache Rules for ASX public static assets on alisonscorpion.com.

Covers:
  /safety/*          — blocklist shards (1d)
  /assets/*          — SPA/build assets, icons (7d) — excludes /assets/backups/*
  /brand/, /fonts/   — brand art, fonts (7d)
  /css/, /js/        — desktop shell CSS/JS (1d; cache-busted with ?v=)
  /desktop/css|js    — mirror paths (1d)
  favicons / scorpion-icon-512.png (7d)

Uses Rulesets API phase http_request_cache_settings.
Preserves non-ASX rules; upserts by description prefix "ASX cache:".

Env:
  CLOUDFLARE_API_TOKEN  (required) — Zone → Cache Rules → Edit
  CF_ZONE_ID            (optional)
"""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request

ZONE_ID = os.environ.get("CF_ZONE_ID", "fdfc2f6f3598393dc37bd9a4bed467b6")
API = "https://api.cloudflare.com/client/v4"
HOSTS = 'http.host in {"alisonscorpion.com" "www.alisonscorpion.com"}'
ASX_PREFIX = "ASX cache:"


def rule(desc: str, path_expr: str, edge: int, browser: int) -> dict:
    return {
        "description": f"{ASX_PREFIX} {desc}",
        "expression": f"({HOSTS}) and ({path_expr})",
        "action": "set_cache_settings",
        "enabled": True,
        "action_parameters": {
            "cache": True,
            "edge_ttl": {"mode": "override_origin", "default": edge},
            "browser_ttl": {"mode": "override_origin", "default": browser},
        },
    }


# Order: more specific first is fine; all are independent expressions
DESIRED_RULES = [
    rule(
        "safety hosts shards",
        'starts_with(http.request.uri.path, "/safety/")',
        edge=86400,
        browser=86400,
    ),
    rule(
        "hashed /assets + /assets/cdn vendor mirror (excl backups Worker)",
        'starts_with(http.request.uri.path, "/assets/") '
        'and not starts_with(http.request.uri.path, "/assets/backups/")',
        edge=604800,  # 7d — three/d3/planets textures live under /assets/cdn/
        browser=604800,
    ),
    rule(
        "brand fonts icons root",
        'starts_with(http.request.uri.path, "/brand/") '
        'or starts_with(http.request.uri.path, "/fonts/") '
        'or starts_with(http.request.uri.path, "/website/staging/brand/") '
        'or http.request.uri.path eq "/favicon.ico" '
        'or starts_with(http.request.uri.path, "/favicon-") '
        'or http.request.uri.path eq "/apple-touch-icon.png" '
        'or http.request.uri.path eq "/scorpion-icon-512.png"',
        edge=604800,
        browser=604800,
    ),
    rule(
        "desktop css js",
        'starts_with(http.request.uri.path, "/css/") '
        'or starts_with(http.request.uri.path, "/js/") '
        'or starts_with(http.request.uri.path, "/desktop/css/") '
        'or starts_with(http.request.uri.path, "/desktop/js/") '
        'or starts_with(http.request.uri.path, "/website/desktop-os/css/") '
        'or starts_with(http.request.uri.path, "/website/desktop-os/js/")',
        edge=86400,
        browser=86400,
    ),
]


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


def clean_rule(r: dict) -> dict:
    return {
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


def main() -> None:
    ep = api(
        "GET",
        f"/zones/{ZONE_ID}/rulesets/phases/http_request_cache_settings/entrypoint",
    )

    if not ep.get("success"):
        print("entrypoint missing; creating zone ruleset with ASX rules…")
        created = api(
            "POST",
            f"/zones/{ZONE_ID}/rulesets",
            {
                "name": "default",
                "kind": "zone",
                "phase": "http_request_cache_settings",
                "rules": DESIRED_RULES,
            },
        )
        print("OK: created", created.get("success"))
        return

    result = ep["result"]
    ruleset_id = result["id"]
    existing = list(result.get("rules") or [])

    # Map ASX rules by description
    desired_by_desc = {r["description"]: r for r in DESIRED_RULES}
    out: list[dict] = []
    seen = set()

    for r in existing:
        desc = r.get("description") or ""
        # Drop legacy single safety rule if present (replaced by ASX cache: prefix)
        if desc == "ASX: cache safety hosts lists (public blocklist shards)":
            continue
        if desc in desired_by_desc:
            merged = clean_rule(r)
            merged.update(desired_by_desc[desc])
            if "id" in r:
                merged["id"] = r["id"]
            out.append(merged)
            seen.add(desc)
        else:
            # Keep foreign rules untouched
            out.append(clean_rule(r))

    for desc, rule_body in desired_by_desc.items():
        if desc not in seen:
            out.append(rule_body)

    updated = api(
        "PUT",
        f"/zones/{ZONE_ID}/rulesets/{ruleset_id}",
        {"rules": out},
    )
    if not updated.get("success"):
        print(json.dumps(updated, indent=2), file=sys.stderr)
        sys.exit(1)

    descs = [r.get("description") for r in updated["result"].get("rules") or []]
    print("OK: cache ruleset updated")
    print("zone:", ZONE_ID)
    print("ruleset:", ruleset_id)
    print("rule count:", len(descs))
    for d in descs:
        mark = " [ASX]" if d and d.startswith(ASX_PREFIX) else ""
        print(f" -{mark}", d)


if __name__ == "__main__":
    main()
