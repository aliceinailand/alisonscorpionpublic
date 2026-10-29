"""Policy tests for the desktop browser. No Chromium and no database."""

from __future__ import annotations

import json
from pathlib import Path

import policy

ROOT = Path(__file__).resolve().parent
PAYLOAD = "' OR '1'='1'; DROP TABLE users;--"


def test_private_addresses() -> None:
    blocked = [
        "http://127.0.0.1/",
        "http://127.0.0.1:18080/v1",
        "http://localhost/",
        "http://localhost:8000/",
        "http://[::1]/",
        "http://169.254.169.254/latest/meta-data",
        "http://192.168.1.1/",
        "http://10.0.0.1/",
        "http://172.16.0.1/",
        "http://0.0.0.0/",
        "http://metadata.google.internal/",
        "file:///etc/passwd",
        "javascript:alert(1)",
        "data:text/html,hi",
        "chrome://settings",
        PAYLOAD,
        "https://user:pass@example.com/",
        "http://printer.local/",
        "http://files.localhost/",
    ]
    for raw in blocked:
        ok, reason, _url = policy.classify_url(raw)
        assert ok is False, raw
        assert reason
    for raw in (
        "https://example.com",
        "example.com",
        "http://1.1.1.1/",
        "https://8.8.8.8/path",
    ):
        ok, reason, url = policy.classify_url(raw)
        assert ok is True, (raw, reason)
        assert url.startswith("http")


def test_ip_policy() -> None:
    assert policy.is_public_ip("1.1.1.1")
    assert policy.is_public_ip("8.8.8.8")
    for raw in (
        "127.0.0.1",
        "10.1.2.3",
        "192.168.0.5",
        "172.16.5.5",
        "169.254.169.254",
        "0.0.0.0",
        "255.255.255.255",
        "100.64.0.1",
        "::1",
        "::ffff:127.0.0.1",
    ):
        assert policy.is_public_ip(raw) is False, raw


def test_dotted_trap_host_does_not_open() -> None:
    ok, reason = policy.decide_proxy_request(
        "CONNECT 127.0.0.1.attacker.example:443 HTTP/1.1"
    )
    assert ok is False
    assert reason


def test_decimal_loopback_is_not_public() -> None:
    ok, reason = policy.decide_proxy_request("CONNECT 2130706433:80 HTTP/1.1")
    assert ok is False
    assert reason


def test_proxy_refuses_private_and_sql() -> None:
    samples = [
        "CONNECT 127.0.0.1:18080 HTTP/1.1",
        "CONNECT 169.254.169.254:80 HTTP/1.1",
        "CONNECT localhost:5432 HTTP/1.1",
        "GET http://127.0.0.1:18080/v1?q=' OR 1=1 HTTP/1.1",
        "CONNECT example.com:443' OR 1=1 HTTP/1.1",
        "POST " + PAYLOAD + " HTTP/1.1",
        "TRACE http://example.com/ HTTP/1.1",
    ]
    for line in samples:
        ok, reason = policy.decide_proxy_request(line)
        assert ok is False, line
        assert reason
    ok, reason = policy.decide_proxy_request("CONNECT example.com:443 HTTP/1.1")
    assert ok is True, reason


def test_origins() -> None:
    assert policy.origin_allowed("http://127.0.0.1:8766")
    assert policy.origin_allowed("http://localhost:8766")
    assert policy.origin_allowed("http://127.0.0.1:4321")
    for origin in (
        "",
        None,
        "https://alisonscorpion.com",
        "https://evil.example",
        "http://evil.com",
        "http://127.0.0.1.evil.com",
        "http://127.0.0.1.evil.com:8766",
        "http://user@127.0.0.1:8766",
        "http://127.0.0.1:8766/extra",
        "http://8.8.8.8:8766",
    ):
        assert policy.origin_allowed(origin) is False, origin


