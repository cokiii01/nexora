/*
  NEXORA sensor node — ESP32
  --------------------------------------------------------------
  One sketch, three node types (set NODE_TYPE below):
    NODE_LEVEL  JSN-SR04T / HC-SR04 ultrasonic → water level (m) in a drain or pond, or bin fill (%)
    NODE_FLOW   YF-S201 / pulse-output flow meter → flow (m³/h)
    NODE_RAIN   tipping-bucket rain gauge (reed switch) → rainfall (mm/h)

  Sends JSON to the NEXORA backend exactly like backend/tools/esp32_sim.py:
    POST {API_URL}/api/v2/ingest
    Header  X-Device-Key: <DEVICE_KEY>
    Body    {"device_id":"DL-A1","value":1.23,"rssi":-61,"battery":92.0}

  Board: "ESP32 Dev Module" (Arduino IDE → Boards Manager → esp32 by Espressif).
  Libraries: none beyond the ESP32 core (WiFi, HTTPClient).
*/

#include <WiFi.h>
#include <HTTPClient.h>

// ======================= CONFIGURE ME =======================
const char* WIFI_SSID   = "YOUR_WIFI";
const char* WIFI_PASS   = "YOUR_PASSWORD";
const char* API_URL     = "http://192.168.1.50:8000";   // laptop IP running uvicorn --host 0.0.0.0, or your Render URL
const char* DEVICE_KEY  = "nexora-dev-key";             // must match the device's api_key in the backend
const char* DEVICE_ID   = "DL-A1";                      // DL-A1 / DL-B1 / DL-C1 / BIN-01..12 / FM-A.. / RG-01

#define NODE_LEVEL 1
#define NODE_FLOW  2
#define NODE_RAIN  3
#define NODE_TYPE  NODE_LEVEL

// Level node: distance from the sensor face to the drain bed (empty), metres.
// value sent = MOUNT_HEIGHT_M - measured distance  (water depth)
const float MOUNT_HEIGHT_M = 1.80;
// Bin mode: set true for BIN-xx devices — value sent = % full
const bool  BIN_MODE = false;
const float BIN_DEPTH_M = 1.00;     // lid sensor → bin floor

// Flow node: pulses per litre for your meter (YF-S201 ≈ 450 pulses/L, i.e. F = 7.5 × L/min)
const float PULSES_PER_LITRE = 450.0;

// Rain node: mm of rain per bucket tip (check your gauge, commonly 0.2 mm)
const float MM_PER_TIP = 0.2;

const uint32_t SEND_EVERY_MS = 30000;   // 30 s — fine for drains; use 60 s+ on battery
// ============================================================

// Pins
const int PIN_TRIG  = 5;    // ultrasonic trigger
const int PIN_ECHO  = 18;   // ultrasonic echo (JSN-SR04T is 5 V: use a divider 1k/2k to 3.3 V)
const int PIN_PULSE = 27;   // flow meter signal or rain gauge reed switch (INPUT_PULLUP)
const int PIN_BATT  = 34;   // battery voltage via 100k/100k divider (optional)

volatile uint32_t pulseCount = 0;
volatile uint32_t lastPulseUs = 0;

void IRAM_ATTR onPulse() {
  uint32_t now = micros();
  // reed switches bounce: ignore edges closer than 20 ms for the rain gauge
  if (NODE_TYPE == NODE_RAIN && now - lastPulseUs < 20000) return;
  lastPulseUs = now;
  pulseCount++;
}

float readDistanceM() {
  // median of 5 pings to reject splashes / echoes
  float d[5];
  for (int i = 0; i < 5; i++) {
    digitalWrite(PIN_TRIG, LOW);  delayMicroseconds(4);
    digitalWrite(PIN_TRIG, HIGH); delayMicroseconds(20);
    digitalWrite(PIN_TRIG, LOW);
    unsigned long us = pulseIn(PIN_ECHO, HIGH, 30000UL);  // timeout ≈ 5 m
    d[i] = us ? (us * 0.0343f / 2.0f) / 100.0f : NAN;
    delay(60);
  }
  // simple insertion sort, NaNs to the end
  for (int i = 1; i < 5; i++) { float k = d[i]; int j = i - 1;
    while (j >= 0 && (isnan(d[j]) || (!isnan(k) && d[j] > k))) { d[j + 1] = d[j]; j--; } d[j + 1] = k; }
  return d[2];
}

float readBatteryPct() {
  int raw = analogRead(PIN_BATT);
  if (raw < 100) return -1;                         // no divider fitted
  float v = raw / 4095.0f * 3.3f * 2.0f;            // 100k/100k divider
  return constrain((v - 3.3f) / (4.2f - 3.3f) * 100.0f, 0, 100);  // Li-ion 3.3–4.2 V
}

void connectWifi() {
  if (WiFi.status() == WL_CONNECTED) return;
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("WiFi");
  for (int i = 0; i < 40 && WiFi.status() != WL_CONNECTED; i++) { delay(250); Serial.print("."); }
  Serial.println(WiFi.status() == WL_CONNECTED ? " connected" : " failed");
}

bool sendReading(float value) {
  connectWifi();
  if (WiFi.status() != WL_CONNECTED) return false;
  HTTPClient http;
  http.begin(String(API_URL) + "/api/v2/ingest");
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Key", DEVICE_KEY);
  float batt = readBatteryPct();
  String body = String("{\"device_id\":\"") + DEVICE_ID + "\",\"value\":" + String(value, 3) +
                ",\"rssi\":" + WiFi.RSSI() + (batt >= 0 ? ",\"battery\":" + String(batt, 1) : "") + "}";
  int code = http.POST(body);
  Serial.printf("POST %s -> %d\n", body.c_str(), code);
  http.end();
  return code == 200;
}

uint32_t lastSend = 0;
uint32_t windowStart = 0;

void setup() {
  Serial.begin(115200);
  pinMode(PIN_TRIG, OUTPUT);
  pinMode(PIN_ECHO, INPUT);
  pinMode(PIN_PULSE, INPUT_PULLUP);
  analogReadResolution(12);
  if (NODE_TYPE != NODE_LEVEL) attachInterrupt(digitalPinToInterrupt(PIN_PULSE), onPulse, FALLING);
  connectWifi();
  windowStart = millis();
}

void loop() {
  uint32_t now = millis();
  if (now - lastSend < SEND_EVERY_MS) { delay(50); return; }

  float value = NAN;
  float hours = (now - windowStart) / 3600000.0f;

  if (NODE_TYPE == NODE_LEVEL) {
    float dist = readDistanceM();
    if (!isnan(dist)) {
      value = BIN_MODE ? constrain((BIN_DEPTH_M - dist) / BIN_DEPTH_M * 100.0f, 0, 100)
                       : max(0.0f, MOUNT_HEIGHT_M - dist);
    }
  } else {
    noInterrupts(); uint32_t n = pulseCount; pulseCount = 0; interrupts();
    if (NODE_TYPE == NODE_FLOW) value = (n / PULSES_PER_LITRE) / 1000.0f / hours;   // m³/h
    else                        value = (n * MM_PER_TIP) / hours;                   // mm/h
  }
  windowStart = now;
  lastSend = now;

  if (isnan(value)) { Serial.println("sensor read failed — check wiring"); return; }
  if (!sendReading(value)) Serial.println("send failed — will retry next cycle");
}
