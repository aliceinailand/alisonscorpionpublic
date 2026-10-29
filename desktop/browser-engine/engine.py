"""Chromium for the Alison desktop.

The visited page is a picture inside the desktop. Its scripts never join
Alison's page. This process does not open a database. Addresses are refused
or passed to Chromium as JSON data, and Chromium can leave only through a
proxy that refuses private networks.
"""

from __future__ import annotations

import asyncio
import base64
import json
import os
import re
import secrets
import select
import socket
import subprocess
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from urllib.parse import urlparse

import websockets

import policy

# Windows virtual-key codes. A bare key name does not edit a text field.
NAV_KEYS = {
    "Enter": 13,
    "Backspace": 8,
    "Tab": 9,
    "Escape": 27,
    "ArrowLeft": 37,
    "ArrowRight": 39,
    "ArrowUp": 38,
    "ArrowDown": 40,
    "Delete": 46,
    "Home": 36,
    "End": 35,
    "PageUp": 33,
    "PageDown": 34,
}
BUTTONS = frozenset({"left", "right", "middle"})


class Engine:
    def __init__(self) -> None:
        self.cdp = None
        self.next_id = 0
        self.pending: dict[int, asyncio.Future] = {}
        self.client = None
        self.lock = ""
        self.nav_times: list[float] = []
        self.outbound: asyncio.Queue | None = None
        self.latest_frame: dict | None = None

    async def call(self, method: str, params: dict | None = None, timeout: float = 20):
        if self.cdp is None:
            raise policy.PolicyError("browser engine is not connected")
        self.next_id += 1
        number = self.next_id
        future: asyncio.Future = asyncio.get_running_loop().create_future()
        self.pending[number] = future
        await self.cdp.send(json.dumps({"id": number, "method": method, "params": params or {}}))
        try:
            return await asyncio.wait_for(future, timeout)
        except Exception:
            self.pending.pop(number, None)
            raise

    async def emit(self, payload: dict) -> None:
        """Queue a message so a picture cannot stall browser commands.

        Pictures keep only the newest frame. A block or a status is never
        dropped to make room for a picture.
        """
        if payload.get("type") == "frame":
            self.latest_frame = payload
            return
        queue = self.outbound
        if queue is None:
            return
        queue.put_nowait(payload)

    async def _send(self, payload: dict) -> None:
        client = self.client
        if client is None:
            return
        try:
            await asyncio.wait_for(client.send(json.dumps(payload)), timeout=2)
        except Exception:
            if self.client is client:
                self.client = None

    async def writer(self) -> None:
        assert self.outbound is not None
        while True:
            if self.outbound.empty() and self.latest_frame is not None:
                payload = self.latest_frame
                self.latest_frame = None
                await self._send(payload)
                continue
            try:
                payload = await asyncio.wait_for(self.outbound.get(), timeout=0.05)
            except asyncio.TimeoutError:
                continue
            await self._send(payload)

    async def reader(self) -> None:
        assert self.cdp is not None
        async for raw in self.cdp:
            try:
                message = json.loads(raw)
            except json.JSONDecodeError:
                continue
            number = message.get("id")
            if isinstance(number, int) and number in self.pending:
                future = self.pending.pop(number)
                if "error" in message:
                    future.set_exception(RuntimeError("browser command failed"))
                else:
                    future.set_result(message.get("result"))
                continue
            method = message.get("method")
            params = message.get("params") or {}
            if method == "Page.screencastFrame":
                self.next_id += 1
                ack = {
                    "id": self.next_id,
                    "method": "Page.screencastFrameAck",
                    "params": {"sessionId": params.get("sessionId")},
                }
                try:
                    await self.cdp.send(json.dumps(ack))
                except Exception:
                    return
                data = params.get("data") or ""
                if not isinstance(data, str) or not data.startswith("/9j/") or len(data) > 1_500_000:
                    continue
                meta = params.get("metadata") or {}
                await self.emit(
                    {
                        "type": "frame",
                        "jpeg": data,
                        "w": meta.get("deviceWidth"),
                        "h": meta.get("deviceHeight"),
                    }
                )
            elif method == "Page.frameNavigated":
                frame = params.get("frame") or {}
                if frame.get("parentId"):
                    continue
                url = frame.get("url") if isinstance(frame.get("url"), str) else ""
                await self.emit({"type": "status", "url": url[: policy.MAX_URL_LENGTH]})

    def allow_navigate(self) -> bool:
        now = time.monotonic()
        self.nav_times = [stamp for stamp in self.nav_times if now - stamp < 10]
        if len(self.nav_times) >= 30:
            return False
        self.nav_times.append(now)
        return True


ENGINE = Engine()


def _copy(src: socket.socket, dst: socket.socket) -> None:
    try:
        while True:
            ready, _, _ = select.select([src], [], [], 60)
            if not ready:
                break
            chunk = src.recv(65536)
            if not chunk:
                break
            dst.sendall(chunk)
    except Exception:
        pass
    finally:
        try:
            dst.shutdown(socket.SHUT_WR)
        except Exception:
            pass


def _refuse(client: socket.socket, reason: str) -> None:
    body = json.dumps({"blocked": True, "reason": reason[:180]})
    raw = (
        "HTTP/1.1 403 Forbidden\r\n"
        "Content-Type: application/json\r\n"
        "Connection: close\r\n"
        f"Content-Length: {len(body)}\r\n\r\n{body}"
    )
    try:
        client.sendall(raw.encode("ascii", errors="replace"))
    except Exception:
        pass


