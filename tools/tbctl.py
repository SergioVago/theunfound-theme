#!/usr/bin/env python3
"""Minimal Thunderbird driver over Marionette (no external deps).

  tbctl.py launch  --profile DIR [--port 2829] [--width 1440 --height 900] [--log FILE] [--no-headless]
  tbctl.py exec    [--port 2829] (--code JS | --file FILE) [--args JSON] [--timeout SEC]
  tbctl.py shot    [--port 2829] --out FILE.png [--window-type mail:3pane] [--size 1440x900]
  tbctl.py quit    [--port 2829]

Scripts run in Marionette's *chrome* context (system principal); `window` is the
current chrome window (by default the first mail:3pane). Scripts are wrapped in
an async function, so top-level `await` works; `return` a value and it is
printed as JSON. `--args` is parsed as JSON and passed as `arguments[0]`.
"""
import argparse, base64, json, os, socket, subprocess, sys, time

TB = os.environ.get("TB_BIN", "/usr/bin/thunderbird")

# Perfil de teste reprodutível: um perfil novo nasce em inglês, abre o
# assistente de conta por cima da janela e a aba de novidades da versão — os
# três estragam qualquer screenshot. Gravado a cada launch (user.js é lido na
# ordem, o último valor vence).
PROFILE_PREFS = """
user_pref("intl.locale.requested", "pt-BR");
user_pref("general.useragent.locale", "pt-BR");
user_pref("mail.provider.suppress_dialog_on_startup", true);
user_pref("mail.spotlight.firstRunDone", true);
user_pref("mail.winsearch.firstRunDone", true);
user_pref("mailnews.start_page_override.mstone", "ignore");
user_pref("mailnews.start_page.enabled", false);
user_pref("mail.rights.version", 1);
user_pref("toolkit.telemetry.reportingpolicy.firstRun", false);
user_pref("datareporting.policy.dataSubmissionPolicyBypassNotification", true);
"""


class Marionette:
    def __init__(self, port, host="127.0.0.1", timeout=600):
        self.sock = socket.create_connection((host, port), timeout=timeout)
        self.buf = b""
        self.msg_id = 0
        self._read()  # handshake

    def _read(self):
        while b":" not in self.buf:
            chunk = self.sock.recv(65536)
            if not chunk:
                raise ConnectionError("marionette closed")
            self.buf += chunk
        n, rest = self.buf.split(b":", 1)
        n = int(n)
        while len(rest) < n:
            chunk = self.sock.recv(1 << 20)
            if not chunk:
                raise ConnectionError("marionette closed")
            rest += chunk
        self.buf = rest[n:]
        return json.loads(rest[:n])

    def cmd(self, name, params=None):
        self.msg_id += 1
        data = json.dumps([0, self.msg_id, name, params or {}]).encode()
        self.sock.sendall(str(len(data)).encode() + b":" + data)
        while True:
            msg = self._read()
            if isinstance(msg, list) and msg[0] == 1 and msg[1] == self.msg_id:
                if msg[2]:
                    raise RuntimeError(json.dumps(msg[2], indent=2))
                return msg[3]

    def start(self, script_timeout_s=300):
        self.cmd("WebDriver:NewSession", {"capabilities": {"alwaysMatch": {"moz:accessibilityChecks": False}}})
        self.cmd("Marionette:SetContext", {"value": "chrome"})
        self.cmd("WebDriver:SetTimeouts", {"script": int(script_timeout_s * 1000)})

    def select_window(self, window_type="mail:3pane"):
        # Window handles are opaque UUIDs, so switch to each one and check the
        # windowtype of its document.
        js = "return document.documentElement.getAttribute('windowtype');"
        handles = self.cmd("WebDriver:GetWindowHandles")
        handles = handles.get("value", handles) if isinstance(handles, dict) else handles
        for h in handles:
            self.cmd("WebDriver:SwitchToWindow", {"handle": h, "focus": True})
            if self.exec(js) == window_type:
                return h
        if handles:
            self.cmd("WebDriver:SwitchToWindow", {"handle": handles[0], "focus": True})
            return handles[0]

    def exec(self, script, args=None):
        res = self.cmd("WebDriver:ExecuteScript", {"script": script, "args": args or [], "newSandbox": True})
        return res.get("value") if isinstance(res, dict) else res

    def close(self):
        try:
            self.cmd("WebDriver:DeleteSession")
        except Exception:
            pass
        self.sock.close()


