import asyncio

import json

import os

import random

from datetime import datetime

import joblib

import numpy as np

from fastapi import FastAPI, WebSocket, WebSocketDisconnect

from fastapi.middleware.cors import CORSMiddleware

# =========================================================

# NEXORA

# REAL-TIME DATA GATEWAY

# PREDICTIVE MAINTENANCE

# GENERATIVE WORK ORDER + AUTO-DISPATCH

# AGENTIC AI ORCHESTRATION

# ENTERPRISE IOT DATA PIPELINE

# =========================================================

app = FastAPI(

    title="NEXORA Township Intelligence API",

    version="5.0.0",

)

# =========================================================

# CORS

# =========================================================

app.add_middleware(

    CORSMiddleware,

    allow_origins=[

        "http://localhost:5173",

        "http://127.0.0.1:5173",

        "http://localhost:4173",

        *[o.strip() for o in os.environ.get("NEXORA_CORS_ORIGINS", "").split(",") if o.strip()],

    ],

    # any localhost / LAN port (Vite may pick 5174, 5175… if 5173 is busy; phones on the same Wi-Fi)
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?",

    allow_credentials=True,

    allow_methods=["*"],

    allow_headers=["*"],

)

# =========================================================

# LOAD ML MODEL

# =========================================================

BASE_DIR = os.path.dirname(

    os.path.abspath(__file__)

)

MODEL_PATH = os.path.join(

    BASE_DIR,

    "models",

    "water_failure_model.joblib",

)

if not os.path.exists(MODEL_PATH):

    raise RuntimeError(

        "NEXORA predictive model not found. "

        "Run 'py train_model.py' first."

    )

model_bundle = joblib.load(

    MODEL_PATH

)

predictive_model = model_bundle[

    "model"

]

MODEL_FEATURES = model_bundle[

    "features"

]

MODEL_ACCURACY = model_bundle[

    "accuracy"

]

MODEL_TYPE = model_bundle[

    "model_type"

]

MODEL_TRAINING_SOURCE = model_bundle[

    "training_source"

]

MODEL_SAMPLE_COUNT = model_bundle[

    "sample_count"

]

print()

print("=" * 70)

print("NEXORA TOWNSHIP INTELLIGENCE BACKEND")

print("=" * 70)

print(

    "Real-Time Data Gateway       : ONLINE"

)

print(

    "Predictive Maintenance       : ONLINE"

)

print(

    "Work Order Engine            : ONLINE"

)

print(

    "Auto-Dispatch Recommender    : ONLINE"

)

print(

    "Agentic AI Orchestrator      : ONLINE"

)

print(

    "IoT Enterprise Pipeline      : ONLINE"

)

print(

    "MQTT Ingestion Simulator     : READY"

)

print(

    "Kafka-style Event Bus        : READY"

)

print(

    f"ML Model                     : {MODEL_TYPE}"

)

print(

    f"Model Accuracy               : {MODEL_ACCURACY * 100:.2f}%"

)

print(

    f"Training Source              : {MODEL_TRAINING_SOURCE}"

)

print(

    f"Training Samples             : {MODEL_SAMPLE_COUNT}"

)

print("=" * 70)

print()

# =========================================================

# SENSOR STATE

# =========================================================

sensor_state = {

    "WT-03": {
        "sensor_id": "WT-03",
        "type": "Water Flow Sensor",
        "zone": "Zone C",
        "value": 124.0,
        "unit": "L/min",
        "status": "NORMAL",
    },

    "WT-04": {

        "sensor_id": "WT-04",

        "type": "Water Pressure Sensor",

        "zone": "Zone C",

        "value": 3.2,

        "unit": "bar",

        "status": "NORMAL",

        "flow_rate": 124.0,

        "vibration": 0.18,

        "temperature": 29.0,

        "pressure_drop_rate": 0.02,

        "anomaly_count": 0,

    }
,
    "EN-12": {
        "sensor_id": "EN-12",
        "type": "Energy Monitor",
        "zone": "Zone A",
        "value": 428.0,
        "unit": "kW",
        "status": "NORMAL",
        "grid_load_percent": 68.0,
    },
    "TR-08": {
        "sensor_id": "TR-08",
        "type": "Traffic Flow Sensor",
        "zone": "Zone B",
        "value": 64,
        "unit": "veh/min",
        "status": "NORMAL",
        "average_speed_kmh": 43,
        "occupancy_percent": 58,
    }

}

# =========================================================

# ENTERPRISE IOT DATA PIPELINE STATE

# =========================================================

IOT_DEVICES = {

    "WT-03": {"device_id":"WT-03","name":"Water Flow Sensor","zone":"Zone C","category":"WATER","topic":"township/water/WT-03","event_topic":"township.water.telemetry","unit":"L/min","protocol":"MQTT","status":"ONLINE"},

    "WT-04": {"device_id":"WT-04","name":"Water Pressure Sensor","zone":"Zone C","category":"WATER","topic":"township/water/WT-04","event_topic":"township.water.telemetry","unit":"bar","protocol":"MQTT","status":"ONLINE"},

    "EN-12": {"device_id":"EN-12","name":"Energy Monitor","zone":"Zone A","category":"ENERGY","topic":"township/energy/EN-12","event_topic":"township.energy.telemetry","unit":"kW","protocol":"MQTT","status":"ONLINE"},

    "TR-08": {"device_id":"TR-08","name":"Traffic Flow Sensor","zone":"Zone B","category":"TRAFFIC","topic":"township/traffic/TR-08","event_topic":"township.traffic.telemetry","unit":"veh/min","protocol":"MQTT","status":"ONLINE"},

    "SL-204": {"device_id":"SL-204","name":"Smart Lighting Controller","zone":"Zone B","category":"LIGHTING","topic":"township/lighting/SL-204","event_topic":"township.lighting.telemetry","unit":"%","protocol":"MQTT","status":"ONLINE"},

}

iot_events = []

iot_event_counter = 1

iot_pipeline_task = None

iot_pipeline_running = False

iot_pipeline_started_at = None

IOT_PIPELINE_ARCHITECTURE = {

    "device_layer": "Virtual township IoT devices",

    "ingestion_layer": "MQTT-style topic ingestion",

    "event_bus": "Kafka-style simulated event distribution",

    "gateway": "NEXORA FastAPI Real-Time Gateway",

    "consumers": ["Digital Twin","Predictive Maintenance","Agentic AI","Operations","Historical Analytics"],

    "prototype_note": "MQTT and Kafka behaviour are simulated in-process for the hackathon prototype; no external broker is claimed.",

}

# =========================================================

# RESPONSE TEAMS

# =========================================================