def _handle_proxy(client: socket.socket) -> None:
    client.settimeout(15)
    try:
        data = b""
        while b"\r\n\r\n" not in data and len(data) < policy.MAX_REQUEST_LINE + 4096:
            chunk = client.recv(4096)
            if not chunk:
                return
            data += chunk
        head, _, rest = data.partition(b"\r\n\r\n")
        line = head.split(b"\r\n", 1)[0].decode("latin-1", errors="replace")
        ok, reason = policy.decide_proxy_request(line)
        if not ok:
            _refuse(client, reason)
            return
        parts = line.split(" ")
        method, target = parts[0], parts[1]
        if method == "CONNECT":
            host, port = policy.split_host_port(target, 443)
            chosen = policy.resolve_public(host, port)
            remote = socket.socket(chosen[0][0], socket.SOCK_STREAM)
            remote.settimeout(20)
            remote.connect(chosen[0][1])
            client.sendall(b"HTTP/1.1 200 Connection Established\r\n\r\n")
            client.settimeout(None)
            remote.settimeout(None)
            if rest:
                remote.sendall(rest)
            left = threading.Thread(target=_copy, args=(client, remote), daemon=True)
            right = threading.Thread(target=_copy, args=(remote, client), daemon=True)
            left.start()
            right.start()
            left.join()
            right.join()
            remote.close()
            return
        parsed = urlparse(target)
        port = parsed.port or (443 if parsed.scheme == "https" else 80)
        host = parsed.hostname or ""
        chosen = policy.resolve_public(host, port)
        remote = socket.socket(chosen[0][0], socket.SOCK_STREAM)
        remote.settimeout(20)
        remote.connect(chosen[0][1])
        path = parsed.path or "/"
        if parsed.query:
            path = path + "?" + parsed.query
        forwarded = f"{method} {path} HTTP/1.1\r\n" + head.decode("latin-1", errors="replace").split("\r\n", 1)[1]
        remote.sendall(forwarded.encode("latin-1", errors="replace") + b"\r\n\r\n" + rest)
        client.settimeout(None)
        remote.settimeout(None)
        _copy(remote, client)
        remote.close()
    except policy.PolicyError as exc:
        _refuse(client, exc.reason)
    except Exception:
        _refuse(client, "browser proxy refused the connection")
    finally:
        try:
            client.close()
        except Exception:
            pass


def start_proxy() -> int:
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server.bind((policy.BRIDGE_HOST, 0))
    server.listen(64)
    port = server.getsockname()[1]

    def accept_loop() -> None:
        while True:
            try:
                client, _addr = server.accept()
            except OSError:
                return
            threading.Thread(target=_handle_proxy, args=(client,), daemon=True).start()

    threading.Thread(target=accept_loop, daemon=True).start()
    return port


OBSERVER = {"mode": "headless", "name": "ASX Web Observer", "proxy": ""}


