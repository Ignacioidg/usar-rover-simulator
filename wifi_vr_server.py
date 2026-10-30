# wifi_vr_server.py - Servidor Local Wi-Fi de Baja Latencia para Casco VR Móvil (Celular)
# Simulador 3D USAR Rover "SAR RESCUE" • Grupo 4 UAI (Octubre 2026)
# No requiere librerías externas (100% Python Standard Library)

import json
import os
import re
import socket
import subprocess
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PORT = 8090
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

STREAM_STATE = {
    "active": False,
    "seq": 0,
    "last_push_ts": 0.0,
    "fps": 25,
    "frame_data_url": None,
    "telemetry": None,
    "headtrack": {"enabled": False, "yaw": 0.0, "pitch": 0.0, "ts": 0.0},
    "clients_seen": {}
}


def get_local_ipv4_addresses():
    ips = []
    # 1. Sondeo por socket UDP saliente (detecta la interfaz Wi-Fi/LAN principal)
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(0.2)
        s.connect(("8.8.8.8", 80))
        primary = s.getsockname()[0]
        s.close()
        if primary and not primary.startswith("127."):
            ips.append(primary)
    except Exception:
        pass

    # 2. Interfaces por hostname
    try:
        _, _, host_ips = socket.gethostbyname_ex(socket.gethostname())
        for ip in host_ips:
            if ip and not ip.startswith("127.") and ip not in ips:
                ips.append(ip)
    except Exception:
        pass

    # 3. Parseo de ipconfig en Windows (captura Hotspots móviles y adaptadores Wi-Fi secundarios)
    if os.name == "nt":
        try:
            out = subprocess.check_output("ipconfig", shell=True, stderr=subprocess.DEVNULL).decode("latin-1", errors="ignore")
            for match in re.findall(r"(?:IPv4|Direcci[^\n:]*IPv4)[^\n:]*:\s*([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)", out, re.IGNORECASE):
                if not match.startswith("127.") and not match.startswith("169.254.") and match not in ips:
                    ips.append(match)
        except Exception:
            pass

    if not ips:
        ips.append("127.0.0.1")
    return ips


class VRStreamHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE_DIR, **kwargs)

    def log_message(self, format, *args):
        # Silenciar logs repetitivos de /api/ para mantener la consola limpia
        if self.path.startswith("/api/"):
            return
        super().log_message(format, *args)

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def _send_json(self, payload, status=200):
        raw = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self):
        now = time.time()
        # Desactivar automáticamente si el simulador dejó de transmitir hace >3.5s
        if STREAM_STATE["active"] and (now - STREAM_STATE["last_push_ts"] > 3.5):
            STREAM_STATE["active"] = False

        clean_path = self.path.split("?")[0]

        if clean_path in ("/vr", "/vr/"):
            self.path = "/vr.html"
            return super().do_GET()

        if clean_path == "/api/info":
            ips = get_local_ipv4_addresses()
            urls = [f"http://{ip}:{PORT}/vr" for ip in ips]
            # Limpiar clientes móviles inactivos (>5s)
            active_clients = [
                ip for ip, ts in list(STREAM_STATE["clients_seen"].items()) if now - ts < 5.0
            ]
            ht_fresh = (now - STREAM_STATE["headtrack"]["ts"]) < 2.0
            return self._send_json({
                "ok": True,
                "port": PORT,
                "ips": ips,
                "urls": urls,
                "active": STREAM_STATE["active"],
                "clientsCount": len(active_clients),
                "headtrack": STREAM_STATE["headtrack"] if ht_fresh else {"enabled": False, "yaw": 0, "pitch": 0}
            })

        if clean_path == "/api/bundle":
            client_ip = self.client_address[0] if self.client_address else "unknown"
            if client_ip not in ("127.0.0.1", "::1"):
                STREAM_STATE["clients_seen"][client_ip] = now
            else:
                STREAM_STATE["clients_seen"]["local-test"] = now

            return self._send_json({
                "active": STREAM_STATE["active"],
                "seq": STREAM_STATE["seq"],
                "fps": STREAM_STATE["fps"],
                "frameDataUrl": STREAM_STATE["frame_data_url"] if STREAM_STATE["active"] else None,
                "telemetry": STREAM_STATE["telemetry"]
            })

        return super().do_GET()

    def do_POST(self):
        clean_path = self.path.split("?")[0]
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length) if length > 0 else b"{}"

        try:
            data = json.loads(body.decode("utf-8"))
        except Exception:
            data = {}

        now = time.time()

        if clean_path == "/api/push":
            is_active = bool(data.get("active", False))
            STREAM_STATE["active"] = is_active
            STREAM_STATE["last_push_ts"] = now
            if is_active:
                if "frameDataUrl" in data:
                    STREAM_STATE["frame_data_url"] = data["frameDataUrl"]
                    STREAM_STATE["seq"] += 1
                if "telemetry" in data:
                    STREAM_STATE["telemetry"] = data["telemetry"]
                if "fps" in data:
                    STREAM_STATE["fps"] = data["fps"]
            else:
                STREAM_STATE["frame_data_url"] = None

            active_clients = sum(1 for ts in STREAM_STATE["clients_seen"].values() if now - ts < 5.0)
            ht_fresh = (now - STREAM_STATE["headtrack"]["ts"]) < 2.0
            return self._send_json({
                "ok": True,
                "seq": STREAM_STATE["seq"],
                "clientsCount": active_clients,
                "headtrack": STREAM_STATE["headtrack"] if ht_fresh else None
            })

        if clean_path == "/api/headtrack":
            STREAM_STATE["headtrack"] = {
                "enabled": True,
                "yaw": float(data.get("yaw", 0.0)),
                "pitch": float(data.get("pitch", 0.0)),
                "ts": now
            }
            return self._send_json({"ok": True})

        return self._send_json({"ok": False, "error": "Unknown endpoint"}, status=404)


if __name__ == "__main__":
    ips = get_local_ipv4_addresses()
    print("=" * 68)
    print(" 🥽 SERVIDOR DE STREAMING VR WI-FI • USAR ROVER 'SAR RESCUE' (UAI)")
    print("=" * 68)
    print(f" Simulador en PC : http://localhost:{PORT}")
    print(" URLs para el Celular (Casco VR) conectado al mismo Wi-Fi / Hotspot:")
    for ip in ips:
        print(f"   👉 http://{ip}:{PORT}/vr")
    print("=" * 68)
    print(" Recordá activar el botón '📡 VR WIFI' (Tecla K) dentro del simulador.")

    server = ThreadingHTTPServer(("0.0.0.0", PORT), VRStreamHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor detenido.")