response_teams = [

    {

        "id": "TEAM-WATER-02",

        "name": "Utility Response 02",

        "specialization": "Water Infrastructure",

        "zone": "Zone C",

        "status": "AVAILABLE",

        "active_jobs": 0,

        "response_score": 96,

    },

    {

        "id": "TEAM-CIVIL-01",

        "name": "Civil Works 01",

        "specialization": "Road Maintenance",

        "zone": "Zone A",

        "status": "AVAILABLE",

        "active_jobs": 1,

        "response_score": 82,

    },

    {

        "id": "TEAM-ELECTRICAL-03",

        "name": "Electrical Team 03",

        "specialization": "Electrical Infrastructure",

        "zone": "Zone B",

        "status": "AVAILABLE",

        "active_jobs": 0,

        "response_score": 86,

    },

    {

        "id": "TEAM-MOBILITY-01",

        "name": "Mobility Control",

        "specialization": "Traffic Operations",

        "zone": "Zone B",

        "status": "AVAILABLE",

        "active_jobs": 1,

        "response_score": 89,

    },

    {

        "id": "TEAM-EMERGENCY-01",

        "name": "Emergency Response 01",

        "specialization": "Multi-Infrastructure",

        "zone": "Township Wide",

        "status": "AVAILABLE",

        "active_jobs": 0,

        "response_score": 88,

    },

]

# =========================================================

# WORK ORDER STATE

# =========================================================

work_orders = {}

work_order_counter = 1

# =========================================================

# AGENTIC AI STATE

# =========================================================

agent_trace = []

agent_run_counter = 1

AGENT_CONFIG = {

    "DETECTOR": {

        "name": "Detector Agent",

        "role": "Telemetry anomaly detection",

    },

    "RISK": {

        "name": "Risk Agent",

        "role": "Predictive failure assessment",

    },

    "PLANNER": {

        "name": "Planner Agent",

        "role": "Maintenance response planning",

    },

    "DISPATCH": {

        "name": "Dispatch Agent",

        "role": "Response team optimisation",

    },

    "GOVERNANCE": {

        "name": "Governance Gate",

        "role": "Human-in-the-loop authorisation",

    },

}

# =========================================================

# WEBSOCKET CONNECTION MANAGER

# =========================================================

class ConnectionManager:

    def __init__(self):

        self.active_connections: list[

            WebSocket

        ] = []

    async def connect(

        self,

        websocket: WebSocket,

    ):

        await websocket.accept()

        self.active_connections.append(

            websocket

        )

    def disconnect(

        self,

        websocket: WebSocket,

    ):

        if (

            websocket

            in self.active_connections

        ):

            self.active_connections.remove(

                websocket

            )

    async def broadcast(

        self,

        data: dict,

    ):

        dead_connections = []

        for connection in (

            self.active_connections

        ):

            try:

                await connection.send_text(

                    json.dumps(data)

                )

            except Exception:

                dead_connections.append(

                    connection

                )

        for connection in (

            dead_connections

        ):

            self.disconnect(

                connection

            )

manager = ConnectionManager()

# =========================================================

# ENTERPRISE IOT PIPELINE HELPERS

# =========================================================

def _iot_recent_rate():

    now = datetime.now()

    recent = 0

    for event in iot_events[-200:]:

        try:

            ts = datetime.fromisoformat(event["timestamp"])

            if (now - ts).total_seconds() <= 10:

                recent += 1

        except Exception:

            pass

    return round(recent / 10, 1)

def build_iot_pipeline_snapshot():

    online = sum(1 for device in IOT_DEVICES.values() if device["status"] == "ONLINE")

    latencies = [event.get("pipeline_latency_ms",0) for event in iot_events[-50:] if event.get("pipeline_latency_ms") is not None]

    avg_latency = round(sum(latencies)/len(latencies),1) if latencies else 0.0

    return {

        "status": "STREAMING" if iot_pipeline_running else "STANDBY",

        "mqtt_ingestion": "CONNECTED" if iot_pipeline_running else "READY",

        "event_bus": "STREAMING" if iot_pipeline_running else "READY",

        "event_bus_type": "Kafka-style simulated event bus",

        "devices_total": len(IOT_DEVICES),

        "devices_online": online,

        "device_health_percent": round(online/len(IOT_DEVICES)*100,1),

        "events_processed": len(iot_events),

        "ingestion_rate_msg_s": _iot_recent_rate(),

        "average_pipeline_latency_ms": avg_latency,

        "started_at": iot_pipeline_started_at,

        "architecture": IOT_PIPELINE_ARCHITECTURE,

        "timestamp": datetime.now().isoformat(),

    }

async def publish_iot_event(device_id: str, value, status: str="NORMAL", metadata: dict | None=None):

    global iot_event_counter

    device = IOT_DEVICES.get(device_id)

    if not device:

        raise ValueError(f"Unknown IoT device: {device_id}")

    now = datetime.now().isoformat()

    event = {

        "event_id": f"IOT-{iot_event_counter:06d}", "timestamp": now,

        "device_id": device_id, "device_name": device["name"], "zone": device["zone"],

        "category": device["category"], "protocol": "MQTT", "mqtt_topic": device["topic"],

        "event_bus_topic": device["event_topic"], "value": value, "unit": device["unit"],

        "status": status, "pipeline_latency_ms": random.randint(18,65),

        "route": ["DEVICE","MQTT_INGESTION","EVENT_BUS","NEXORA_GATEWAY"],

        "metadata": metadata or {},

    }

    iot_event_counter += 1

    iot_events.append(event)

    if len(iot_events) > 1000:

        del iot_events[:-1000]

    await manager.broadcast({"event":"IOT_PIPELINE_EVENT","timestamp":now,"data":event})

    await manager.broadcast({"event":"IOT_PIPELINE_STATUS","timestamp":now,"data":build_iot_pipeline_snapshot()})

    return event

def generate_virtual_device_reading(device_id: str):

    if device_id == "WT-03":
        # Small natural movement around the normal Zone C water-flow baseline.
        value = round(random.uniform(121.5, 126.5), 1)
        sensor_state["WT-03"]["value"] = value
        sensor_state["WT-03"]["status"] = "NORMAL"
        return value, "NORMAL", {"network": "Zone C Water Network"}

    if device_id == "WT-04":

        s=sensor_state["WT-04"]

        return s["value"],s["status"],{"flow_rate":s["flow_rate"],"vibration":s["vibration"],"temperature":s["temperature"]}

    if device_id == "EN-12":
        s = sensor_state["EN-12"]
        if s["status"] != "NORMAL":
            return s["value"], s["status"], {"grid_load_percent": s["grid_load_percent"], "renewable_share_percent": 18.0}
        return round(random.uniform(405,448),1),"NORMAL",{"grid_load_percent":round(random.uniform(62,78),1),"renewable_share_percent":round(random.uniform(18,28),1)}

    if device_id == "TR-08":
        s = sensor_state["TR-08"]
        if s["status"] != "NORMAL":
            return s["value"], s["status"], {"average_speed_kmh": s["average_speed_kmh"], "occupancy_percent": s["occupancy_percent"]}
        value=random.randint(52,76)
        return value,("WARNING" if value>=73 else "NORMAL"),{"average_speed_kmh":random.randint(31,49),"occupancy_percent":random.randint(45,76)}

    if device_id == "SL-204":

        return random.randint(72,100),"NORMAL",{"lamp_state":"ON","power_w":random.randint(42,58)}

    raise ValueError(f"Unknown IoT device: {device_id}")