def start_virtual_display() -> tuple[str | None, subprocess.Popen | None]:
    """A private X display so the real browser is not headless and not on the user's screen."""
    binary = "/usr/bin/Xvfb"
    if not (os.path.isfile(binary) and os.access(binary, os.X_OK)):
        return None, None
    for number in (97, 98, 99):
        socket_path = f"/tmp/.X11-unix/X{number}"
        if os.path.exists(socket_path):
            continue
        display = f":{number}"
        proc = subprocess.Popen(
            [binary, display, "-screen", "0", "1280x800x24", "-nolisten", "tcp"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        for _ in range(30):
            if proc.poll() is not None:
                break
            if os.path.exists(socket_path):
                return display, proc
            time.sleep(0.1)
        if proc.poll() is None:
            proc.terminate()
    return None, None


def launch_chrome(proxy_port: int, headed: bool, display: str | None) -> subprocess.Popen:
    args = policy.chrome_launch_args(
        f"http://127.0.0.1:{proxy_port}",
        policy.PROFILE_DIR,
        policy.DEBUG_PORT,
        headed=headed,
    )
    env = os.environ.copy()
    if headed and display:
        env["DISPLAY"] = display
    else:
        env.pop("DISPLAY", None)
    with open("/tmp/asx-web-observer-chrome.log", "ab") as log:
        return subprocess.Popen(
            args,
            env=env,
            stdout=subprocess.DEVNULL,
            stderr=log,
        )


def _clear_restored_tabs() -> None:
    """A crashed window must not come back as a second tab beside about:blank."""
    root = os.path.join(policy.PROFILE_DIR, "Default")
    sessions = os.path.join(root, "Sessions")
    if os.path.isdir(sessions):
        for name in os.listdir(sessions):
            try:
                os.remove(os.path.join(sessions, name))
            except OSError:
                pass
    for name in ("Current Session", "Last Session", "Current Tabs", "Last Tabs"):
        try:
            os.remove(os.path.join(root, name))
        except OSError:
            pass


def start_chrome(proxy_port: int) -> tuple[subprocess.Popen, subprocess.Popen | None, str | None]:
    os.makedirs(policy.PROFILE_DIR, mode=0o700, exist_ok=True)
    _clear_restored_tabs()
    display, xvfb = start_virtual_display()
    headed = display is not None
    OBSERVER["mode"] = "headed" if headed else "headless"
    proc = launch_chrome(proxy_port, headed, display)
    return proc, xvfb, display


def wait_for_devtools(proc: subprocess.Popen) -> str:
    url = f"http://127.0.0.1:{policy.DEBUG_PORT}/json/list"
    for _ in range(80):
        if proc.poll() is not None:
            raise policy.PolicyError("Chromium stopped before the debugging port opened")
        try:
            with urllib.request.urlopen(url, timeout=0.5) as response:
                pages = json.loads(response.read().decode("utf-8"))
        except Exception:
            time.sleep(0.25)
            continue
        chosen = None
        for page in pages:
            if page.get("type") != "page" or not page.get("webSocketDebuggerUrl"):
                continue
            if page.get("url") == "about:blank":
                chosen = page
                break
            if chosen is None:
                chosen = page
        if chosen is None:
            time.sleep(0.25)
            continue
        for page in pages:
            if page is chosen or page.get("type") != "page" or not page.get("id"):
                continue
            try:
                urllib.request.urlopen(
                    f"http://127.0.0.1:{policy.DEBUG_PORT}/json/close/{page['id']}",
                    timeout=0.5,
                ).close()
            except Exception:
                pass
        return str(chosen["webSocketDebuggerUrl"])
    raise policy.PolicyError("Chromium did not open a page")


def _number(value: object, low: float, high: float) -> float | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    number = float(value)
    if number != number or number < low or number > high:
        return None
    return number


async def on_message(box, message: dict) -> None:
    kind = message.get("type")
    if kind == "navigate":
        if not box.allow_navigate():
            await box.emit({"type": "blocked", "reason": "too many addresses"})
            return
        raw_url = str(message.get("url") or "")
        try:
            if box.lock:
                ok, reason, clean = policy.sandbox_navigation(box.lock, raw_url)
                if not ok:
                    await box.emit({"type": "blocked", "reason": reason})
                    return
                parsed = urlparse(clean)
                port = parsed.port or (443 if parsed.scheme == "https" else 80)
                policy.resolve_public(parsed.hostname or "", port)
                params = {"url": clean}
            else:
                command = policy.cdp_navigate(raw_url)
                parsed = urlparse(command["params"]["url"])
                port = parsed.port or (443 if parsed.scheme == "https" else 80)
                policy.resolve_public(parsed.hostname or "", port)
                params = command["params"]
        except policy.PolicyError as exc:
            await box.emit({"type": "blocked", "reason": exc.reason})
            return
        await box.call("Page.navigate", params)
        return
    if kind == "home":
        if box.lock:
            await box.call("Page.navigate", {"url": "https://" + box.lock + "/"})
            return
        await box.call("Page.navigate", {"url": "about:blank"})
        await box.emit({"type": "status", "url": ""})
        return
    if kind == "reload":
        await box.call("Page.reload", {"ignoreCache": False})
        return
    if kind == "stop":
        await box.call("Page.stopLoading")
        return
    if kind in ("back", "forward"):
        history = await box.call("Page.getNavigationHistory")
        index = int((history or {}).get("currentIndex") or 0)
        entries = (history or {}).get("entries") or []
        index += -1 if kind == "back" else 1
        if 0 <= index < len(entries):
            entry = entries[index] if isinstance(entries[index], dict) else {}
            entry_url = entry.get("url") if isinstance(entry.get("url"), str) else ""
            if box.lock and entry_url:
                ok, reason, _clean = policy.sandbox_navigation(box.lock, entry_url)
                if not ok:
                    await box.emit({"type": "blocked", "reason": reason})
                    return
            await box.call("Page.navigateToHistoryEntry", {"entryId": entry.get("id")})
        return
    if kind == "resize":
        width = _number(message.get("width"), 200, 1600)
        height = _number(message.get("height"), 160, 1200)
        if width is None or height is None:
            return
        await box.call(
            "Emulation.setDeviceMetricsOverride",
            {
                "width": int(width),
                "height": int(height),
                "deviceScaleFactor": 1,
                "mobile": False,
            },
        )
        return
    if kind == "click":
        x = _number(message.get("x"), 0, 4000)
        y = _number(message.get("y"), 0, 4000)
        button = message.get("button") if message.get("button") in BUTTONS else None
        if x is None or y is None or button is None:
            return
        for phase in ("mousePressed", "mouseReleased"):
            await box.call(
                "Input.dispatchMouseEvent",
                {"type": phase, "x": x, "y": y, "button": button, "clickCount": 1},
            )
        return
    if kind == "move":
        x = _number(message.get("x"), 0, 4000)
        y = _number(message.get("y"), 0, 4000)
        if x is None or y is None:
            return
        await box.call(
            "Input.dispatchMouseEvent",
            {"type": "mouseMoved", "x": x, "y": y},
        )
        return
    if kind == "wheel":
        x = _number(message.get("x"), 0, 4000)
        y = _number(message.get("y"), 0, 4000)
        dx = _number(message.get("deltaX"), -2000, 2000)
        dy = _number(message.get("deltaY"), -2000, 2000)
        if None in (x, y, dx, dy):
            return
        await box.call(
            "Input.dispatchMouseEvent",
            {"type": "mouseWheel", "x": x, "y": y, "deltaX": dx, "deltaY": dy},
        )
        return
    if kind == "type":
        text = message.get("text")
        if not isinstance(text, str) or not text or len(text) > 500:
            return
        if any(ch in text for ch in ("\x00",)):
            return
        await box.call("Input.insertText", {"text": text})
        return
    if kind == "key":
        key = message.get("key")
        if not isinstance(key, str) or key not in NAV_KEYS:
            return
        code = message.get("code") if isinstance(message.get("code"), str) else ""
        if len(code) > 32:
            return
        key_code = NAV_KEYS[key]
        for type_name in ("keyDown", "keyUp"):
            await box.call(
                "Input.dispatchKeyEvent",
                {
                    "type": type_name,
                    "key": key,
                    "code": code[:32],
                    "windowsVirtualKeyCode": key_code,
                    "nativeVirtualKeyCode": key_code,
                },
            )
        return


class Sandbox:
    """One website, in its own browser context. The address cannot leave that site."""

    def __init__(self, lock: str, session_id: str, target_id: str, context_id: str) -> None:
        self.lock = lock
        self.session_id = session_id
        self.target_id = target_id
        self.context_id = context_id
        self.client = None
        self.nav_times: list[float] = []
        self.outbound: asyncio.Queue = asyncio.Queue()
        self.latest_frame: dict | None = None
        self.last_url = "https://" + lock + "/"
        self.main_frame_id = ""
        self.writer_task = asyncio.create_task(self.writer())

    async def call(self, method: str, params: dict | None = None, timeout: float = 20):
        return await BRIDGE.call(method, params, self.session_id, timeout)

    async def emit(self, payload: dict) -> None:
        if payload.get("type") == "frame":
            self.latest_frame = payload
            return
        self.outbound.put_nowait(payload)

    async def _send(self, payload: dict) -> None:
        client = self.client
        if client is None:
            return
        try:
            await asyncio.wait_for(client.send(json.dumps(payload)), timeout=2)
        except Exception:
            if self.client is client:
                self.client = None

    async def writer(self) -> None:
        while True:
            if self.outbound.empty() and self.latest_frame is not None:
                payload = self.latest_frame
                self.latest_frame = None
                await self._send(payload)
                continue
            try:
                payload = await asyncio.wait_for(self.outbound.get(), timeout=0.05)
            except asyncio.TimeoutError:
                continue
            await self._send(payload)

    def allow_navigate(self) -> bool:
        now = time.monotonic()
        self.nav_times = [stamp for stamp in self.nav_times if now - stamp < 10]
        if len(self.nav_times) >= 30:
            return False
        self.nav_times.append(now)
        return True

    async def on_cdp(self, message: dict) -> None:
        method = message.get("method")
        params = message.get("params") or {}
        if method == "Page.screencastFrame":
            BRIDGE.post(
                "Page.screencastFrameAck",
                {"sessionId": params.get("sessionId")},
                self.session_id,
            )
            data = params.get("data") or ""
            if not isinstance(data, str) or not data.startswith("/9j/") or len(data) > 1_500_000:
                return
            meta = params.get("metadata") or {}
            await self.emit(
                {
                    "type": "frame",
                    "jpeg": data,
                    "w": meta.get("deviceWidth"),
                    "h": meta.get("deviceHeight"),
                }
            )
            return
        if method == "Page.frameNavigated":
            frame = params.get("frame") or {}
            if frame.get("parentId"):
                return
            url = frame.get("url") if isinstance(frame.get("url"), str) else ""
            frame_id = frame.get("id") if isinstance(frame.get("id"), str) else ""
            if frame_id:
                self.main_frame_id = frame_id
            if not url:
                return
            ok, reason, clean = policy.sandbox_navigation(self.lock, url)
            if not ok:
                if url.startswith(("chrome-error:", "chrome://")):
                    return
                BRIDGE.post("Page.navigate", {"url": self.last_url}, self.session_id)
                await self.emit({"type": "blocked", "reason": reason})
                return
            if clean.startswith("http"):
                self.last_url = clean
            await self.emit({"type": "status", "url": url[: policy.MAX_URL_LENGTH]})
            return
        if method == "Fetch.requestPaused":
            request = params.get("request") or {}
            url = request.get("url") if isinstance(request.get("url"), str) else ""
            request_id = params.get("requestId")
            if not isinstance(request_id, str) or not request_id:
                return
            resource_type = params.get("resourceType")
            if isinstance(resource_type, str) and resource_type != "Document":
                BRIDGE.post("Fetch.continueRequest", {"requestId": request_id}, self.session_id)
                return
            frame_id = params.get("frameId") if isinstance(params.get("frameId"), str) else ""
            if self.main_frame_id and frame_id and frame_id != self.main_frame_id:
                BRIDGE.post("Fetch.continueRequest", {"requestId": request_id}, self.session_id)
                return
            ok, reason, _clean = policy.sandbox_navigation(self.lock, url)
            if ok or url.startswith(("about:", "chrome-error:", "chrome://")):
                if ok and frame_id and not self.main_frame_id:
                    self.main_frame_id = frame_id
                BRIDGE.post("Fetch.continueRequest", {"requestId": request_id}, self.session_id)
            else:
                BRIDGE.post(
                    "Fetch.failRequest",
                    {"requestId": request_id, "errorReason": "Aborted"},
                    self.session_id,
                )
                await self.emit({"type": "blocked", "reason": reason})


class BrowserBridge:
    def __init__(self) -> None:
        self.ws = None
        self.next_id = 0
        self.pending: dict[int, asyncio.Future] = {}
        self.by_session: dict[str, Sandbox] = {}
        self.by_host: dict[str, Sandbox] = {}
        self.gate: asyncio.Lock | None = None

    def post(self, method: str, params: dict | None, session_id: str | None) -> None:
        if self.ws is None:
            return
        self.next_id += 1
        payload: dict = {"id": self.next_id, "method": method, "params": params or {}}
        if session_id:
            payload["sessionId"] = session_id
        asyncio.create_task(self._post(payload))

    async def _post(self, payload: dict) -> None:
        if self.ws is None:
            return
        try:
            await self.ws.send(json.dumps(payload))
        except Exception:
            return

    async def call(
        self,
        method: str,
        params: dict | None = None,
        session_id: str | None = None,
        timeout: float = 20,
    ):
        if self.ws is None:
            raise policy.PolicyError("browser engine is not connected")
        self.next_id += 1
        number = self.next_id
        future: asyncio.Future = asyncio.get_running_loop().create_future()
        self.pending[number] = future
        payload: dict = {"id": number, "method": method, "params": params or {}}
        if session_id:
            payload["sessionId"] = session_id
        await self.ws.send(json.dumps(payload))
        try:
            return await asyncio.wait_for(future, timeout)
        except Exception:
            self.pending.pop(number, None)
            raise

    async def reader(self) -> None:
        assert self.ws is not None
        async for raw in self.ws:
            try:
                message = json.loads(raw)
            except json.JSONDecodeError:
                continue
            number = message.get("id")
            if isinstance(number, int) and number in self.pending:
                future = self.pending.pop(number)
                if "error" in message:
                    future.set_exception(RuntimeError("browser command failed"))
                else:
                    future.set_result(message.get("result"))
                continue
            session_id = message.get("sessionId")
            if not isinstance(session_id, str):
                continue
            box = self.by_session.get(session_id)
            if box is not None:
                await box.on_cdp(message)

    async def acquire(self, lock: str, start_url: str) -> Sandbox | None:
        assert self.gate is not None
        created: Sandbox | None = None
        fresh = False
        async with self.gate:
            existing = self.by_host.get(lock)
            if existing is not None:
                created = existing
            elif len(self.by_host) >= 4:
                return None
            else:
                fresh = True
                context = await self.call(
                    "Target.createBrowserContext",
                    {
                        "proxyServer": OBSERVER["proxy"],
                        "proxyBypassList": "<-loopback>",
                    },
                )
                context_id = str(context.get("browserContextId") or "")
                if not context_id:
                    raise policy.PolicyError("sandbox could not start")
                try:
                    await self.call(
                        "Browser.setDownloadBehavior",
                        {
                            "behavior": "deny",
                            "eventsEnabled": False,
                            "browserContextId": context_id,
                        },
                    )
                except Exception:
                    pass
                target = await self.call(
                    "Target.createTarget",
                    {
                        "url": "about:blank",
                        "browserContextId": context_id,
                        "width": 1040,
                        "height": 640,
                    },
                )
                target_id = str(target.get("targetId") or "")
                attached = await self.call(
                    "Target.attachToTarget",
                    {"targetId": target_id, "flatten": True},
                )
                session_id = str(attached.get("sessionId") or "")
                if not target_id or not session_id:
                    await self.call("Target.disposeBrowserContext", {"browserContextId": context_id})
                    raise policy.PolicyError("sandbox could not start")
                created = Sandbox(lock, session_id, target_id, context_id)
                self.by_session[session_id] = created
                self.by_host[lock] = created
        if created is None:
            return None
        try:
            if fresh:
                await created.call("Page.enable")
                await created.call(
                    "Fetch.enable",
                    {
                        "patterns": [
                            {
                                "urlPattern": "*",
                                "resourceType": "Document",
                                "requestStage": "Request",
                            }
                        ]
                    },
                )
                await created.call(
                    "Page.startScreencast",
                    {
                        "format": "jpeg",
                        "quality": 60,
                        "maxWidth": 1280,
                        "maxHeight": 800,
                        "everyNthFrame": 1,
                    },
                )
            await created.call("Page.navigate", {"url": start_url})
            created.last_url = start_url
        except Exception:
            if fresh:
                await self.release(created)
            raise
        return created

    async def release(self, box: Sandbox) -> None:
        if self.gate is None:
            return
        async with self.gate:
            if self.by_host.get(box.lock) is not box:
                return
            self.by_host.pop(box.lock, None)
            self.by_session.pop(box.session_id, None)
        box.writer_task.cancel()
        try:
            await self.call("Target.disposeBrowserContext", {"browserContextId": box.context_id})
        except Exception:
            return


BRIDGE = BrowserBridge()


def _session_query(websocket) -> dict:
    request = getattr(websocket, "request", None)
    path = getattr(request, "path", "") if request is not None else ""
    if not isinstance(path, str):
        return {}
    return urllib.parse.parse_qs(urllib.parse.urlparse(path).query, keep_blank_values=False)


async def sandbox_session(websocket) -> None:
    query = _session_query(websocket)
    site = query.get("site", [""])[0]
    start = query.get("start", [""])[0]
    try:
        lock, root = policy.sandbox_site(site)
        start_url = root
        if start:
            ok, _reason, clean = policy.sandbox_navigation(lock, start)
            if ok and clean.startswith("http"):
                parsed = urlparse(clean)
                port = parsed.port or (443 if parsed.scheme == "https" else 80)
                policy.resolve_public(parsed.hostname or "", port)
                start_url = clean
    except policy.PolicyError as exc:
        await websocket.send(json.dumps({"type": "blocked", "reason": exc.reason}))
        await websocket.close()
        return
    try:
        box = await BRIDGE.acquire(lock, start_url)
    except policy.PolicyError as exc:
        await websocket.send(json.dumps({"type": "blocked", "reason": exc.reason}))
        await websocket.close()
        return
    except Exception:
        await websocket.send(json.dumps({"type": "blocked", "reason": "sandbox could not start"}))
        await websocket.close()
        return
    if box is None:
        await websocket.send(json.dumps({"type": "blocked", "reason": "too many sandboxes"}))
        await websocket.close()
        return
    previous = box.client
    box.client = websocket
    if previous is not None and previous is not websocket:
        try:
            await previous.close()
        except Exception:
            pass
    await websocket.send(
        json.dumps(
            {
                "type": "ready",
                "engine": "chromium",
                "name": lock,
                "mode": OBSERVER["mode"],
                "sandbox": lock,
                "sql": False,
            }
        )
    )
    try:
        async for raw in websocket:
            if not isinstance(raw, str) or len(raw) > 65536:
                await box.emit({"type": "blocked", "reason": "message refused"})
                continue
            try:
                message = json.loads(raw)
            except json.JSONDecodeError:
                await box.emit({"type": "blocked", "reason": "message is not json"})
                continue
            if not isinstance(message, dict):
                continue
            try:
                await on_message(box, message)
            except policy.PolicyError as exc:
                await box.emit({"type": "blocked", "reason": exc.reason})
            except Exception:
                await box.emit({"type": "blocked", "reason": "browser command failed"})
    finally:
        if box.client is websocket:
            box.client = None
            await BRIDGE.release(box)


async def session(websocket) -> None:
    if _session_query(websocket).get("site", [""])[0]:
        await sandbox_session(websocket)
        return
    if ENGINE.client is not None and ENGINE.client is not websocket:
        try:
            await ENGINE.client.close()
        except Exception:
            pass
    ENGINE.client = websocket
    await websocket.send(
        json.dumps(
            {
                "type": "ready",
                "engine": "chromium",
                "name": OBSERVER["name"],
                "mode": OBSERVER["mode"],
                "sql": False,
            }
        )
    )
    try:
        async for raw in websocket:
            if not isinstance(raw, str) or len(raw) > 65536:
                await ENGINE.emit({"type": "blocked", "reason": "message refused"})
                continue
            try:
                message = json.loads(raw)
            except json.JSONDecodeError:
                await ENGINE.emit({"type": "blocked", "reason": "message is not json"})
                continue
            if not isinstance(message, dict):
                continue
            try:
                await on_message(ENGINE, message)
            except policy.PolicyError as exc:
                await ENGINE.emit({"type": "blocked", "reason": exc.reason})
            except Exception:
                await ENGINE.emit({"type": "blocked", "reason": "browser command failed"})
    finally:
        if ENGINE.client is websocket:
            ENGINE.client = None


def _cors(response, origin: str) -> None:
    if policy.origin_allowed(origin):
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Vary"] = "Origin"
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"


def _json_unescape(text: str) -> str:
    try:
        return json.loads('"' + text + '"')
    except json.JSONDecodeError:
        return text


def parse_youtube_results(html: str, limit: int = 12) -> list[dict]:
    """Pull video id, title, and channel from a YouTube results page."""
    items: list[dict] = []
    seen: set[str] = set()
    title_re = re.compile(r'"title":\{"runs":\[\{"text":"((?:\\.|[^"\\])*)"')
    owner_re = re.compile(
        r'"(?:longBylineText|ownerText)":\{"runs":\[\{"text":"((?:\\.|[^"\\])*)"'
    )
    id_re = re.compile(r'"videoId":"([\w-]{11})"')
    for chunk in html.split('"videoRenderer":')[1:]:
        piece = chunk[:4000]
        id_match = id_re.search(piece)
        title_match = title_re.search(piece)
        if id_match is None or title_match is None:
            continue
        video_id = id_match.group(1)
        if video_id in seen:
            continue
        seen.add(video_id)
        owner_match = owner_re.search(piece)
        items.append(
            {
                "id": video_id,
                "title": _json_unescape(title_match.group(1))[:180],
                "channel": _json_unescape(owner_match.group(1))[:120] if owner_match else "",
            }
        )
        if len(items) >= limit:
            break
    return items


def fetch_youtube_results(query: str) -> list[dict]:
    text = query.strip()
    if not text or len(text) > 80 or any(ch in text for ch in ("\r", "\n", "\x00")):
        raise policy.PolicyError("search text refused")
    target = "https://www.youtube.com/results?search_query=" + urllib.parse.quote_plus(text)
    request = urllib.request.Request(
        target,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
            ),
            "Accept-Language": "en",
        },
    )
    with urllib.request.urlopen(request, timeout=12) as response:
        html = response.read(2_000_000).decode("utf-8", "replace")
    return parse_youtube_results(html)


