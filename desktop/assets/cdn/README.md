# /assets/cdn — intentionally empty of vendor files

**Policy:** Do **not** store three.js, D3, textures, or other public vendor blobs here.

Those load from **cdnjs / jsDelivr / unpkg / threejs.org** only.  
See `docs/RESOURCE_CDN_POLICY.md`.

This directory remains so old deploys or docs that mentioned `/assets/cdn/` do not confuse operators. If you find binaries here, **delete them** — they violate the offload rule.
