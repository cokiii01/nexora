# NEXORA sensor node (ESP32)

Prototype status: **simulated**. The backend simulator and `backend/tools/esp32_sim.py` send the exact
payload this firmware sends. Buy the parts below only if you reach the Top 10 — flashing this sketch
then replaces the simulator with zero backend changes.

## Pitch-day demo rig (≈ RM 80–120)

A clear plastic container stands in for a monsoon drain:

```
   [ESP32] ── [JSN-SR04T sensor] mounted on a lid, facing down
                     │
             ┌───────▼───────┐   ← pour water in front of the judges
             │               │     level rises → Alert → Warning → Danger
             │~~~~~~~~~~~~~~~│     dashboard turns red, a work order opens,
             └───────────────┘     residents get the alert (Telegram if set up)
```

Set `DEVICE_ID = "DL-A1"`, `NODE_TYPE = NODE_LEVEL`, and `MOUNT_HEIGHT_M` to the distance from the sensor
face to the container floor. For the demo, scale the thresholds in `backend/township/config.py`
(keys WASPADA/AMARAN/BAHAYA = Alert/Warning/Danger, e.g. 0.08 / 0.12 / 0.16 m for a 20 cm tub), then delete `backend/nexora.db`
so the devices are re-seeded with the new thresholds.

## Parts (approximate Malaysian marketplace prices — check before buying)

| Part | Use | Approx. |
|---|---|---|
| ESP32 DevKit V1 | Wi-Fi microcontroller | RM 25–35 |
| JSN-SR04T waterproof ultrasonic | Drain/pond level, bin fill | RM 25–40 |
| HC-SR04 (indoor alternative) | Cheap level demo | RM 4–8 |
| YF-S201 flow sensor | Bench demo of an inlet meter | RM 12–20 |
| Tipping-bucket rain gauge | Rainfall | RM 60–150 |
| 0–10 bar pressure transducer | Main pressure (WT-04) | RM 35–60 |
| 18650 cell + TP4056 + 6 V solar panel | Off-grid power | RM 30–45 |
| IP65 box + cable glands | Outdoor housing | RM 15–25 |

Real DMA inlet meters are utility-grade (electromagnetic / ultrasonic) with pulse or Modbus output and
cost far more — the ROI page uses RM 4,500 per zone as an editable placeholder.

## Wiring

| Sensor | ESP32 pin | Notes |
|---|---|---|
| Ultrasonic TRIG | GPIO 5 | |
| Ultrasonic ECHO | GPIO 18 | JSN-SR04T outputs 5 V → divide with 1 kΩ / 2 kΩ to 3.3 V |
| Flow meter signal / rain reed switch | GPIO 27 | Internal pull-up enabled |
| Battery sense (optional) | GPIO 34 | 100 kΩ / 100 kΩ divider from the cell |
| Sensor VCC | 5 V (VIN) | Common GND |

## Flash

1. Arduino IDE → Boards Manager → install **esp32 by Espressif** → board **ESP32 Dev Module**.
2. Open `nexora_node/nexora_node.ino`, set Wi-Fi, `API_URL`, `DEVICE_ID`, `NODE_TYPE`.
3. Run the backend so the ESP32 can reach it: `uvicorn main:app --host 0.0.0.0 --port 8000`
   and use your laptop's LAN IP in `API_URL` (same Wi-Fi / phone hotspot).
4. Upload, open Serial Monitor at 115200 — you should see `POST ... -> 200`.
5. In the dashboard **Devices** page the row switches from *Sim* to *ESP32*.

Security: every device has its own `api_key` column in the `devices` table (default `nexora-dev-key`,
override with `NEXORA_DEVICE_KEY`). Give each production node a unique key.