class _CheckedRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        ok, reason, clean = policy.classify_url(newurl)
        if not ok:
            raise policy.PolicyError(reason or "address refused")
        parsed = urllib.parse.urlparse(clean)
        port = parsed.port or (443 if parsed.scheme == "https" else 80)
        policy.resolve_public(parsed.hostname or "", port)
        return super().redirect_request(req, fp, code, msg, headers, clean)


def _public_url(raw: str) -> str:
    ok, reason, clean = policy.classify_url(raw)
    if not ok:
        raise policy.PolicyError(reason or "address refused")
    parsed = urllib.parse.urlparse(clean)
    port = parsed.port or (443 if parsed.scheme == "https" else 80)
    policy.resolve_public(parsed.hostname or "", port)
    return clean


def _download_failure(exc: Exception) -> policy.PolicyError:
    nested = exc.__cause__ if isinstance(exc.__cause__, policy.PolicyError) else None
    if nested is None and isinstance(getattr(exc, "reason", None), policy.PolicyError):
        nested = exc.reason
    if nested is not None:
        return nested
    if isinstance(exc, policy.PolicyError):
        return exc
    return policy.PolicyError("download failed")


def fetch_download(raw_url: str, on_progress=None) -> dict:
    """Save a public PDF, JPG, PNG, or HTML page onto this laptop."""
    target = _public_url(raw_url)
    opener = urllib.request.build_opener(
        urllib.request.HTTPHandler,
        urllib.request.HTTPSHandler,
        _CheckedRedirect,
    )
    request = urllib.request.Request(
        target,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
            ),
            "Accept": "text/html,application/pdf,image/png,image/jpeg;q=0.9,*/*;q=0.1",
        },
    )
    pieces: list[bytes] = []
    received = 0
    total = 0
    try:
        with opener.open(request, timeout=20) as response:
            final_url = response.geturl()
            _public_url(final_url)
            content_type = response.headers.get("Content-Type", "")
            length = response.headers.get("Content-Length", "")
            if length.isdigit():
                total = int(length)
                if total > policy.MAX_DOWNLOAD_BYTES:
                    raise policy.PolicyError("file is too large")
            while True:
                chunk = response.read(65536)
                if not chunk:
                    break
                received += len(chunk)
                if received > policy.MAX_DOWNLOAD_BYTES:
                    raise policy.PolicyError("file is too large")
                pieces.append(chunk)
                if on_progress is not None:
                    on_progress(received, total)
    except policy.PolicyError:
        raise
    except Exception as exc:
        raise _download_failure(exc) from exc
    body = b"".join(pieces)
    kind, extension = policy.classify_download(body, content_type)
    name = policy.download_filename(final_url, extension)
    saved_name = policy.save_laptop_download(name, body)
    return {
        "name": saved_name,
        "kind": kind,
        "place": "Downloads",
    }