def wait_port(port, timeout=90):
    end = time.time() + timeout
    while time.time() < end:
        try:
            socket.create_connection(("127.0.0.1", port), timeout=2).close()
            return True
        except OSError:
            time.sleep(0.5)
    return False


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("launch")
    p.add_argument("--profile", required=True)
    p.add_argument("--port", type=int, default=2829)
    p.add_argument("--width", type=int, default=1440)
    p.add_argument("--height", type=int, default=900)
    p.add_argument("--log", default=None)
    p.add_argument("--no-headless", action="store_true")
    p = sub.add_parser("exec")
    p.add_argument("--port", type=int, default=2829)
    p.add_argument("--code")
    p.add_argument("--file")
    p.add_argument("--args", default=None, help="JSON passado ao script como arguments[0]")
    p.add_argument("--timeout", type=float, default=300)
    p.add_argument("--window-type", default="mail:3pane")
    p = sub.add_parser("shot")
    p.add_argument("--port", type=int, default=2829)
    p.add_argument("--out", required=True)
    p.add_argument("--window-type", default="mail:3pane")
    p.add_argument("--size", default=None, help="redimensiona a janela antes, ex. 1440x900")
    p = sub.add_parser("quit")
    p.add_argument("--port", type=int, default=2829)
    a = ap.parse_args()

    if a.cmd == "launch":
        prof = os.path.abspath(a.profile)
        with open(os.path.join(prof, "user.js"), "a") as f:
            f.write(f'\nuser_pref("marionette.port", {a.port});\n')
            f.write(PROFILE_PREFS)
        env = dict(os.environ)
        if not a.no_headless:
            env.update(MOZ_HEADLESS="1", MOZ_HEADLESS_WIDTH=str(a.width), MOZ_HEADLESS_HEIGHT=str(a.height))
        log = open(a.log or os.path.join(prof, "tbctl.log"), "ab")
        proc = subprocess.Popen(
            [TB, "--no-remote", "--profile", prof, "--marionette", "--remote-allow-system-access"]
            + ([] if a.no_headless else ["--headless"]),
            env=env, stdout=log, stderr=subprocess.STDOUT, start_new_session=True,
        )
        if not wait_port(a.port):
            print(json.dumps({"ok": False, "pid": proc.pid, "error": "marionette port not up"}))
            sys.exit(1)
        print(json.dumps({"ok": True, "pid": proc.pid, "port": a.port}))
        return

    m = Marionette(a.port)
    if a.cmd == "quit":
        m.cmd("WebDriver:NewSession", {"capabilities": {}})
        try:
            m.cmd("Marionette:Quit", {"flags": ["eForceQuit"]})
        except Exception:
            pass
        print(json.dumps({"ok": True}))
        return
    try:
        m.start(getattr(a, "timeout", 300))
        if a.cmd == "exec":
            m.select_window(a.window_type)
            code = a.code if a.code is not None else open(a.file).read()
            # Wrap in an async function so scripts can use top-level await.
            code = "return (async () => {\n" + code + "\n})();"
            args = [json.loads(a.args)] if a.args else []
            print(json.dumps(m.exec(code, args), indent=2, ensure_ascii=False, default=str))
        elif a.cmd == "shot":
            m.select_window(a.window_type)
            if a.size:
                w, h = (int(v) for v in a.size.lower().split("x"))
                m.exec(
                    "window.resizeTo(arguments[0], arguments[1]);"
                    "return new Promise(r => setTimeout(r, 400));",
                    [w, h],
                )
            res = m.cmd("WebDriver:TakeScreenshot", {"id": None, "full": False, "hash": False})
            data = res.get("value", res) if isinstance(res, dict) else res
            with open(a.out, "wb") as f:
                f.write(base64.b64decode(data))
            print(json.dumps({"ok": True, "out": a.out}))
        elif a.cmd == "quit":
            try:
                m.cmd("Marionette:Quit", {"flags": ["eForceQuit"]})
            except Exception:
                pass
            print(json.dumps({"ok": True}))
            return
    finally:
        if a.cmd != "quit":
            m.close()


if __name__ == "__main__":
    main()