def test_sql_payload_is_data_not_a_query() -> None:
    ok, _reason, _url = policy.classify_url(PAYLOAD)
    assert ok is False
    args = policy.chrome_launch_args(
        "http://127.0.0.1:9",
        policy.PROFILE_DIR,
        policy.DEBUG_PORT,
    )
    assert isinstance(args, list)
    assert all(isinstance(part, str) for part in args)
    blob = "\n".join(args)
    assert PAYLOAD not in blob
    assert "DROP TABLE" not in blob
    assert "BraveSoftware" not in blob
    assert policy.PROFILE_DIR in blob
    assert args[-1] == "about:blank"
    assert "--remote-debugging-address=127.0.0.1" in args
    assert "--headless" not in " ".join(args)
    assert "--ozone-platform=x11" in args
    assert "--disable-gpu" in args
    headless = policy.chrome_launch_args(
        "http://127.0.0.1:9",
        policy.PROFILE_DIR,
        policy.DEBUG_PORT,
        headed=False,
    )
    assert "--headless=new" in headless
    assert "--ozone-platform=x11" not in headless
    assert "--disable-gpu" not in headless
    message = policy.cdp_navigate("https://example.com/?q=" + PAYLOAD.replace(" ", "%20"))
    raw = json.dumps(message)
    again = json.loads(raw)
    assert again["params"]["url"] == message["params"]["url"]
    assert "DROP%20TABLE" in again["params"]["url"]
    assert again["method"] == "Page.navigate"


def test_adult_sites_and_odd_ports_are_refused() -> None:
    allowed = (
        "https://github.com/aliceinailand/alisonscorpionpublic",
        "https://github.com",
        "https://example.com",
        "https://www.youtube.com/watch?v=eRsGyueVLvQ",
        "https://alisonscorpion.com",
        "https://trippyalice.com",
        "https://example.com:443/",
        "http://example.com:80/",
    )
    for raw in allowed:
        ok, reason, _url = policy.classify_url(raw)
        assert ok is True, (raw, reason)
    refused = (
        "https://pornhub.com/",
        "https://www.pornhub.com/view",
        "https://example.xxx/",
        "https://example.porn/",
        "https://0.xxx-cdn.com/",
        "https://example.com:22/",
        "https://example.com:8443/",
        "http://1.1.1.1:8080/",
    )
    for raw in refused:
        ok, reason, _url = policy.classify_url(raw)
        assert ok is False, raw
        assert reason
    ok, reason = policy.decide_proxy_request("CONNECT example.com:22 HTTP/1.1")
    assert ok is False
    assert reason
    ok, reason = policy.decide_proxy_request("CONNECT pornhub.com:443 HTTP/1.1")
    assert ok is False
    assert reason == "category detection: adult website, blocked"
    ok, reason, _url = policy.classify_url("https://www.pornhub.com/view")
    assert ok is False
    assert reason == "category detection: adult website, blocked"
    for raw in (
        "https://en.wikipedia.org/wiki/Pornography",
        "https://en.wikipedia.org/wiki/Sexual_intercourse",
        "https://www.wikipedia.org/wiki/Human_sexuality",
        "https://wikipedia.org/",
    ):
        ok, reason, _url = policy.classify_url(raw)
        assert ok is True and reason == "", (raw, reason)
    assert policy.adult_blocked("en.wikipedia.org") == ""
    assert policy.adult_blocked("www.wikipedia.org") == ""
    assert policy.adult_blocked("en.wikipedia.org.pornhub.com") == "category detection: adult website, blocked"
    assert policy.adult_blocked("wikipedia.org.porn") == "category detection: adult website, blocked"
    ok, reason, _url = policy.classify_url("https://notwikipedia.org/wiki/Pornography")
    assert ok is True and reason == ""
    assert policy._load_adult_hosts()