_DOWNLOAD_JOBS: dict[str, dict] = {}
_DOWNLOAD_LOCK = threading.Lock()


def _prune_download_jobs() -> None:
    now = time.time()
    stale = [
        job_id
        for job_id, job in _DOWNLOAD_JOBS.items()
        if job["status"] != "downloading" and now - job["started"] > 900
    ]
    for job_id in stale:
        _DOWNLOAD_JOBS.pop(job_id, None)


def _run_download(job_id: str, raw_url: str) -> None:
    def on_progress(received: int, total: int) -> None:
        with _DOWNLOAD_LOCK:
            job = _DOWNLOAD_JOBS.get(job_id)
            if job is None or job["status"] != "downloading":
                return
            job["received"] = received
            job["total"] = total

    try:
        saved = fetch_download(raw_url, on_progress)
    except policy.PolicyError as exc:
        with _DOWNLOAD_LOCK:
            job = _DOWNLOAD_JOBS.get(job_id)
            if job is not None:
                job["status"] = "failed"
                job["reason"] = exc.reason or "download failed"
        return
    except Exception:
        with _DOWNLOAD_LOCK:
            job = _DOWNLOAD_JOBS.get(job_id)
            if job is not None:
                job["status"] = "failed"
                job["reason"] = "download failed"
        return
    with _DOWNLOAD_LOCK:
        job = _DOWNLOAD_JOBS.get(job_id)
        if job is None:
            return
        job["status"] = "completed"
        job["name"] = saved["name"]
        job["kind"] = saved["kind"]
        job["place"] = saved["place"]
        job["received"] = max(job["received"], 1)
        job["total"] = job["received"]


