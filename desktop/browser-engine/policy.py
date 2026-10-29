"""Address and launch rules for the desktop browser.

This module has no database and no shell. A user string is classified, then
either refused or handed to Chromium as data. It is never a query.
"""

from __future__ import annotations

import ipaddress
import os
import re
import socket
import unicodedata
from pathlib import Path
from urllib.parse import urljoin, urlparse

BRIDGE_HOST = "127.0.0.1"
BRIDGE_PORT = 8791
DEBUG_PORT = 9223
PROFILE_DIR = "/tmp/asx-live-browser-profile"
MAX_URL_LENGTH = 2048
MAX_REQUEST_LINE = 8192

CHROME_CANDIDATES = (
    "/opt/brave.com/brave/brave",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
)

LOCAL_ORIGIN_HOSTS = frozenset({"127.0.0.1", "localhost"})
WEB_PORTS = frozenset({80, 443})
ADULT_TLDS = (".xxx", ".adult", ".sex", ".porn")
ADULT_CATEGORY = "category detection: adult website, blocked"
# Same brand marks the desktop page uses, so a disguised host matches too.
ADULT_TOKENS = (
    "pornhub",
    "xvideos",
    "xnxx",
    "xhamster",
    "redtube",
    "youporn",
    "onlyfans",
    "fansly",
    "chaturbate",
    "stripchat",
    "bongacams",
    "livejasmin",
    "camsoda",
    "myfreecams",
    "spankbang",
    "eporner",
    "hqporner",
    "motherless",
    "porntrex",
    "nhentai",
    "hanime",
    "rule34",
    "youjizz",
    "drtuber",
    "sunporno",
    "gotporn",
    "porn300",
    "hentaihaven",
    "exhentai",
    "e-hentai",
    "tnaflix",
)
_LOOKALIKES = {
    "\u0430": "a",
    "\u0435": "e",
    "\u043e": "o",
    "\u0440": "p",
    "\u0441": "c",
    "\u0443": "y",
    "\u0445": "x",
    "\u0456": "i",
    "\u04cf": "l",
    "\u0391": "a",
    "\u0395": "e",
    "\u039f": "o",
    "\u03bf": "o",
    "\u03b1": "a",
    "\u03b5": "e",
    "\u03c1": "p",
    "\u03c5": "y",
    "\u03c7": "x",
    "\u03b9": "i",
    "\u0420": "p",
    "\u0405": "s",
    "\u0410": "a",
    "\u0415": "e",
    "\u041e": "o",
    "\uff4f": "o",
    "\uff41": "a",
    "\uff45": "e",
    "\uff50": "p",
    "\uff52": "r",
    "\uff48": "h",
    "\uff55": "u",
    "\uff42": "b",
    "\uff4e": "n",
}
_ADULT_HOSTS: set[str] | None = None
BLOCKED_HOST_NAMES = frozenset(
    {
        "localhost",
        "localhost.localdomain",
        "metadata",
        "metadata.google",
        "metadata.google.internal",
        "kubernetes",
        "kubernetes.default",
        "kubernetes.default.svc",
    }
)
BLOCKED_SUFFIXES = (
    ".local",
    ".localhost",
    ".internal",
    ".home.arpa",
    ".localdomain",
)


class PolicyError(Exception):
    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


def is_public_ip(value: str) -> bool:
    try:
        addr = ipaddress.ip_address(str(value).split("%", 1)[0])
    except ValueError:
        return False
    mapped = getattr(addr, "ipv4_mapped", None)
    if mapped is not None:
        addr = mapped
    return bool(addr.is_global)


def origin_allowed(origin: object) -> bool:
    """True only for the desktop served on this computer."""
    if not isinstance(origin, str) or not origin or len(origin) > 200:
        return False
    if any(ch in origin for ch in ("\r", "\n", "\x00", " ", "\\")):
        return False
    try:
        parsed = urlparse(origin)
    except ValueError:
        return False
    if parsed.scheme != "http":
        return False
    if parsed.username or parsed.password or parsed.query or parsed.fragment:
        return False
    if parsed.path not in ("", "/"):
        return False
    host = parsed.hostname
    if host not in LOCAL_ORIGIN_HOSTS:
        return False
    rest = parsed.netloc[len(host) :]
    if rest == "":
        return True
    if not rest.startswith(":"):
        return False
    port_text = rest[1:]
    if not port_text.isdigit():
        return False
    port = int(port_text)
    return 1 <= port <= 65535