async def run_iot_pipeline():

    global iot_pipeline_running

    devices=["WT-03","WT-04","EN-12","TR-08","SL-204"]

    index=0

    while iot_pipeline_running:

        device_id=devices[index % len(devices)]; index += 1

        value,status,metadata=generate_virtual_device_reading(device_id)

        await publish_iot_event(device_id,value,status,{**metadata,"producer":"NEXORA Virtual IoT Device"})

        await asyncio.sleep(0.8)

# =========================================================

# AGENTIC AI TRACE HELPERS

# =========================================================

def create_agent_trace(

    agent: str,

    action: str,

    status: str = "COMPLETED",

    details: dict | None = None,

    run_id: str | None = None,

):

    trace = {

        "trace_id": f"TRACE-{len(agent_trace) + 1:04d}",

        "run_id": run_id,

        "timestamp": datetime.now().isoformat(),

        "agent": agent,

        "agent_name": AGENT_CONFIG.get(agent, {}).get("name", agent),

        "role": AGENT_CONFIG.get(agent, {}).get("role", "NEXORA Intelligence"),

        "action": action,

        "status": status,

        "details": details or {},

    }

    agent_trace.append(trace)

    if len(agent_trace) > 200:

        del agent_trace[:-200]

    return trace

async def broadcast_agent_trace(

    agent: str,

    action: str,

    status: str = "COMPLETED",

    details: dict | None = None,

    run_id: str | None = None,

):

    trace = create_agent_trace(

        agent=agent,

        action=action,

        status=status,

        details=details,

        run_id=run_id,

    )

    await manager.broadcast({

        "event": "AGENT_TRACE",

        "timestamp": trace["timestamp"],

        "data": trace,

    })

    return trace

# =========================================================

# PREDICTIVE MAINTENANCE ENGINE

# =========================================================

def calculate_failure_risk(

    sensor: dict,

):

    features = np.array(

        [

            [

                sensor["value"],

                sensor["flow_rate"],

                sensor["vibration"],

                sensor["temperature"],

                sensor[

                    "pressure_drop_rate"

                ],

                sensor["anomaly_count"],

            ]

        ],

        dtype=float,

    )

    probability = (

        predictive_model.predict_proba(

            features

        )[0][1]

    )

    return round(

        float(probability) * 100,

        1,

    )

def classify_risk(

    probability: float,

):

    if probability >= 80:

        return "CRITICAL"

    if probability >= 55:

        return "HIGH"

    if probability >= 30:

        return "MODERATE"

    return "LOW"

def estimate_failure_window(

    probability: float,

):

    if probability >= 90:

        return "24–48 hours"

    if probability >= 75:

        return "2–5 days"

    if probability >= 50:

        return "5–14 days"

    return "No imminent failure"

def get_recommended_action(

    probability: float,

):

    if probability >= 90:

        return (

            "Inspect Zone C water pressure "

            "network immediately and dispatch "

            "maintenance team."

        )

    if probability >= 75:

        return (

            "Schedule priority inspection "

            "of WT-04 and monitor pressure "

            "degradation."

        )

    if probability >= 50:

        return (

            "Increase monitoring frequency "

            "and perform preventive inspection."

        )

    return (

        "Continue normal monitoring."

    )

def build_predictive_analysis(

    sensor: dict,

):

    probability = (

        calculate_failure_risk(

            sensor

        )

    )

    return {

        "failure_probability":

            probability,

        "risk_level":

            classify_risk(

                probability

            ),

        "predicted_failure_window":

            estimate_failure_window(

                probability

            ),

        "recommended_action":

            get_recommended_action(

                probability

            ),

    }

# =========================================================

# AUTO-DISPATCH RECOMMENDER

# =========================================================

def select_response_team(

    incident_type: str,

    zone: str,

):

    scored_teams = []

    for team in response_teams:

        score = team[

            "response_score"

        ]

        reasons = []

        # ---------------------------------------------

        # SPECIALISATION

        # ---------------------------------------------

        if (

            incident_type

            == "WATER_FAILURE"

            and team[

                "specialization"

            ]

            == "Water Infrastructure"

        ):

            score += 35

            reasons.append(

                "Water infrastructure specialist"

            )

        elif (

            team["specialization"]

            == "Multi-Infrastructure"

        ):

            score += 15

            reasons.append(

                "Multi-infrastructure capability"

            )

        # ---------------------------------------------

        # ZONE

        # ---------------------------------------------

        if (

            team["zone"]

            == zone

        ):

            score += 20

            reasons.append(

                "Already positioned in affected zone"

            )

        elif (

            team["zone"]

            == "Township Wide"

        ):

            score += 10

            reasons.append(

                "Township-wide response coverage"

            )

        # ---------------------------------------------

        # AVAILABILITY

        # ---------------------------------------------

        if (

            team["status"]

            == "AVAILABLE"

        ):

            score += 15

            reasons.append(

                "Currently available"

            )

        else:

            score -= 30

            reasons.append(

                "Currently deployed"

            )

        # ---------------------------------------------

        # WORKLOAD

        # ---------------------------------------------

        workload_penalty = (

            team["active_jobs"] * 10

        )

        score -= workload_penalty

        if team["active_jobs"] == 0:

            reasons.append(

                "No active assignments"

            )

        else:

            reasons.append(

                f'{team["active_jobs"]} active assignment(s)'

            )

        scored_teams.append(

            {

                **team,

                "dispatch_score":

                    score,

                "selection_reasons":

                    reasons,

            }

        )

    scored_teams.sort(

        key=lambda team:

            team[

                "dispatch_score"

            ],

        reverse=True,

    )

    return (

        scored_teams[0],

        scored_teams,

    )

# =========================================================

# GENERATIVE WORK ORDER ENGINE

# =========================================================

