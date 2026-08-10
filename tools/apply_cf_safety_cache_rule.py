#!/usr/bin/env python3
"""Backward-compatible entry → apply_cf_static_cache_rules.py """
from pathlib import Path
import runpy

runpy.run_path(
    str(Path(__file__).with_name("apply_cf_static_cache_rules.py")),
    run_name="__main__",
)