def web_port(port: int) -> bool:
    return port in WEB_PORTS


MAX_DOWNLOAD_BYTES = 8_000_000
_DOWNLOAD_EXT = {"pdf": "pdf", "jpeg": "jpg", "png": "png", "html": "html"}
_HTML_TYPES = frozenset({"text/html", "application/xhtml+xml"})
_REFUSED_MAGIC = (
    b"MZ",
    b"\x7fELF",
    b"PK\x03\x04",
    b"PK\x05\x06",
    b"Rar!",
    b"7z\xbc\xaf\x27\x1c",
    b"\x1f\x8b",
    b"\xcf\xfa\xed\xfe",
)


def classify_download(body: bytes, content_type: str = "") -> tuple[str, str]:
    """Name the saved file from its bytes. Programs and archives are refused."""
    if not isinstance(body, (bytes, bytearray)) or not body:
        raise PolicyError("empty file")
    if len(body) > MAX_DOWNLOAD_BYTES:
        raise PolicyError("file is too large")
    raw = bytes(body)
    if raw.startswith(b"%PDF"):
        return "pdf", "pdf"
    if raw.startswith(b"\xff\xd8\xff"):
        return "jpeg", "jpg"
    if raw.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png", "png"
    if raw.startswith(_REFUSED_MAGIC):
        raise PolicyError("that file type is refused")
    if _looks_like_html(raw, content_type):
        return "html", "html"
    raise PolicyError("only PDF, JPG, PNG, and HTML can be saved")


def _looks_like_html(body: bytes, content_type: str) -> bool:
    sample = body[:800]
    if b"\x00" in sample:
        return False
    header = (content_type or "").split(";", 1)[0].strip().lower()
    if header in _HTML_TYPES:
        return True
    if header not in ("", "text/plain", "application/octet-stream"):
        return False
    start = sample.lstrip(b"\xef\xbb\xbf \t\r\n").lower()
    return start.startswith((b"<!doctype", b"<html", b"<head", b"<body"))


def download_filename(url: str, extension: str) -> str:
    if extension not in _DOWNLOAD_EXT.values():
        raise PolicyError("only PDF, JPG, PNG, and HTML can be saved")
    path = urlparse(url).path or ""
    base = path.rsplit("/", 1)[-1]
    cleaned = []
    for ch in base:
        cleaned.append(ch if ch.isalnum() or ch in "._-" else "_")
    name = "".join(cleaned).strip("._")[:60]
    if not name:
        name = "download"
    stem = name.rsplit(".", 1)[0] if "." in name else name
    if not stem:
        stem = "download"
    return stem + "." + extension


def laptop_downloads_dir() -> Path:
    """The Downloads directory named for this laptop. Nowhere else."""
    home = Path.home().resolve()
    folder = home / "Downloads"
    config = home / ".config" / "user-dirs.dirs"
    try:
        text = config.read_text(encoding="utf-8", errors="replace")
    except OSError:
        text = ""
    for line in text.splitlines():
        if not line.startswith("XDG_DOWNLOAD_DIR="):
            continue
        raw = line.split("=", 1)[1].strip().strip("\"'")
        raw = raw.replace("${HOME}", str(home)).replace("$HOME", str(home))
        candidate = Path(raw)
        if candidate.is_absolute():
            folder = candidate
        break
    try:
        folder.mkdir(parents=False, exist_ok=True)
        resolved = folder.resolve(strict=True)
    except OSError as exc:
        raise PolicyError("downloads folder refused") from exc
    if resolved != home and home not in resolved.parents:
        raise PolicyError("downloads folder refused")
    if not resolved.is_dir():
        raise PolicyError("downloads folder refused")
    return resolved