def generate_work_order(

    sensor: dict,

    analysis: dict,

):

    global work_order_counter

    # ---------------------------------------------

    # PREVENT DUPLICATE ACTIVE WORK ORDER

    # ---------------------------------------------

    for work_order in (

        work_orders.values()

    ):

        if (

            work_order["sensor_id"]

            == sensor["sensor_id"]

            and work_order["status"]

            in [

                "PENDING_APPROVAL",

                "APPROVED",

                "DISPATCHED",

                "IN_PROGRESS",

            ]

        ):

            return work_order

    # ---------------------------------------------

    # SELECT TEAM

    # ---------------------------------------------

    selected_team, ranking = (

        select_response_team(

            incident_type=

                "WATER_FAILURE",

            zone=

                sensor["zone"],

        )

    )

    # ---------------------------------------------

    # GENERATE ID

    # ---------------------------------------------

    work_order_id = (

        f"WO-2026-"

        f"{work_order_counter:03d}"

    )

    work_order_counter += 1

    # ---------------------------------------------

    # GENERATE WORK ORDER

    # ---------------------------------------------

    work_order = {

        "work_order_id":

            work_order_id,

        "incident_id":

            "INC-0041",

        "sensor_id":

            sensor["sensor_id"],

        "zone":

            sensor["zone"],

        "asset":

            "Zone C Water Pressure Network",

        "title":

            "Investigate Critical Water "

            "Pressure Degradation",

        "priority":

            "P1 CRITICAL",

        "status":

            "PENDING_APPROVAL",

        "trigger":

            "NEXORA Predictive "

            "Maintenance Engine",

        "failure_probability":

            analysis[

                "failure_probability"

            ],

        "risk_level":

            analysis[

                "risk_level"

            ],

        "predicted_failure_window":

            analysis[

                "predicted_failure_window"

            ],

        "recommended_action":

            analysis[

                "recommended_action"

            ],

        # -----------------------------------------

        # GENERATIVE TASK SCOPE

        # -----------------------------------------

        "generated_scope": [

            "Inspect WT-04 pressure sensor "

            "and surrounding pipeline.",

            "Verify abnormal pressure loss "

            "within Zone C water network.",

            "Compare upstream and downstream "

            "pressure readings.",

            "Perform visual leakage "

            "inspection.",

            "Inspect valves and pressure "

            "regulation components.",

            "Isolate the affected section "

            "if structural failure is confirmed.",

            "Record inspection findings "

            "in NEXORA Operations.",

            "Confirm network stability "

            "before closing the incident.",

        ],

        # -----------------------------------------

        # SAFETY

        # -----------------------------------------

        "safety_notes": [

            "Confirm water isolation procedure "

            "before physical intervention.",

            "Use required water infrastructure "

            "PPE.",

            "Escalate immediately if major "

            "pipeline leakage is detected.",

        ],

        # -----------------------------------------

        # TELEMETRY SNAPSHOT

        # -----------------------------------------

        "telemetry_snapshot": {

            "pressure":

                sensor["value"],

            "flow_rate":

                sensor[

                    "flow_rate"

                ],

            "vibration":

                sensor[

                    "vibration"

                ],

            "temperature":

                sensor[

                    "temperature"

                ],

            "pressure_drop_rate":

                sensor[

                    "pressure_drop_rate"

                ],

            "anomaly_count":

                sensor[

                    "anomaly_count"

                ],

        },

        # -----------------------------------------

        # TEAM RECOMMENDATION

        # -----------------------------------------

        "recommended_team": {

            "id":

                selected_team[

                    "id"

                ],

            "name":

                selected_team[

                    "name"

                ],

            "specialization":

                selected_team[

                    "specialization"

                ],

            "dispatch_score":

                selected_team[

                    "dispatch_score"

                ],

            "selection_reasons":

                selected_team[

                    "selection_reasons"

                ],

        },

        # -----------------------------------------

        # RANKING

        # -----------------------------------------

        "team_ranking": [

            {

                "name":

                    team["name"],

                "specialization":

                    team[

                        "specialization"

                    ],

                "dispatch_score":

                    team[

                        "dispatch_score"

                    ],

                "selection_reasons":

                    team[

                        "selection_reasons"

                    ],

            }

            for team in ranking

        ],

        # -----------------------------------------

        # GOVERNANCE

        # -----------------------------------------

        "human_approval_required":

            True,

        "approved_by":

            None,

        "created_at":

            datetime.now().isoformat(),

        "approved_at":

            None,

        "dispatched_at":

            None,

    }

    work_orders[

        work_order_id

    ] = work_order

    return work_order

# =========================================================

# ROOT

# =========================================================

@app.get("/")

async def root():

    return {

        "system":

            "NEXORA",

        "service":

            "Township Intelligence Backend",

        "status":

            "ONLINE",

        "engines": {

            "realtime_gateway":

                "ONLINE",

            "predictive_maintenance":

                "ONLINE",

            "work_order_engine":

                "ONLINE",

            "auto_dispatch":

                "ONLINE",

            "agentic_orchestrator":

                "ONLINE",

            "iot_enterprise_pipeline":

                "ONLINE",

            "mqtt_ingestion_simulator":

                "READY",

            "kafka_style_event_bus":

                "READY",

        },

        "model": {

            "type":

                MODEL_TYPE,

            "accuracy":

                round(

                    MODEL_ACCURACY

                    * 100,

                    2,

                ),

            "training_source":

                MODEL_TRAINING_SOURCE,

        },

    }

# =========================================================

# HEALTH

# =========================================================

@app.get("/api/health")

async def health():

    return {

        "status":

            "ONLINE",

        "service":

            "NEXORA Data Gateway",

        "connected_clients":

            len(

                manager.active_connections

            ),

        "predictive_engine":

            "ONLINE",

        "work_order_engine":

            "ONLINE",

        "auto_dispatch_engine":

            "ONLINE",

        "agentic_orchestrator":

            "ONLINE",

        "iot_enterprise_pipeline":

            "ONLINE",

        "mqtt_ingestion_simulator":

            "READY",

        "kafka_style_event_bus":

            "READY",

        "model":

            MODEL_TYPE,

        "timestamp":

            datetime.now().isoformat(),

    }

# =========================================================

# MODEL INFO

# =========================================================

@app.get("/api/model")

async def model_information():

    return {

        "engine":

            "NEXORA Predictive Maintenance",

        "status":

            "ONLINE",

        "model_type":

            MODEL_TYPE,

        "features":

            MODEL_FEATURES,

        "accuracy_percent":

            round(

                MODEL_ACCURACY

                * 100,

                2,

            ),

        "training_source":

            MODEL_TRAINING_SOURCE,

        "training_samples":

            MODEL_SAMPLE_COUNT,

    }

# =========================================================

# SENSOR API

# =========================================================

@app.get("/api/sensors")

async def get_sensors():

    return sensor_state

# =========================================================

# TEAM API

# =========================================================

@app.get("/api/teams")

async def get_teams():

    return {

        "count":

            len(

                response_teams

            ),

        "teams":

            response_teams,

    }

# =========================================================

# AGENTIC AI API

# =========================================================

@app.get("/api/agents")

async def get_agents():

    return {

        "system": "NEXORA Agentic AI",

        "status": "ONLINE",

        "architecture": "Detector -> Risk -> Planner -> Dispatch -> Governance",

        "agents": [

            {

                "id": key,

                **value,

                "status": "ONLINE",

            }

            for key, value in AGENT_CONFIG.items()

        ],

    }

@app.get("/api/agent-trace")

async def get_agent_trace():

    return {

        "count": len(agent_trace),

        "trace": agent_trace,

    }

@app.delete("/api/agent-trace")

async def clear_agent_trace():

    agent_trace.clear()

    return {

        "message": "NEXORA agent trace cleared",

        "count": 0,

    }

# =========================================================

# ENTERPRISE IOT DATA PIPELINE API

# =========================================================

@app.get("/api/iot/pipeline")

async def get_iot_pipeline():

    return build_iot_pipeline_snapshot()