def _read_public(raw_url: str, limit: int, truncate: bool = False) -> tuple[str, bytes]:
    """Read a public address. A sandbox icon uses this. It does not save a file."""
    target = _public_url(raw_url)
    opener = urllib.request.build_opener(
        urllib.request.HTTPHandler,
        urllib.request.HTTPSHandler,
        _CheckedRedirect,
    )
    request = urllib.request.Request(
        target,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
            ),
            "Accept": "image/png,image/jpeg,image/webp,image/gif,image/x-icon,text/html;q=0.8,*/*;q=0.1",
        },
    )
    try:
        with opener.open(request, timeout=12) as response:
            final_url = response.geturl()
            _public_url(final_url)
            body = response.read(limit + 1)
    except policy.PolicyError:
        raise
    except Exception as exc:
        raise _download_failure(exc) from exc
    if len(body) > limit:
        if not truncate:
            raise policy.PolicyError("website icon is too large")
        body = body[:limit]
    return final_url, body


_ICON_CACHE: dict[str, tuple[float, dict]] = {}
_ICON_GUARD = threading.Lock()


def site_icon(raw_url: str) -> dict:
    """The picture a website names as its icon. Adult sites and private addresses stay refused."""
    lock, start = policy.sandbox_site(raw_url)
    now = time.time()
    with _ICON_GUARD:
        hit = _ICON_CACHE.get(lock)
        if hit is not None and now - hit[0] < 3600:
            return hit[1]
    final_url, html = _read_public(start, 300_000, truncate=True)
    targets = policy.icon_addresses(final_url, html.decode("utf-8", "replace"))
    chosen = None
    for target in targets:
        try:
            _icon_url, body = _read_public(target, policy.MAX_FAVICON_BYTES)
            mime = policy.favicon_mime(body)
        except policy.PolicyError:
            continue
        except Exception:
            continue
        chosen = {
            "mime": mime,
            "data": base64.b64encode(body).decode("ascii"),
            "lock": lock,
        }
        break
    if chosen is None:
        raise policy.PolicyError("website has no icon")
    with _ICON_GUARD:
        if len(_ICON_CACHE) > 32:
            _ICON_CACHE.clear()
        _ICON_CACHE[lock] = (time.time(), chosen)
    return chosen