def save_laptop_download(name: str, body: bytes, folder: Path | None = None) -> str:
    """Write one allowed file into Downloads. The name cannot be a path."""
    if not isinstance(name, str) or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]{0,79}", name):
        raise PolicyError("file name refused")
    if ".." in name or "/" in name or "\\" in name:
        raise PolicyError("file name refused")
    extension = name.rsplit(".", 1)[-1].lower() if "." in name else ""
    if extension not in _DOWNLOAD_EXT.values():
        raise PolicyError("only PDF, JPG, PNG, and HTML can be saved")
    if not isinstance(body, (bytes, bytearray)) or not body:
        raise PolicyError("empty file")
    if len(body) > MAX_DOWNLOAD_BYTES:
        raise PolicyError("file is too large")
    directory = laptop_downloads_dir() if folder is None else folder
    try:
        directory = directory.resolve(strict=True)
    except OSError as exc:
        raise PolicyError("downloads folder refused") from exc
    if not directory.is_dir():
        raise PolicyError("downloads folder refused")
    stem, dot, ext = name.rpartition(".")
    if not dot:
        stem, ext = name, ""
    payload = bytes(body)
    for number in range(1, 50):
        candidate = name if number == 1 else (
            f"{stem}-{number}.{ext}" if ext else f"{stem}-{number}"
        )
        if len(candidate) > 80 or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]{0,79}", candidate):
            break
        path = directory / candidate
        if path.parent != directory:
            raise PolicyError("file name refused")
        try:
            handle = os.open(
                path,
                os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_NOFOLLOW", 0),
                0o644,
            )
        except FileExistsError:
            continue
        except OSError as exc:
            raise PolicyError("could not save on this laptop") from exc
        view = memoryview(payload)
        offset = 0
        try:
            while offset < len(view):
                written = os.write(handle, view[offset:])
                if written <= 0:
                    raise OSError("short write")
                offset += written
        except OSError as exc:
            try:
                os.unlink(path)
            except OSError:
                pass
            raise PolicyError("could not save on this laptop") from exc
        finally:
            os.close(handle)
        return candidate
    raise PolicyError("could not save on this laptop")


def _fold_host(host: str) -> str:
    text = unicodedata.normalize("NFKC", host.lower())
    return "".join(_LOOKALIKES.get(ch, ch) for ch in text)


def _load_adult_hosts() -> set[str]:
    """Domains shipped with the desktop. Missing files leave the brand marks in force."""
    global _ADULT_HOSTS
    if _ADULT_HOSTS is not None:
        return _ADULT_HOSTS
    hosts: set[str] = set()
    folder = Path(__file__).resolve().parents[1] / "safety" / "hosts"
    if folder.is_dir():
        for path in sorted(folder.glob("adult-*.txt")):
            try:
                text = path.read_text(encoding="utf-8", errors="replace")
            except OSError:
                continue
            for line in text.splitlines():
                domain = line.strip().lower()
                if not domain or domain.startswith("#") or " " in domain:
                    continue
                if domain.startswith("www."):
                    domain = domain[4:]
                if "." in domain:
                    hosts.add(domain)
    _ADULT_HOSTS = hosts
    return hosts


def educational_site(host: str) -> bool:
    """Wikipedia stays open for neutral educational reading. A lookalike does not."""
    name = (host or "").lower().rstrip(".")
    if name.startswith("www."):
        name = name[4:]
    return name == "wikipedia.org" or name.endswith(".wikipedia.org")


def adult_blocked(host: str) -> str:
    """Adult websites are refused. The desktop is not for that use."""
    if educational_site(host):
        return ""
    name = _fold_host(host).rstrip(".")
    if name.startswith("www."):
        name = name[4:]
    if not name:
        return ""
    for token in ADULT_TOKENS:
        if token in name:
            return ADULT_CATEGORY
    hosts = _load_adult_hosts()
    rest = name
    while rest:
        if rest in hosts or rest.endswith(ADULT_TLDS):
            return ADULT_CATEGORY
        dot = rest.find(".")
        if dot == -1:
            break
        rest = rest[dot + 1 :]
    return ""


def _host_name_blocked(host: str) -> str:
    name = host.lower().rstrip(".")
    if name in BLOCKED_HOST_NAMES:
        return "private host blocked"
    for suffix in BLOCKED_SUFFIXES:
        if name.endswith(suffix):
            return "private host blocked"
    if name.endswith(".local."):
        return "private host blocked"
    return ""