@app.get("/api/iot/devices")

async def get_iot_devices():

    return {"count":len(IOT_DEVICES),"devices":list(IOT_DEVICES.values())}

@app.get("/api/iot/events")

async def get_iot_events(limit: int=100):

    safe_limit=max(1,min(limit,500))

    return {"count":len(iot_events),"returned":min(len(iot_events),safe_limit),"events":iot_events[-safe_limit:]}

@app.post("/api/iot/start")

async def start_iot_pipeline():

    global iot_pipeline_task,iot_pipeline_running,iot_pipeline_started_at

    if iot_pipeline_running:

        return {"message":"NEXORA IoT pipeline is already streaming","pipeline":build_iot_pipeline_snapshot()}

    iot_pipeline_running=True

    iot_pipeline_started_at=datetime.now().isoformat()

    iot_pipeline_task=asyncio.create_task(run_iot_pipeline())

    snapshot=build_iot_pipeline_snapshot()

    await manager.broadcast({"event":"IOT_PIPELINE_STATUS","timestamp":datetime.now().isoformat(),"data":snapshot})

    return {"message":"NEXORA enterprise IoT pipeline started","pipeline":snapshot}

@app.post("/api/iot/stop")

async def stop_iot_pipeline():

    global iot_pipeline_task,iot_pipeline_running

    iot_pipeline_running=False

    if iot_pipeline_task and not iot_pipeline_task.done():

        iot_pipeline_task.cancel()

    iot_pipeline_task=None

    snapshot=build_iot_pipeline_snapshot()

    await manager.broadcast({"event":"IOT_PIPELINE_STATUS","timestamp":datetime.now().isoformat(),"data":snapshot})

    return {"message":"NEXORA enterprise IoT pipeline stopped","pipeline":snapshot}

@app.post("/api/iot/publish/{device_id}")

async def publish_virtual_iot_reading(device_id: str):

    device_id=device_id.upper()

    if device_id not in IOT_DEVICES:

        return {"error":"Unknown IoT device","available_devices":list(IOT_DEVICES.keys())}

    value,status,metadata=generate_virtual_device_reading(device_id)

    event=await publish_iot_event(device_id,value,status,{**metadata,"producer":"Manual Virtual Device Publish"})

    return {"message":"Virtual IoT reading published","event":event}

# =========================================================

# PREDICTION API

# =========================================================

@app.get("/api/predict/WT-04")

async def predict_wt04():

    sensor = sensor_state[

        "WT-04"

    ]

    analysis = (

        build_predictive_analysis(

            sensor

        )

    )

    return {

        "sensor_id":

            sensor["sensor_id"],

        "telemetry": {

            "pressure":

                sensor["value"],

            "flow_rate":

                sensor[

                    "flow_rate"

                ],

            "vibration":

                sensor[

                    "vibration"

                ],

            "temperature":

                sensor[

                    "temperature"

                ],

            "pressure_drop_rate":

                sensor[

                    "pressure_drop_rate"

                ],

            "anomaly_count":

                sensor[

                    "anomaly_count"

                ],

        },

        "prediction":

            analysis,

        "model": {

            "type":

                MODEL_TYPE,

            "accuracy_percent":

                round(

                    MODEL_ACCURACY

                    * 100,

                    2,

                ),

            "training_source":

                MODEL_TRAINING_SOURCE,

        },

        "timestamp":

            datetime.now().isoformat(),

    }

# =========================================================

# WORK ORDER API

# =========================================================

@app.get("/api/work-orders")

async def get_work_orders():

    return {

        "count":

            len(

                work_orders

            ),

        "work_orders":

            list(

                work_orders.values()

            ),

    }

@app.get(

    "/api/work-orders/{work_order_id}"

)

async def get_work_order(

    work_order_id: str,

):

    work_order = (

        work_orders.get(

            work_order_id

        )

    )

    if not work_order:

        return {

            "error":

                "Work order not found"

        }

    return work_order

# =========================================================

# APPROVE WORK ORDER

# =========================================================

@app.post(

    "/api/work-orders/"

    "{work_order_id}/approve"

)

async def approve_work_order(

    work_order_id: str,

):

    work_order = (

        work_orders.get(

            work_order_id

        )

    )

    if not work_order:

        return {

            "error":

                "Work order not found"

        }

    if (

        work_order["status"]

        != "PENDING_APPROVAL"

    ):

        return {

            "error":

                "Work order is not "

                "awaiting approval",

            "status":

                work_order[

                    "status"

                ],

        }

    work_order["status"] = (

        "APPROVED"

    )

    work_order["approved_by"] = (

        "Township Operations Controller"

    )

    work_order["approved_at"] = (

        datetime.now().isoformat()

    )

    event = {

        "event":

            "WORK_ORDER_APPROVED",

        "timestamp":

            datetime.now().isoformat(),

        "data":

            work_order,

    }

    await manager.broadcast(

        event

    )

    await broadcast_agent_trace(

        agent="GOVERNANCE",

        action="Human approval received for maintenance work order.",

        status="APPROVED",

        details={

            "work_order_id": work_order["work_order_id"],

            "approved_by": work_order["approved_by"],

        },

    )

    return work_order

# =========================================================

# DISPATCH WORK ORDER

# =========================================================

@app.post(

    "/api/work-orders/"

    "{work_order_id}/dispatch"

)

async def dispatch_work_order(

    work_order_id: str,

):

    work_order = (

        work_orders.get(

            work_order_id

        )

    )

    if not work_order:

        return {

            "error":

                "Work order not found"

        }

    if (

        work_order["status"]

        != "APPROVED"

    ):

        return {

            "error":

                "Human approval required "

                "before dispatch",

            "status":

                work_order[

                    "status"

                ],

        }

    work_order["status"] = (

        "DISPATCHED"

    )

    work_order["dispatched_at"] = (

        datetime.now().isoformat()

    )

    selected_team_id = (

        work_order[

            "recommended_team"

        ]["id"]

    )

    for team in response_teams:

        if (

            team["id"]

            == selected_team_id

        ):

            team["status"] = (

                "DEPLOYED"

            )

            team[

                "active_jobs"

            ] += 1

            break

    event = {

        "event":

            "WORK_ORDER_DISPATCHED",

        "timestamp":

            datetime.now().isoformat(),

        "data":

            work_order,

    }

    await manager.broadcast(

        event

    )

    await broadcast_agent_trace(

        agent="DISPATCH",

        action="Approved work order dispatched to field response team.",

        status="DISPATCHED",

        details={

            "work_order_id": work_order["work_order_id"],

            "team": work_order["recommended_team"]["name"],

            "team_id": selected_team_id,

        },

    )

    return work_order

# =========================================================

# APPROVE + DISPATCH IN ONE ACTION

# =========================================================

@app.post(

    "/api/work-orders/"

    "{work_order_id}/approve-dispatch"

)