def begin_download(raw_url: str) -> str:
    if not isinstance(raw_url, str) or not raw_url.strip():
        raise policy.PolicyError("enter an address")
    job_id = secrets.token_hex(16)
    with _DOWNLOAD_LOCK:
        _prune_download_jobs()
        active = sum(1 for job in _DOWNLOAD_JOBS.values() if job["status"] == "downloading")
        if active >= 3:
            raise policy.PolicyError("a download is already running")
        _DOWNLOAD_JOBS[job_id] = {
            "status": "downloading",
            "received": 0,
            "total": 0,
            "name": "",
            "kind": "",
            "place": "",
            "reason": "",
            "started": time.time(),
        }
    threading.Thread(target=_run_download, args=(job_id, raw_url), daemon=True).start()
    return job_id


def site_can_open(raw_url: str) -> dict:
    """See whether a public website answers. This does not open a browser."""
    lock, start = policy.sandbox_site(raw_url)
    opener = urllib.request.build_opener(
        urllib.request.HTTPHandler,
        urllib.request.HTTPSHandler,
        _CheckedRedirect,
    )
    request = urllib.request.Request(
        start,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
            ),
            "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1",
        },
    )
    try:
        with opener.open(request, timeout=8) as response:
            final_url = response.geturl()
            _public_url(final_url)
            response.read(512)
    except policy.PolicyError:
        raise
    except urllib.error.HTTPError as exc:
        final_url = exc.geturl() or start
        _public_url(final_url)
        return {"ok": True, "lock": lock, "url": start}
    except Exception as exc:
        nested = exc.__cause__ if isinstance(exc.__cause__, policy.PolicyError) else None
        if nested is None and isinstance(getattr(exc, "reason", None), policy.PolicyError):
            nested = exc.reason
        if nested is not None:
            raise nested
        raise policy.PolicyError("this site does not work") from exc
    return {"ok": True, "lock": lock, "url": start}


def download_status(job_id: str) -> dict:
    if not isinstance(job_id, str) or len(job_id) != 32 or any(ch not in "0123456789abcdef" for ch in job_id):
        raise policy.PolicyError("download not found")
    with _DOWNLOAD_LOCK:
        job = _DOWNLOAD_JOBS.get(job_id)
        if job is None:
            raise policy.PolicyError("download not found")
        return {
            "status": job["status"],
            "received": job["received"],
            "total": job["total"],
            "name": job["name"],
            "kind": job["kind"],
            "place": job["place"],
            "reason": job["reason"],
        }