def classify_url(raw: object) -> tuple[bool, str, str]:
    """Accept an http(s) URL shape. Private addresses are checked later."""
    if not isinstance(raw, str):
        return False, "address must be text", ""
    if len(raw) > MAX_URL_LENGTH:
        return False, "address is too long", ""
    if any(ch in raw for ch in ("\r", "\n", "\x00", "\t")):
        return False, "address contains a control character", ""
    text = raw.strip()
    if not text or any(ch.isspace() for ch in text):
        return False, "address contains a space", ""
    lower = text.lower()
    if "://" not in text:
        if lower.startswith("http:") or lower.startswith("https:"):
            return False, "only http and https addresses are allowed", ""
        text = "https://" + text
        lower = text.lower()
    if not (lower.startswith("https://") or lower.startswith("http://")):
        return False, "only http and https addresses are allowed", ""
    try:
        parsed = urlparse(text)
    except ValueError:
        return False, "address could not be read", ""
    if parsed.scheme not in ("http", "https"):
        return False, "only http and https addresses are allowed", ""
    if parsed.username or parsed.password:
        return False, "addresses with a username are blocked", ""
    host = parsed.hostname
    if not host:
        return False, "address has no host", ""
    blocked = _host_name_blocked(host)
    if blocked:
        return False, blocked, ""
    try:
        if not is_public_ip(host):
            # A literal that parses as an IP and is not public is refused here.
            ipaddress.ip_address(host)
            return False, "private address blocked", ""
    except ValueError:
        pass
    try:
        port = parsed.port
    except ValueError:
        return False, "address has a bad port", ""
    if port is not None and not web_port(port):
        return False, "only web ports are allowed", ""
    blocked = adult_blocked(host)
    if blocked:
        return False, blocked, ""
    return True, "", text


def split_host_port(target: str, default_port: int) -> tuple[str, int]:
    if target.startswith("["):
        host, sep, rest = target[1:].partition("]")
        if not sep:
            raise PolicyError("bad address")
        if rest == "":
            return host, default_port
        if not rest.startswith(":"):
            raise PolicyError("bad address")
        return host, int(rest[1:])
    if target.count(":") == 1:
        host, port_text = target.split(":")
        return host, int(port_text)
    if ":" in target:
        raise PolicyError("bad address")
    return target, default_port


def resolve_public(host: str, port: int) -> list[tuple[int, tuple]]:
    """Resolve a host and refuse it when any answer is not a public address."""
    if not host or len(host) > 253:
        raise PolicyError("bad host")
    blocked = _host_name_blocked(host)
    if blocked:
        raise PolicyError(blocked)
    try:
        literal = ipaddress.ip_address(host)
    except ValueError:
        literal = None
    if literal is not None:
        if not is_public_ip(host):
            raise PolicyError("private address blocked")
        family = socket.AF_INET if literal.version == 4 else socket.AF_INET6
        return [(family, (str(literal), port))]
    try:
        infos = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
    except socket.gaierror as exc:
        raise PolicyError("address did not resolve") from exc
    if not infos:
        raise PolicyError("address did not resolve")
    chosen: list[tuple[int, tuple]] = []
    for family, _socktype, _proto, _canon, sockaddr in infos:
        ip_text = str(sockaddr[0]).split("%", 1)[0]
        if not is_public_ip(ip_text):
            raise PolicyError("private address blocked")
        chosen.append((family, sockaddr))
    return chosen


def decide_proxy_request(line: object) -> tuple[bool, str]:
    """Decide a proxy request line without connecting and without a database."""
    if not isinstance(line, str):
        return False, "bad request"
    if len(line) > MAX_REQUEST_LINE:
        return False, "request too long"
    if any(ch in line for ch in ("\r", "\n", "\x00")):
        return False, "bad request"
    parts = line.split(" ")
    if len(parts) != 3:
        return False, "bad request"
    method, target, version = parts
    if version not in ("HTTP/1.0", "HTTP/1.1"):
        return False, "bad request"
    try:
        if method == "CONNECT":
            host, port = split_host_port(target, 443)
            if not web_port(port):
                return False, "only web ports are allowed"
            blocked = adult_blocked(host)
            if blocked:
                return False, blocked
            resolve_public(host, port)
            return True, ""
        if method in ("GET", "HEAD", "POST"):
            ok, reason, url = classify_url(target)
            if not ok:
                return False, reason
            parsed = urlparse(url)
            port = parsed.port or (443 if parsed.scheme == "https" else 80)
            resolve_public(parsed.hostname or "", port)
            return True, ""
    except (PolicyError, ValueError) as exc:
        reason = exc.reason if isinstance(exc, PolicyError) else "bad address"
        return False, reason
    return False, "method blocked"