async def approve_and_dispatch(

    work_order_id: str,

):

    work_order = (

        work_orders.get(

            work_order_id

        )

    )

    if not work_order:

        return {

            "error":

                "Work order not found"

        }

    if (

        work_order["status"]

        != "PENDING_APPROVAL"

    ):

        return {

            "error":

                "Work order is not "

                "awaiting approval",

            "status":

                work_order[

                    "status"

                ],

        }

    # ---------------------------------------------

    # HUMAN APPROVAL

    # ---------------------------------------------

    now = datetime.now().isoformat()

    work_order["status"] = (

        "DISPATCHED"

    )

    work_order["approved_by"] = (

        "Township Operations Controller"

    )

    work_order["approved_at"] = (

        now

    )

    work_order["dispatched_at"] = (

        now

    )

    # ---------------------------------------------

    # UPDATE TEAM

    # ---------------------------------------------

    selected_team_id = (

        work_order[

            "recommended_team"

        ]["id"]

    )

    for team in response_teams:

        if (

            team["id"]

            == selected_team_id

        ):

            team["status"] = (

                "DEPLOYED"

            )

            team[

                "active_jobs"

            ] += 1

            break

    # ---------------------------------------------

    # BROADCAST

    # ---------------------------------------------

    event = {

        "event":

            "WORK_ORDER_DISPATCHED",

        "timestamp":

            now,

        "data":

            work_order,

    }

    await manager.broadcast(

        event

    )

    await broadcast_agent_trace(

        agent="GOVERNANCE",

        action="Human approval received. Governance gate released deployment.",

        status="APPROVED",

        details={

            "work_order_id": work_order["work_order_id"],

            "approved_by": work_order["approved_by"],

        },

    )

    await broadcast_agent_trace(

        agent="DISPATCH",

        action="Response team deployed to Zone C.",

        status="DISPATCHED",

        details={

            "work_order_id": work_order["work_order_id"],

            "team": work_order["recommended_team"]["name"],

            "team_id": selected_team_id,

            "zone": work_order["zone"],

        },

    )

    return work_order

# =========================================================

# WATER FAILURE SIMULATION

# =========================================================

@app.post(

    "/api/simulate/water-failure"

)

async def simulate_water_failure():

    sequence = [

        {

            "pressure": 3.2,

            "status": "NORMAL",

            "flow_rate": 124.0,

            "vibration": 0.18,

            "temperature": 29.0,

            "pressure_drop_rate": 0.02,

            "anomaly_count": 0,

        },

        {

            "pressure": 2.9,

            "status": "NORMAL",

            "flow_rate": 120.0,

            "vibration": 0.25,

            "temperature": 31.0,

            "pressure_drop_rate": 0.05,

            "anomaly_count": 1,

        },

        {

            "pressure": 2.6,

            "status": "WARNING",

            "flow_rate": 114.0,

            "vibration": 0.38,

            "temperature": 34.0,

            "pressure_drop_rate": 0.10,

            "anomaly_count": 2,

        },

        {

            "pressure": 2.3,

            "status": "WARNING",

            "flow_rate": 106.0,

            "vibration": 0.55,

            "temperature": 38.0,

            "pressure_drop_rate": 0.16,

            "anomaly_count": 4,

        },

        {

            "pressure": 2.0,

            "status": "CRITICAL",

            "flow_rate": 98.0,

            "vibration": 0.70,

            "temperature": 42.0,

            "pressure_drop_rate": 0.23,

            "anomaly_count": 6,

        },

        {

            "pressure": 1.8,

            "status": "CRITICAL",

            "flow_rate": 91.0,

            "vibration": 0.84,

            "temperature": 46.0,

            "pressure_drop_rate": 0.29,

            "anomaly_count": 8,

        },

    ]

    async def run_simulation():

        global agent_run_counter

        run_id = f"RUN-{agent_run_counter:04d}"

        agent_run_counter += 1

        await broadcast_agent_trace(

            agent="DETECTOR",

            action="Monitoring WT-04 live telemetry stream.",

            status="ACTIVE",

            details={

                "sensor_id": "WT-04",

                "zone": "Zone C",

                "source": "NEXORA Real-Time Gateway",

            },

            run_id=run_id,

        )

        for step in sequence:

            sensor = sensor_state[

                "WT-04"

            ]

            sensor["value"] = (

                step["pressure"]

            )

            sensor["status"] = (

                step["status"]

            )

            sensor["flow_rate"] = (

                step["flow_rate"]

            )

            sensor["vibration"] = (

                step["vibration"]

            )

            sensor["temperature"] = (

                step["temperature"]

            )

            sensor[

                "pressure_drop_rate"

            ] = step[

                "pressure_drop_rate"

            ]

            sensor[

                "anomaly_count"

            ] = step[

                "anomaly_count"

            ]

            # =========================================

            # ENTERPRISE IOT INGESTION

            # DEVICE -> MQTT -> EVENT BUS -> GATEWAY

            # =========================================

            await publish_iot_event(

                device_id="WT-04", value=sensor["value"], status=sensor["status"],

                metadata={"flow_rate":sensor["flow_rate"],"vibration":sensor["vibration"],"temperature":sensor["temperature"],"pressure_drop_rate":sensor["pressure_drop_rate"],"anomaly_count":sensor["anomaly_count"],"producer":"WT-04 Failure Simulation","run_id":run_id},

            )

            # =========================================

            # ML INFERENCE

            # =========================================

            analysis = (

                build_predictive_analysis(

                    sensor

                )

            )

            # =========================================

            # SENSOR UPDATE

            # =========================================

            sensor_event = {

                "event":

                    "SENSOR_UPDATE",

                "timestamp":

                    datetime.now().isoformat(),

                "data": {

                    **sensor,

                    "failure_probability":

                        analysis[

                            "failure_probability"

                        ],

                    "risk_level":

                        analysis[

                            "risk_level"

                        ],

                },

            }

            await manager.broadcast(

                sensor_event

            )

            # =========================================

            # PREDICTIVE EVENT

            # =========================================

            predictive_event = {

                "event":

                    "PREDICTIVE_RISK",

                "timestamp":

                    datetime.now().isoformat(),

                "data": {

                    "sensor_id":

                        sensor[

                            "sensor_id"

                        ],

                    "zone":

                        sensor["zone"],

                    "model":

                        MODEL_TYPE,

                    "pressure":

                        sensor["value"],

                    "flow_rate":

                        sensor[

                            "flow_rate"

                        ],

                    "vibration":

                        sensor[

                            "vibration"

                        ],

                    "temperature":

                        sensor[

                            "temperature"

                        ],

                    "pressure_drop_rate":

                        sensor[

                            "pressure_drop_rate"

                        ],

                    "anomaly_count":

                        sensor[

                            "anomaly_count"

                        ],

                    "failure_probability":

                        analysis[

                            "failure_probability"

                        ],

                    "risk_level":

                        analysis[

                            "risk_level"

                        ],

                    "predicted_failure_window":

                        analysis[

                            "predicted_failure_window"

                        ],

                    "recommended_action":

                        analysis[

                            "recommended_action"

                        ],

                },

            }

            await manager.broadcast(

                predictive_event

            )

            await asyncio.sleep(

                1.2

            )

        # =============================================

        # FINAL CRITICAL STATE

        # =============================================

        sensor = sensor_state[

            "WT-04"

        ]

        analysis = (

            build_predictive_analysis(

                sensor

            )

        )

        # =============================================

        # ANOMALY EVENT

        # =============================================

        anomaly_event = {

            "event":

                "ANOMALY_DETECTED",

            "timestamp":

                datetime.now().isoformat(),

            "data": {

                "sensor_id":

                    sensor[

                        "sensor_id"

                    ],

                "zone":

                    sensor["zone"],

                "type":

                    "Water Pressure Anomaly",

                "value":

                    sensor["value"],

                "unit":

                    sensor["unit"],

                "severity":

                    analysis[

                        "risk_level"

                    ],

                "failure_risk":

                    analysis[

                        "failure_probability"

                    ],

                "failure_probability":

                    analysis[

                        "failure_probability"

                    ],

                "predicted_failure_window":

                    analysis[

                        "predicted_failure_window"

                    ],

                "recommended_action":

                    analysis[

                        "recommended_action"

                    ],

                "model":

                    MODEL_TYPE,

                "model_accuracy":

                    round(

                        MODEL_ACCURACY

                        * 100,

                        2,

                    ),

                "training_source":

                    MODEL_TRAINING_SOURCE,

                "telemetry": {

                    "pressure":

                        sensor["value"],

                    "flow_rate":

                        sensor[

                            "flow_rate"

                        ],

                    "vibration":

                        sensor[

                            "vibration"

                        ],

                    "temperature":

                        sensor[

                            "temperature"

                        ],

                    "pressure_drop_rate":

                        sensor[

                            "pressure_drop_rate"

                        ],

                    "anomaly_count":

                        sensor[

                            "anomaly_count"

                        ],

                },

            },

        }

        await manager.broadcast(

            anomaly_event

        )

        await broadcast_agent_trace(

            agent="DETECTOR",

            action="Critical telemetry pattern detected on WT-04.",

            status="COMPLETED",

            details={

                "pressure": sensor["value"],

                "unit": sensor["unit"],

                "anomaly_count": sensor["anomaly_count"],

                "severity": analysis["risk_level"],

            },

            run_id=run_id,

        )

        await broadcast_agent_trace(

            agent="RISK",

            action="Predictive maintenance model assessed failure risk.",

            status="COMPLETED",

            details={

                "model": MODEL_TYPE,

                "failure_probability": analysis["failure_probability"],

                "risk_level": analysis["risk_level"],

                "predicted_failure_window": analysis["predicted_failure_window"],

            },

            run_id=run_id,

        )

        # =============================================

        # GENERATE WORK ORDER FROM ML RISK

        # =============================================

        if (

            analysis[

                "failure_probability"

            ] >= 80

        ):

            work_order = (

                generate_work_order(

                    sensor,

                    analysis,

                )

            )

            work_order_event = {

                "event":

                    "WORK_ORDER_GENERATED",

                "timestamp":

                    datetime.now().isoformat(),

                "data":

                    work_order,

            }

            await manager.broadcast(

                work_order_event

            )

            await broadcast_agent_trace(

                agent="PLANNER",

                action="Generated maintenance work order and safety controls.",

                status="COMPLETED",

                details={

                    "work_order_id": work_order["work_order_id"],

                    "task_count": len(work_order["generated_scope"]),

                    "safety_control_count": len(work_order["safety_notes"]),

                    "priority": work_order["priority"],

                },

                run_id=run_id,

            )

            await broadcast_agent_trace(

                agent="DISPATCH",

                action="Evaluated response teams and selected the highest-ranked team.",

                status="COMPLETED",

                details={

                    "team": work_order["recommended_team"]["name"],

                    "team_id": work_order["recommended_team"]["id"],

                    "dispatch_score": work_order["recommended_team"]["dispatch_score"],

                    "teams_evaluated": len(work_order["team_ranking"]),

                },

                run_id=run_id,

            )

            await broadcast_agent_trace(

                agent="GOVERNANCE",

                action="Human authorisation required before field deployment.",

                status="WAITING_APPROVAL",

                details={

                    "work_order_id": work_order["work_order_id"],

                    "human_approval_required": True,

                },

                run_id=run_id,

            )

    asyncio.create_task(

        run_simulation()

    )

    return {

        "message":

            "NEXORA predictive water "

            "failure simulation started",

        "sensor":

            "WT-04",

        "predictive_engine":

            MODEL_TYPE,

        "work_order_engine":

            "ARMED",

    }