async def process_request(connection, request):
    origin = request.headers.get("Origin", "")
    path, _, query = request.path.partition("?")
    if path == "/youtube-search":
        if not policy.origin_allowed(origin):
            response = connection.respond(403, "origin refused")
            _cors(response, origin)
            return response
        wanted = urllib.parse.parse_qs(query, keep_blank_values=False).get("q", [""])[0]
        try:
            items = await asyncio.to_thread(fetch_youtube_results, wanted)
        except policy.PolicyError as exc:
            response = connection.respond(400, json.dumps({"items": [], "reason": exc.reason}))
        except Exception:
            response = connection.respond(502, json.dumps({"items": [], "reason": "search failed"}))
        else:
            response = connection.respond(200, json.dumps({"items": items}))
        response.headers["Content-Type"] = "application/json"
        _cors(response, origin)
        return response
    if path == "/download/status":
        if not policy.origin_allowed(origin):
            response = connection.respond(403, "origin refused")
            _cors(response, origin)
            return response
        job_id = urllib.parse.parse_qs(query, keep_blank_values=False).get("id", [""])[0]
        try:
            row = download_status(job_id)
        except policy.PolicyError as exc:
            response = connection.respond(404, json.dumps({"reason": exc.reason}))
        else:
            response = connection.respond(200, json.dumps(row))
        response.headers["Content-Type"] = "application/json"
        _cors(response, origin)
        return response
    if path == "/download":
        if not policy.origin_allowed(origin):
            response = connection.respond(403, "origin refused")
            _cors(response, origin)
            return response
        wanted = urllib.parse.parse_qs(query, keep_blank_values=False).get("u", [""])[0]
        try:
            job_id = begin_download(wanted)
        except policy.PolicyError as exc:
            response = connection.respond(400, json.dumps({"reason": exc.reason}))
        except Exception:
            response = connection.respond(502, json.dumps({"reason": "download failed"}))
        else:
            response = connection.respond(200, json.dumps({"id": job_id}))
        response.headers["Content-Type"] = "application/json"
        _cors(response, origin)
        return response
    if path == "/sandbox-check":
        if not policy.origin_allowed(origin):
            response = connection.respond(403, "origin refused")
            _cors(response, origin)
            return response
        wanted = urllib.parse.parse_qs(query, keep_blank_values=False).get("u", [""])[0]
        try:
            row = await asyncio.to_thread(site_can_open, wanted)
        except policy.PolicyError as exc:
            response = connection.respond(400, json.dumps({"ok": False, "reason": exc.reason}))
        except Exception:
            response = connection.respond(502, json.dumps({"ok": False, "reason": "this site does not work"}))
        else:
            response = connection.respond(200, json.dumps({"ok": True, "lock": row["lock"], "url": row["url"]}))
        response.headers["Content-Type"] = "application/json"
        _cors(response, origin)
        return response
    if path == "/favicon":
        if not policy.origin_allowed(origin):
            response = connection.respond(403, "origin refused")
            _cors(response, origin)
            return response
        wanted = urllib.parse.parse_qs(query, keep_blank_values=False).get("u", [""])[0]
        try:
            row = await asyncio.to_thread(site_icon, wanted)
        except policy.PolicyError as exc:
            response = connection.respond(400, json.dumps({"reason": exc.reason}))
        except Exception:
            response = connection.respond(502, json.dumps({"reason": "website has no icon"}))
        else:
            response = connection.respond(200, json.dumps(row))
        response.headers["Content-Type"] = "application/json"
        _cors(response, origin)
        return response
    if path == "/health":
        body = json.dumps(
            {
                "ok": True,
                "engine": "chromium",
                "name": OBSERVER["name"],
                "mode": OBSERVER["mode"],
                "sql": False,
            }
        )
        response = connection.respond(200, body)
        response.headers["Content-Type"] = "application/json"
        _cors(response, origin)
        return response
    upgrade = request.headers.get("Upgrade", "")
    if upgrade.lower() != "websocket":
        response = connection.respond(404, "not found")
        _cors(response, origin)
        return response
    if not policy.origin_allowed(origin):
        return connection.respond(403, "origin refused")
    return None


async def deny_downloads() -> None:
    """The observer may show a page. It may not save a program or a payload."""
    url = f"http://127.0.0.1:{policy.DEBUG_PORT}/json/version"
    try:
        with urllib.request.urlopen(url, timeout=2) as response:
            info = json.loads(response.read().decode("utf-8"))
        browser_ws = info.get("webSocketDebuggerUrl")
        if not isinstance(browser_ws, str) or not browser_ws.startswith("ws://127.0.0.1:"):
            raise policy.PolicyError("browser debugging socket refused")
        async with websockets.connect(browser_ws, max_size=1_000_000, open_timeout=5) as ws:
            await ws.send(
                json.dumps(
                    {
                        "id": 1,
                        "method": "Browser.setDownloadBehavior",
                        "params": {"behavior": "deny", "eventsEnabled": False},
                    }
                )
            )
            raw = await asyncio.wait_for(ws.recv(), 5)
            message = json.loads(raw)
            if "error" in message:
                raise policy.PolicyError("download deny refused")
    except Exception:
        print("download deny failed", flush=True)


def _browser_ws() -> str:
    url = f"http://127.0.0.1:{policy.DEBUG_PORT}/json/version"
    with urllib.request.urlopen(url, timeout=2) as response:
        info = json.loads(response.read().decode("utf-8"))
    browser_ws = info.get("webSocketDebuggerUrl")
    if not isinstance(browser_ws, str) or not browser_ws.startswith("ws://127.0.0.1:"):
        raise policy.PolicyError("browser debugging socket refused")
    return browser_ws


async def serve(page_ws: str) -> None:
    await deny_downloads()
    browser_ws = _browser_ws()
    async with websockets.connect(page_ws, max_size=8_000_000) as cdp, websockets.connect(
        browser_ws, max_size=8_000_000
    ) as browser:
        ENGINE.cdp = cdp
        ENGINE.outbound = asyncio.Queue()
        BRIDGE.ws = browser
        BRIDGE.gate = asyncio.Lock()
        writer = asyncio.create_task(ENGINE.writer())
        reader = asyncio.create_task(ENGINE.reader())
        bridge_reader = asyncio.create_task(BRIDGE.reader())
        await ENGINE.call("Page.enable")
        await ENGINE.call(
            "Page.startScreencast",
            {
                "format": "jpeg",
                "quality": 60,
                "maxWidth": 1280,
                "maxHeight": 800,
                "everyNthFrame": 1,
            },
        )
        try:
            async with websockets.serve(
                session,
                policy.BRIDGE_HOST,
                policy.BRIDGE_PORT,
                process_request=process_request,
                max_size=65536,
                origins=None,
            ):
                await reader
        finally:
            writer.cancel()
            bridge_reader.cancel()


def _stop(proc: subprocess.Popen | None) -> None:
    if proc is None or proc.poll() is not None:
        return
    proc.terminate()
    try:
        proc.wait(timeout=3)
    except subprocess.TimeoutExpired:
        proc.kill()


def main() -> None:
    proxy_port = start_proxy()
    OBSERVER["proxy"] = f"http://127.0.0.1:{proxy_port}"
    proc, xvfb, display = start_chrome(proxy_port)
    try:
        try:
            page_ws = wait_for_devtools(proc)
        except policy.PolicyError:
            if OBSERVER["mode"] != "headed":
                raise
            _stop(proc)
            OBSERVER["mode"] = "headless"
            proc = launch_chrome(proxy_port, False, display)
            page_ws = wait_for_devtools(proc)
        asyncio.run(serve(page_ws))
    finally:
        _stop(proc)
        _stop(xvfb)


if __name__ == "__main__":
    main()