def chrome_binary() -> str:
    for path in CHROME_CANDIDATES:
        if os.path.isfile(path) and os.access(path, os.X_OK):
            return path
    raise PolicyError("no Chromium binary on this computer")


def chrome_launch_args(
    proxy: str,
    user_data_dir: str,
    debug_port: int,
    headed: bool = True,
) -> list[str]:
    """Launch the installed Chromium.

    Headed is the real browser: its own window on a display, the same shape as
    `chrome --remote-debugging-port` in the Chromium docs. Headless is only the
    fallback when this computer cannot open a display.
    """
    if user_data_dir != PROFILE_DIR:
        raise PolicyError("browser profile path refused")
    if not proxy.startswith("http://127.0.0.1:"):
        raise PolicyError("proxy must stay on this computer")
    if not (1 <= debug_port <= 65535):
        raise PolicyError("bad debugging port")
    args = [
        chrome_binary(),
        "--remote-debugging-address=127.0.0.1",
        f"--remote-debugging-port={debug_port}",
        f"--user-data-dir={user_data_dir}",
        f"--proxy-server={proxy}",
        "--proxy-bypass-list=<-loopback>",
        "--force-webrtc-ip-handling-policy=disable_non_proxied_udp",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-sync",
        "--disable-extensions",
        "--disable-component-update",
        "--disable-background-networking",
        "--disable-default-apps",
        "--disable-features=Translate,OptimizationHints,NetworkPrediction,DnsOverHttps",
        "--no-pings",
        "--password-store=basic",
        "--window-size=1280,800",
        "--class=asx-web-observer",
    ]
    if headed:
        # The window is on a private framebuffer, which has no GPU.
        args.insert(1, "--ozone-platform=x11")
        args.insert(2, "--disable-gpu")
    else:
        args.insert(1, "--headless=new")
    args.append("about:blank")
    return args


def cdp_navigate(url: str) -> dict:
    ok, reason, clean = classify_url(url)
    if not ok:
        raise PolicyError(reason)
    return {"method": "Page.navigate", "params": {"url": clean}}


_SITE_ALIASES = {"wikipedia.com": "wikipedia.org"}


def _lock_host(host: str) -> str:
    name = _fold_host(host).rstrip(".")
    if name.startswith("www.") and name.count(".") >= 2:
        name = name[4:]
    return _SITE_ALIASES.get(name, name)


def sandbox_site(raw: str) -> tuple[str, str]:
    """The website a sandbox is locked to, and the first address it may open."""
    ok, reason, clean = classify_url(raw)
    if not ok:
        raise PolicyError(reason or "address refused")
    parsed = urlparse(clean)
    host = (parsed.hostname or "").lower().rstrip(".")
    lock = _lock_host(host)
    if "." not in lock or len(lock) > 253:
        raise PolicyError("that website cannot be sandboxed")
    port = parsed.port or (443 if parsed.scheme == "https" else 80)
    resolve_public(host, port)
    if lock == "wikipedia.org" and host in ("wikipedia.com", "www.wikipedia.com"):
        clean = "https://www.wikipedia.org/"
    return lock, clean


MAX_FAVICON_BYTES = 262_144
_LINK_TAG = re.compile(r"<link\b[^>]*>", re.IGNORECASE)
_TAG_ATTR = re.compile(
    r"""([A-Za-z_:][-A-Za-z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))"""
)