# =========================================================

# RESET SIMULATION

# =========================================================

# =========================================================
# TRAFFIC SURGE SCENARIO
# =========================================================

@app.post("/api/simulate/traffic-surge")
async def simulate_traffic_surge():
    sequence = [
        (64, "NORMAL", 43, 58),
        (82, "WARNING", 34, 70),
        (108, "WARNING", 25, 82),
        (145, "CRITICAL", 14, 96),
    ]

    async def run_simulation():
        for value, status, speed, occupancy in sequence:
            sensor = sensor_state["TR-08"]
            sensor.update({
                "value": value,
                "status": status,
                "average_speed_kmh": speed,
                "occupancy_percent": occupancy,
            })
            await publish_iot_event(
                "TR-08", value, status,
                {
                    "average_speed_kmh": speed,
                    "occupancy_percent": occupancy,
                    "producer": "TR-08 Traffic Surge Scenario",
                },
            )
            await manager.broadcast({
                "event": "SCENARIO_SENSOR_UPDATE",
                "timestamp": datetime.now().isoformat(),
                "data": {**sensor, "scenario": "TRAFFIC_SURGE"},
            })
            await asyncio.sleep(1.0)

        await manager.broadcast({
            "event": "SCENARIO_ANOMALY",
            "timestamp": datetime.now().isoformat(),
            "data": {
                **sensor_state["TR-08"],
                "scenario": "TRAFFIC_SURGE",
                "type": "Traffic Congestion Surge",
                "severity": "CRITICAL",
                "impact": "Severe congestion detected in Zone B",
                "recommended_action": "Activate traffic management response and reroute affected flows.",
            },
        })

    asyncio.create_task(run_simulation())
    return {"message": "Traffic surge scenario started", "sensor_id": "TR-08", "zone": "Zone B"}


# =========================================================
# POWER GRID OVERLOAD SCENARIO
# =========================================================

