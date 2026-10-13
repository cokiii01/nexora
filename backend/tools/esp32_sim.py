"""Virtual ESP32 sensor nodes — sends EXACTLY what the real firmware sends.

Use this until the real hardware is bought. It POSTs JSON to /api/v2/ingest with
the X-Device-Key header, just like firmware/nexora_node/nexora_node.ino. While it
runs, the backend marks those devices as source="device" and stops simulating them.

Examples
  python tools/esp32_sim.py                                # drain + flow nodes, normal weather
  python tools/esp32_sim.py --scenario storm               # heavy rain → drain rises → Alert/Warning/Danger
  python tools/esp32_sim.py --scenario burst --zone C      # pipe burst on the Zone C inlet meter
  python tools/esp32_sim.py --url https://your-api.onrender.com --key YOUR_KEY

Only uses the Python standard library.
"""
import argparse
import json
import math
import random
import time
import urllib.error
import urllib.request
from datetime import datetime

DIURNAL = [0.20, 0.08, 0.05, 0.05, 0.12, 0.55, 1.55, 1.95, 1.60, 1.15, 1.00, 0.98,
           1.05, 1.00, 0.92, 0.95, 1.10, 1.45, 1.80, 1.70, 1.35, 1.00, 0.70, 0.40]
ZONE_AVG = {"A": 4.97, "B": 1.70, "C": 5.10}
DRAINS = {"DL-A1": (1.8, 0.12), "DL-B1": (1.5, 0.12), "DL-C1": (3.0, 0.40)}  # depth m, base fraction


def post(url, key, readings):
    body = json.dumps({"readings": readings}).encode()
    req = urllib.request.Request(url.rstrip("/") + "/api/v2/ingest", data=body,
                                 headers={"Content-Type": "application/json", "X-Device-Key": key})
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read())


def main():
    ap = argparse.ArgumentParser(description="NEXORA virtual ESP32 nodes")
    ap.add_argument("--url", default="http://127.0.0.1:8000")
    ap.add_argument("--key", default="nexora-dev-key")
    ap.add_argument("--scenario", choices=["normal", "storm", "burst"], default="normal")
    ap.add_argument("--zone", default="C", choices=["A", "B", "C"], help="zone for the burst scenario")
    ap.add_argument("--every", type=float, default=5.0, help="seconds between transmissions")
    args = ap.parse_args()

    level = {d: depth * base for d, (depth, base) in DRAINS.items()}
    rain = 0.0
    t0 = time.time()
    print(f"NEXORA virtual ESP32 → {args.url}  scenario={args.scenario}  (Ctrl+C to stop)")
    while True:
        elapsed = time.time() - t0
        now = datetime.now()
        h = now.hour + now.minute / 60
        readings = []

        # rain gauge (tipping bucket → mm/h)
        if args.scenario == "storm":
            rain_target = 95 * math.sin(min(math.pi, elapsed / 240 * math.pi))  # 4-minute cloudburst
        else:
            rain_target = 0.0
        rain += (rain_target - rain) * 0.3
        readings.append({"device_id": "RG-01", "value": round(max(0, rain + random.gauss(0, 1) * (rain > 1)), 1)})

        # ultrasonic drain level sensors
        for d, (depth, base) in DRAINS.items():
            target = min(depth * base + min(rain, 120) * depth * 0.9 / 80, depth * 1.25)  # a full channel overflows
            level[d] += (target - level[d]) * 0.12
            readings.append({"device_id": d, "value": round(level[d] + random.gauss(0, 0.004), 3)})

        # inlet flow meters (pulse counter → m³/h)
        for z, avg in ZONE_AVG.items():
            a, b = DIURNAL[int(h) % 24], DIURNAL[(int(h) + 1) % 24]
            flow = avg * (a + (b - a) * (h - int(h))) * (1 + random.gauss(0, 0.04)) + 0.16
            if args.scenario == "burst" and z == args.zone and elapsed > 10:
                flow += 3.5
            readings.append({"device_id": f"FM-{z}", "value": round(flow, 3)})

        for r in readings:
            r["rssi"] = int(random.gauss(-64, 5))
            r["battery"] = round(max(5, 97 - elapsed / 3600), 1)
        try:
            res = post(args.url, args.key, readings)
            summary = "  ".join(f"{r['device_id']}={r['value']}" for r in readings)
            print(f"[{now:%H:%M:%S}] sent {res['accepted']}  {summary}")
        except urllib.error.HTTPError as e:
            print(f"[{now:%H:%M:%S}] HTTP {e.code}: {e.read().decode()[:120]}")
        except Exception as e:  # backend down, wifi drop etc. — keep trying like a real node
            print(f"[{now:%H:%M:%S}] offline ({e}); retrying")
        time.sleep(args.every)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nstopped")
