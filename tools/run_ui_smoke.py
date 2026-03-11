import argparse
import json
import socket
import subprocess
import sys
import tempfile
import threading
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_BROWSER_CANDIDATES = [
    Path(r"C:\Program Files\Google\Chrome\Application\chrome.exe"),
    Path(r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"),
    Path(r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"),
    Path(r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"),
]


class SmokeReportStore:
    def __init__(self):
        self._event = threading.Event()
        self.payload = None
        self.requests = []

    def set(self, payload):
        self.payload = payload
        self._event.set()

    def wait(self, timeout):
        return self._event.wait(timeout)

    def note_request(self, method, path):
        self.requests.append((method, path, time.time()))


def detect_browser(explicit_path=None):
    if explicit_path:
      candidate = Path(explicit_path)
      if candidate.exists():
          return candidate
      raise FileNotFoundError(f"Browser not found: {explicit_path}")

    for candidate in DEFAULT_BROWSER_CANDIDATES:
        if candidate.exists():
            return candidate
    raise FileNotFoundError("No supported browser found (Chrome/Edge)")


def create_handler(web_root, report_store):
    class Handler(SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(web_root), **kwargs)

        def do_POST(self):
            parsed = urlparse(self.path)
            report_store.note_request("POST", parsed.path)
            if parsed.path != "/__smoke_report":
                self.send_error(404, "Not Found")
                return

            length = int(self.headers.get("Content-Length", "0"))
            raw = self.rfile.read(length).decode("utf-8")
            payload = json.loads(raw or "{}")
            report_store.set(payload)

            body = json.dumps({"ok": True}).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):
            parsed = urlparse(self.path)
            report_store.note_request("GET", parsed.path)
            super().do_GET()

        def log_message(self, format, *args):
            return

    return Handler


def start_server(web_root, report_store):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]

    server = ThreadingHTTPServer(("127.0.0.1", port), create_handler(web_root, report_store))
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server, port


def wait_for_server(port, timeout):
    deadline = time.time() + timeout
    while time.time() < deadline:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.settimeout(0.5)
            try:
                sock.connect(("127.0.0.1", port))
                return
            except OSError:
                time.sleep(0.1)
    raise TimeoutError(f"Server did not start on port {port}")


def launch_browser(browser_path, url, stderr_path, profile_dir):
    args = [
        str(browser_path),
        "--headless=new",
        "--disable-gpu",
        "--no-sandbox",
        "--no-first-run",
        "--no-default-browser-check",
        f"--user-data-dir={profile_dir}",
        "--disable-extensions",
        "--disable-sync",
        "--disable-background-networking",
        "--disable-default-apps",
        "--metrics-recording-only",
        "--disable-crash-reporter",
        "--disable-crashpad",
        "--disable-breakpad",
        "--window-size=1440,1600",
        url,
    ]
    stderr_file = open(stderr_path, "w", encoding="utf-8")
    return subprocess.Popen(args, stdout=subprocess.DEVNULL, stderr=stderr_file), stderr_file


def print_summary(payload):
    title = payload.get("title", "SMOKE")
    print(title)
    for result in payload.get("results", []):
        marker = "PASS" if result.get("ok") else "FAIL"
        print(f"[{marker}] {result.get('name')}")
        print(result.get("detail", "").strip())


def read_text(path):
    if not path.exists():
        return ""
    return path.read_text(encoding="utf-8", errors="ignore")


def main():
    parser = argparse.ArgumentParser(description="Run browser-based UI smoke harness")
    parser.add_argument("--browser", help="Explicit browser executable path")
    parser.add_argument("--timeout", type=float, default=25.0, help="Seconds to wait for smoke report")
    args = parser.parse_args()

    browser_path = detect_browser(args.browser)
    report_store = SmokeReportStore()
    server, port = start_server(REPO_ROOT, report_store)
    browser_proc = None
    browser_stderr_file = None
    browser_stderr_path = Path(tempfile.gettempdir()) / "ui-smoke-browser.log"
    profile_dir = Path(tempfile.mkdtemp(prefix="ui-smoke-profile-"))

    try:
        wait_for_server(port, 3.0)
        smoke_url = f"http://127.0.0.1:{port}/smoke.html?reportUrl=%2F__smoke_report"
        browser_proc, browser_stderr_file = launch_browser(browser_path, smoke_url, browser_stderr_path, profile_dir)

        if not report_store.wait(args.timeout):
            browser_status = browser_proc.poll() if browser_proc else None
            stderr_tail = read_text(browser_stderr_path)[-4000:]
            requests = "\n".join(f"{method} {path}" for method, path, _ in report_store.requests[-20:])
            message = [
                f"Timed out waiting for smoke report after {args.timeout} seconds",
                f"Browser exit code: {browser_status}",
                f"Observed requests:\n{requests or '(none)'}",
                f"Browser stderr tail:\n{stderr_tail or '(empty)'}",
            ]
            raise TimeoutError("\n\n".join(message))

        payload = report_store.payload or {}
        print_summary(payload)
        return 0 if payload.get("ok") else 1
    finally:
        if browser_stderr_file:
            browser_stderr_file.close()
        if browser_proc and browser_proc.poll() is None:
            browser_proc.terminate()
            try:
                browser_proc.wait(timeout=3)
            except subprocess.TimeoutExpired:
                browser_proc.kill()
        server.shutdown()
        server.server_close()
        for child in profile_dir.glob("**/*"):
            if child.is_file():
                try:
                    child.unlink()
                except OSError:
                    pass
        for child in sorted(profile_dir.glob("**/*"), reverse=True):
            if child.is_dir():
                try:
                    child.rmdir()
                except OSError:
                    pass
        try:
            profile_dir.rmdir()
        except OSError:
            pass


if __name__ == "__main__":
    sys.exit(main())