@app.post("/api/simulate/power-overload")
async def simulate_power_overload():
    sequence = [
        (428.0, "NORMAL", 68.0),
        (535.0, "WARNING", 82.0),
        (648.0, "WARNING", 93.0),
        (780.0, "CRITICAL", 108.0),
    ]

    async def run_simulation():
        for value, status, load in sequence:
            sensor = sensor_state["EN-12"]
            sensor.update({
                "value": value,
                "status": status,
                "grid_load_percent": load,
            })
            await publish_iot_event(
                "EN-12", value, status,
                {
                    "grid_load_percent": load,
                    "producer": "EN-12 Power Grid Overload Scenario",
                },
            )
            await manager.broadcast({
                "event": "SCENARIO_SENSOR_UPDATE",
                "timestamp": datetime.now().isoformat(),
                "data": {**sensor, "scenario": "POWER_GRID_OVERLOAD"},
            })
            await asyncio.sleep(1.0)

        await manager.broadcast({
            "event": "SCENARIO_ANOMALY",
            "timestamp": datetime.now().isoformat(),
            "data": {
                **sensor_state["EN-12"],
                "scenario": "POWER_GRID_OVERLOAD",
                "type": "Power Grid Overload",
                "severity": "CRITICAL",
                "impact": "Electrical demand exceeds safe operating threshold in Zone A",
                "recommended_action": "Reduce non-critical load and dispatch electrical response team.",
            },
        })

    asyncio.create_task(run_simulation())
    return {"message": "Power grid overload scenario started", "sensor_id": "EN-12", "zone": "Zone A"}


@app.post(

    "/api/simulate/reset"

)

async def reset_simulation():
    sensor_state["WT-03"].update({"value": 124.0, "status": "NORMAL"})
    sensor_state["EN-12"].update({
        "value": 428.0, "status": "NORMAL", "grid_load_percent": 68.0
    })
    sensor_state["TR-08"].update({
        "value": 64, "status": "NORMAL", "average_speed_kmh": 43, "occupancy_percent": 58
    })
    for sid in ("WT-03", "EN-12", "TR-08"):
        await manager.broadcast({
            "event": "SCENARIO_SENSOR_UPDATE",
            "timestamp": datetime.now().isoformat(),
            "data": {**sensor_state[sid], "scenario": "RESET"},
        })


    global work_order_counter

    global agent_run_counter

    global iot_event_counter

    # ---------------------------------------------

    # RESET SENSOR

    # ---------------------------------------------

    sensor_state["WT-04"] = {

        "sensor_id":

            "WT-04",

        "type":

            "Water Pressure Sensor",

        "zone":

            "Zone C",

        "value":

            3.2,

        "unit":

            "bar",

        "status":

            "NORMAL",

        "flow_rate":

            124.0,

        "vibration":

            0.18,

        "temperature":

            29.0,

        "pressure_drop_rate":

            0.02,

        "anomaly_count":

            0,

    }

    # ---------------------------------------------

    # RESET WORK ORDERS

    # ---------------------------------------------

    work_orders.clear()

    work_order_counter = 1

    agent_trace.clear()

    agent_run_counter = 1

    iot_events.clear()

    iot_event_counter = 1

    # ---------------------------------------------

    # RESET TEAMS

    # ---------------------------------------------

    for team in response_teams:

        if (

            team["id"]

            == "TEAM-WATER-02"

        ):

            team["status"] = (

                "AVAILABLE"

            )

            team["active_jobs"] = 0

    analysis = (

        build_predictive_analysis(

            sensor_state[

                "WT-04"

            ]

        )

    )

    event = {

        "event":

            "SYSTEM_RESET",

        "timestamp":

            datetime.now().isoformat(),

        "data": {

            **sensor_state[

                "WT-04"

            ],

            "failure_probability":

                analysis[

                    "failure_probability"

                ],

            "risk_level":

                analysis[

                    "risk_level"

                ],

        },

    }

    await manager.broadcast(

        event

    )

    return {

        "message":

            "NEXORA simulation reset",

        "sensor":

            sensor_state[

                "WT-04"

            ],

        "prediction":

            analysis,

        "work_orders":

            0,

    }

# =========================================================

# RANDOM IOT EVENT

# =========================================================

@app.post(

    "/api/simulate/random-event"

)

async def random_event():

    sensor = sensor_state[

        "WT-04"

    ]

    pressure = round(

        random.uniform(

            1.7,

            3.5,

        ),

        2,

    )

    if pressure < 2.1:

        status = "CRITICAL"

    elif pressure < 2.7:

        status = "WARNING"

    else:

        status = "NORMAL"

    sensor["value"] = pressure

    sensor["status"] = status

    severity_factor = max(

        0,

        3.2 - pressure,

    )

    sensor["flow_rate"] = round(

        max(

            80,

            124

            - severity_factor * 20

            + random.uniform(

                -3,

                3,

            ),

        ),

        1,

    )

    sensor["vibration"] = round(

        min(

            1.0,

            0.18

            + severity_factor * 0.35

            + random.uniform(

                0,

                0.08,

            ),

        ),

        2,

    )

    sensor["temperature"] = round(

        min(

            55,

            29

            + severity_factor * 8

            + random.uniform(

                0,

                2,

            ),

        ),

        1,

    )

    sensor[

        "pressure_drop_rate"

    ] = round(

        min(

            0.35,

            0.02

            + severity_factor * 0.16,

        ),

        2,

    )

    sensor[

        "anomaly_count"

    ] = min(

        10,

        int(

            severity_factor * 6

        ),

    )

    analysis = (

        build_predictive_analysis(

            sensor

        )

    )

    event = {

        "event":

            "SENSOR_UPDATE",

        "timestamp":

            datetime.now().isoformat(),

        "data": {

            **sensor,

            "failure_probability":

                analysis[

                    "failure_probability"

                ],

            "risk_level":

                analysis[

                    "risk_level"

                ],

        },

    }

    await manager.broadcast(

        event

    )

    return {

        **event,

        "prediction":

            analysis,

    }

# =========================================================

# WEBSOCKET

# =========================================================

@app.websocket("/ws")

async def websocket_endpoint(

    websocket: WebSocket,

):

    await manager.connect(

        websocket

    )

    await websocket.send_text(

        json.dumps(

            {

                "event":

                    "CONNECTED",

                "timestamp":

                    datetime.now().isoformat(),

                "data": {

                    "message":

                        "Connected to NEXORA "

                        "Real-Time Gateway",

                    "predictive_engine":

                        "ONLINE",

                    "work_order_engine":

                        "ONLINE",

                    "auto_dispatch":

                        "ONLINE",

                    "agentic_orchestrator":

                        "ONLINE",

                    "model":

                        MODEL_TYPE,

                },

            }

        )

    )

    try:

        while True:

            await websocket.receive_text()

    except WebSocketDisconnect:

        manager.disconnect(

            websocket

        )

    except Exception:

        manager.disconnect(

            websocket

        )


# =========================================================
# TOWNSHIP SERVICES v2 — water (night-flow leak detection),
# flood alerts, waste routing, work orders + SLA, reports.
# Real ESP32 sensors and the simulator share /api/v2/ingest.
# =========================================================

from township import api as township_api  # noqa: E402
from township import engine as township_engine  # noqa: E402

app.include_router(township_api.router)


@app.on_event("startup")
async def start_township_services():
    township_api.startup()
    asyncio.create_task(township_engine.run_simulator())