def test_download_keeps_pages_and_pictures_only() -> None:
    kind, ext = policy.classify_download(b"%PDF-1.4\n1 0 obj\n")
    assert (kind, ext) == ("pdf", "pdf")
    kind, ext = policy.classify_download(b"\xff\xd8\xff\xe0picture")
    assert (kind, ext) == ("jpeg", "jpg")
    kind, ext = policy.classify_download(b"\x89PNG\r\n\x1a\npicture")
    assert (kind, ext) == ("png", "png")
    page = b"<!DOCTYPE html><html><body>hello</body></html>"
    kind, ext = policy.classify_download(page, "text/html; charset=utf-8")
    assert (kind, ext) == ("html", "html")
    kind, ext = policy.classify_download(page, "text/plain")
    assert kind == "html"
    name = policy.download_filename("https://example.com/files/My Report.PDF", "pdf")
    assert name == "My_Report.pdf"
    assert "/" not in name
    name = policy.download_filename("https://example.com/", "html")
    assert name == "download.html"
    name = policy.download_filename("https://example.com/../../etc/passwd", "html")
    assert "/" not in name and name.endswith(".html")
    for raw in (b"MZ\x90\x00program", b"\x7fELF", b"PK\x03\x04zip", b"", b"just words"):
        try:
            policy.classify_download(raw, "application/octet-stream")
        except policy.PolicyError:
            continue
        raise AssertionError(raw)


def test_sandbox_stays_on_its_site() -> None:
    ok, reason, url = policy.sandbox_navigation("github.com", "https://github.com/search?q=asx")
    assert ok and url.startswith("https://github.com/"), reason
    ok, reason, url = policy.sandbox_navigation("github.com", "https://docs.github.com/en")
    assert ok, reason
    ok, reason, _url = policy.sandbox_navigation("github.com", "https://example.com/")
    assert ok is False
    assert "github.com" in reason
    ok, reason, _url = policy.sandbox_navigation("github.com", "https://notgithub.com/")
    assert ok is False
    ok, reason, _url = policy.sandbox_navigation("github.com", "http://127.0.0.1/")
    assert ok is False
    lock, start = policy.sandbox_site("https://github.com/aliceinailand/alisonscorpionpublic")
    assert lock == "github.com"
    assert start.startswith("https://github.com/")
    lock, start = policy.sandbox_site("wikipedia.com")
    assert lock == "wikipedia.org"
    assert start.startswith("https://www.wikipedia.org/")
    lock, _start = policy.sandbox_site("https://en.wikipedia.org/wiki/Cat")
    assert lock == "en.wikipedia.org"
    ok, reason, url = policy.sandbox_navigation(
        "youtube.com", "https://www.youtube.com/results?search_query=asx"
    )
    assert ok and "youtube.com" in url, reason
    ok, reason, _url = policy.sandbox_navigation("youtube.com", "https://example.com/")
    assert ok is False and "youtube.com" in reason
    lock, start = policy.sandbox_site("https://www.youtube.com/")
    assert lock == "youtube.com"
    assert start.startswith("https://www.youtube.com/")
    for refused in ("http://127.0.0.1/", "https://pornhub.com/"):
        try:
            policy.sandbox_site(refused)
        except policy.PolicyError:
            continue
        raise AssertionError(refused)
    try:
        policy.sandbox_site("https://asx-no-such-site.invalid/")
    except policy.PolicyError as exc:
        assert exc.reason
    else:
        raise AssertionError("invalid site")