def favicon_mime(body: bytes) -> str:
    """A sandbox icon is a picture. Pages, programs, and other files are refused."""
    if not isinstance(body, (bytes, bytearray)) or not body:
        raise PolicyError("website has no icon")
    raw = bytes(body)
    if len(raw) > MAX_FAVICON_BYTES:
        raise PolicyError("website icon is too large")
    if raw.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if raw.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if raw.startswith((b"GIF87a", b"GIF89a")):
        return "image/gif"
    if len(raw) >= 12 and raw[:4] == b"RIFF" and raw[8:12] == b"WEBP":
        return "image/webp"
    if raw.startswith((b"\x00\x00\x01\x00", b"\x00\x00\x02\x00")):
        return "image/x-icon"
    raise PolicyError("website icon is not a picture")


def _tag_attr(tag: str, name: str) -> str:
    wanted = name.lower()
    for match in _TAG_ATTR.finditer(tag):
        if match.group(1).lower() != wanted:
            continue
        return next(part for part in match.groups()[1:] if part is not None).strip()
    return ""


def _icon_wanted(rel: str, href: str, mime_hint: str) -> bool:
    folded = rel.lower()
    if not href or "mask-icon" in folded or "apple-touch-icon" in folded:
        return False
    if "icon" not in folded:
        return False
    path = href.lower().split("?", 1)[0]
    if "svg" in mime_hint.lower() or path.endswith(".svg"):
        return False
    return True


def icon_addresses(page_url: str, html: str) -> list[str]:
    """Icon addresses named by one page, then that site's own /favicon.ico.

    Same-site pictures come first. An address the page policy already refuses
    is left out. This does not look up DNS.
    """
    ok, _reason, clean = classify_url(page_url)
    if not ok:
        return []
    parsed = urlparse(clean)
    host = (parsed.hostname or "").lower().rstrip(".")
    lock = _lock_host(host)
    if "." not in lock:
        return []
    ranked: list[tuple[tuple[int, int, int], str]] = []
    text = html if isinstance(html, str) else ""
    for tag in _LINK_TAG.findall(text[:300_000]):
        rel = _tag_attr(tag, "rel")
        href = _tag_attr(tag, "href")
        if not _icon_wanted(rel, href, _tag_attr(tag, "type")):
            continue
        good, _why, icon = classify_url(urljoin(clean, href.strip()))
        if not good:
            continue
        icon_host = _fold_host(urlparse(icon).hostname or "").rstrip(".")
        same = icon_host == lock or icon_host.endswith("." + lock)
        path = icon.lower().split("?", 1)[0]
        raster = path.endswith((".png", ".webp", ".gif", ".jpg", ".jpeg"))
        size_match = re.search(r"(\d+)\s*x\s*(\d+)", _tag_attr(tag, "sizes"))
        size = int(size_match.group(1)) if size_match else 48
        ranked.append(((0 if same else 1, 0 if raster else 1, abs(size - 32)), icon))
        if len(ranked) >= 8:
            break
    ranked.sort(key=lambda item: item[0])
    ordered: list[str] = []
    seen: set[str] = set()
    for _rank, icon in ranked:
        if icon in seen:
            continue
        seen.add(icon)
        ordered.append(icon)
    home_ok, _why, home_icon = classify_url(f"{parsed.scheme}://{parsed.netloc}/favicon.ico")
    if home_ok and home_icon not in seen:
        insert_at = len(ordered)
        for index, icon in enumerate(ordered):
            icon_host = _fold_host(urlparse(icon).hostname or "").rstrip(".")
            if icon_host != lock and not icon_host.endswith("." + lock):
                insert_at = index
                break
        ordered.insert(insert_at, home_icon)
    return ordered[:6]


def sandbox_navigation(lock: str, raw: str) -> tuple[bool, str, str]:
    """A sandbox may open its own site. It may not wander off."""
    site = _lock_host(lock)
    if not site or "." not in site or len(site) > 253:
        return False, "that website cannot be sandboxed", ""
    if isinstance(raw, str) and raw.strip() in ("about:blank", "about:srcdoc"):
        return True, "", raw.strip()
    ok, reason, clean = classify_url(raw)
    if not ok:
        return False, reason or "address refused", ""
    host = _fold_host(urlparse(clean).hostname or "").rstrip(".")
    if host == site or host.endswith("." + site):
        return True, "", clean
    return False, "this sandbox stays on " + site, ""