def test_favicon_is_a_picture_from_that_site() -> None:
    assert policy.favicon_mime(b"\x89PNG\r\n\x1a\nxxxx") == "image/png"
    assert policy.favicon_mime(b"\xff\xd8\xff\xe0") == "image/jpeg"
    assert policy.favicon_mime(b"GIF89a") == "image/gif"
    assert policy.favicon_mime(b"RIFF\x00\x00\x00\x00WEBPxxxx") == "image/webp"
    assert policy.favicon_mime(b"\x00\x00\x01\x00rest") == "image/x-icon"
    for raw in (b"<html></html>", b"%PDF-1.4", b"MZ\x90\x00", b"", b"<svg></svg>"):
        try:
            policy.favicon_mime(raw)
        except policy.PolicyError:
            continue
        raise AssertionError(raw)
    wiki = (
        '<link rel="apple-touch-icon" href="/static/apple-touch/wikipedia.png">'
        '<link rel="shortcut icon" href="/static/favicon/wikipedia.ico">'
    )
    urls = policy.icon_addresses("https://www.wikipedia.org/", wiki)
    assert urls[0] == "https://www.wikipedia.org/static/favicon/wikipedia.ico"
    assert urls[-1] == "https://www.wikipedia.org/favicon.ico"
    assert all("apple-touch" not in item for item in urls)
    github = (
        '<link rel="mask-icon" href="https://github.githubassets.com/pinned.svg">'
        '<link rel="icon" type="image/svg+xml" href="https://github.githubassets.com/favicons/favicon.svg">'
        '<link rel="alternate icon" type="image/png" href="https://github.githubassets.com/favicons/favicon.png">'
        '<link rel="fluid-icon" href="https://github.com/fluidicon.png">'
    )
    urls = policy.icon_addresses("https://github.com/aliceinailand/alisonscorpionpublic", github)
    assert urls[0] == "https://github.com/fluidicon.png"
    assert "https://github.githubassets.com/favicons/favicon.png" in urls
    assert "https://github.com/favicon.ico" in urls
    assert all(not item.endswith(".svg") for item in urls)
    assert urls.index("https://github.com/favicon.ico") < urls.index(
        "https://github.githubassets.com/favicons/favicon.png"
    )
    youtube = (
        '<link rel="shortcut icon" href="https://www.youtube.com/s/desktop/favicon.ico">'
        '<link rel="icon" href="https://www.youtube.com/s/desktop/favicon_144x144.png" sizes="144x144">'
        '<link rel="icon" href="https://www.youtube.com/s/desktop/favicon_32x32.png" sizes="32x32">'
    )
    urls = policy.icon_addresses("https://www.youtube.com/", youtube)
    assert urls[0].endswith("favicon_32x32.png")
    assert policy.icon_addresses("https://pornhub.com/", wiki) == []
    assert policy.icon_addresses("http://127.0.0.1/", wiki) == []
    refused = (
        '<link rel="icon" href="http://127.0.0.1/secret.ico">'
        '<link rel="icon" href="javascript:alert(1)">'
    )
    assert policy.icon_addresses("https://example.com/", refused) == ["https://example.com/favicon.ico"]


def test_download_lands_in_the_laptop_folder() -> None:
    import tempfile
    from pathlib import Path

    folder = policy.laptop_downloads_dir()
    home = Path.home().resolve()
    assert folder.name == "Downloads"
    assert folder == home or home in folder.parents
    with tempfile.TemporaryDirectory() as raw:
        dest = Path(raw)
        body = b"%PDF-1.4\n1 0 obj\n"
        saved = policy.save_laptop_download("Report.pdf", body, dest)
        assert saved == "Report.pdf"
        assert (dest / saved).read_bytes() == body
        again = policy.save_laptop_download("Report.pdf", body, dest)
        assert again == "Report-2.pdf"
        for refused in ("../Report.pdf", "/tmp/Report.pdf", "Report..pdf", "", "MZ.exe"):
            try:
                policy.save_laptop_download(refused, body, dest)
            except policy.PolicyError:
                continue
            raise AssertionError(refused)


def test_sources_have_no_database() -> None:
    forbidden = (
        "sqlite",
        "psycopg",
        "sqlalchemy",
        "pymysql",
        "mysql.connector",
        "os.system",
        "os.popen",
        "shell=True",
        "shell = True",
    )
    for name in ("policy.py", "engine.py"):
        text = (ROOT / name).read_text(encoding="utf-8").lower()
        for token in forbidden:
            assert token not in text, (name, token)


if __name__ == "__main__":
    test_private_addresses()
    test_ip_policy()
    test_dotted_trap_host_does_not_open()
    test_decimal_loopback_is_not_public()
    test_proxy_refuses_private_and_sql()
    test_adult_sites_and_odd_ports_are_refused()
    test_download_keeps_pages_and_pictures_only()
    test_sandbox_stays_on_its_site()
    test_favicon_is_a_picture_from_that_site()
    test_download_lands_in_the_laptop_folder()
    test_origins()
    test_sql_payload_is_data_not_a_query()
    test_sources_have_no_database()
    print("browser policy tests passed")
