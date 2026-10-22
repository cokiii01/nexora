import { useEffect, useMemo, useState } from 'react'

import { API_BASE, WS_BASE } from '../lib/api'
const WS_URL = WS_BASE + '/ws'

function Operations({ openSensorInDigitalTwin, liveWT04 }) {

  const [incidents, setIncidents] = useState([
    {
      id: 'INC-0041',
      title: 'Water pressure anomaly',
      location: 'Zone C · Water Network',
      severity: 'CRITICAL',
      status: 'INVESTIGATING',
      time: '08:42',
      team: 'Utility Response 02',
      source: 'IoT Sensor · WT-04',
      sensorID: 'WT-04',
      description:
        'Abnormal pressure drop detected by sensor WT-04. Potential leakage or pipe failure under investigation.',
    },
    {
      id: 'INC-0038',
      title: 'Road surface damage',
      location: 'Zone A · Jalan NX-14',
      severity: 'MEDIUM',
      status: 'DISPATCHED',
      time: '08:17',
      team: 'Civil Works 01',
      source: 'Resident Report · RPT-0182',
      sensorID: null,
      description:
        'Road surface deterioration reported along the eastern residential access route.',
    },
    {
      id: 'INC-0036',
      title: 'Streetlight offline',
      location: 'Zone B · SL-204',
      severity: 'LOW',
      status: 'ASSIGNED',
      time: '07:56',
      team: 'Electrical Team 03',
      source: 'IoT Sensor · SL-204',
      sensorID: null,
      description:
        'Streetlight node SL-204 is unresponsive. Maintenance inspection has been assigned.',
    },
    {
      id: 'INC-0031',
      title: 'Traffic congestion detected',
      location: 'Zone B · Commercial Loop',
      severity: 'MEDIUM',
      status: 'MONITORING',
      time: '07:31',
      team: 'Mobility Control',
      source: 'Traffic Intelligence · TR-08',
      sensorID: 'TR-08',
      description:
        'Traffic flow has exceeded the normal morning threshold at the commercial loop.',
    },
  ])

  const [selectedIncident, setSelectedIncident] =
    useState('INC-0038')

  const [responseOpen, setResponseOpen] =
    useState(false)

  const [responseStatus, setResponseStatus] =
    useState('IN PROGRESS')

  const [responseTeam, setResponseTeam] =
    useState('Utility Response 02')

  const [responseNote, setResponseNote] =
    useState('')

  const [activityLog, setActivityLog] = useState([
    {
      time: '08:19:31',
      text: 'Civil Works 01 dispatched to',
      highlight: 'Zone A',
    },
    {
      time: '07:58:04',
      text: 'Electrical inspection created for',
      highlight: 'SL-204',
    },
  ])

  const [workOrders, setWorkOrders] =
    useState([])

  const [workOrderLoading, setWorkOrderLoading] =
    useState(true)

  const [workOrderError, setWorkOrderError] =
    useState('')

  const [dispatching, setDispatching] =
    useState(false)

  const [gatewayConnected, setGatewayConnected] =
    useState(false)

  const [agentTrace, setAgentTrace] =
    useState([])

  const [agentTraceLoading, setAgentTraceLoading] =
    useState(true)

  const agentOrder = [
    'DETECTOR',
    'RISK',
    'PLANNER',
    'DISPATCH',
    'GOVERNANCE',
  ]

  const agentMeta = {
    DETECTOR: {
      label: 'DETECTOR',
      role: 'Anomaly Detection',
      icon: 'D',
    },
    RISK: {
      label: 'RISK',
      role: 'ML Risk Assessment',
      icon: 'R',
    },
    PLANNER: {
      label: 'PLANNER',
      role: 'Response Planning',
      icon: 'P',
    },
    DISPATCH: {
      label: 'DISPATCH',
      role: 'Team Optimisation',
      icon: 'A',
    },
    GOVERNANCE: {
      label: 'GOVERNANCE',
      role: 'Human Control',
      icon: 'G',
    },
  }

  const [teams, setTeams] = useState([
    {
      name: 'Utility Response 02',
      type: 'Water Infrastructure',
      status: 'AVAILABLE',
      task: '—',
    },
    {
      name: 'Civil Works 01',
      type: 'Road Maintenance',
      status: 'EN ROUTE',
      task: 'INC-0038',
    },
    {
      name: 'Electrical Team 03',
      type: 'Electrical Infrastructure',
      status: 'AVAILABLE',
      task: '—',
    },
  ])

  const selected =
    incidents.find(
      (incident) =>
        incident.id === selectedIncident
    ) || incidents[0]

  const selectedWorkOrder = useMemo(() => {
    return (
      workOrders.find(
        (workOrder) =>
          workOrder.incident_id === selected.id
      ) || null
    )
  }, [workOrders, selected.id])

  const latestAgentRunId = useMemo(() => {
    const runTrace = agentTrace.filter(
      (trace) => trace.run_id
    )

    return (
      runTrace[runTrace.length - 1]?.run_id ||
      null
    )
  }, [agentTrace])

  const visibleAgentTrace = useMemo(() => {
    if (!latestAgentRunId) {
      return agentTrace
    }

    return agentTrace.filter(
      (trace) =>
        trace.run_id === latestAgentRunId ||
        !trace.run_id
    )
  }, [agentTrace, latestAgentRunId])

  const latestAgentStates = useMemo(() => {
    const states = {}

    visibleAgentTrace.forEach((trace) => {
      states[trace.agent] = trace
    })

    return states
  }, [visibleAgentTrace])

  const orchestrationState = useMemo(() => {
    const governance =
      latestAgentStates.GOVERNANCE

    const dispatch =
      latestAgentStates.DISPATCH

    if (
      dispatch?.status === 'DISPATCHED'
    ) {
      return {
        label: 'ORCHESTRATION COMPLETE',
        tone: 'complete',
      }
    }

    if (
      governance?.status === 'WAITING_APPROVAL'
    ) {
      return {
        label: 'AWAITING HUMAN APPROVAL',
        tone: 'waiting',
      }
    }

    if (visibleAgentTrace.length > 0) {
      return {
        label: 'ORCHESTRATION ACTIVE',
        tone: 'active',
      }
    }

    return {
      label: 'STANDBY',
      tone: 'standby',
    }
  }, [
    latestAgentStates,
    visibleAgentTrace,
  ])

  const getCurrentTime = () => {
    return new Date().toLocaleTimeString(
      'en-GB',
      {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }
    )
  }

  const addActivity = (
    text,
    highlight
  ) => {
    setActivityLog((currentLog) => [
      {
        time: getCurrentTime(),
        text,
        highlight,
      },
      ...currentLog,
    ])
  }

  const fetchWorkOrders = async () => {
    try {
      const response = await fetch(
        `${API_BASE}/api/work-orders`
      )

      if (!response.ok) {
        throw new Error(
          'Unable to load work orders'
        )
      }

      const data = await response.json()

      setWorkOrders(
        Array.isArray(data.work_orders)
          ? data.work_orders
          : []
      )

      setWorkOrderError('')
    } catch (error) {
      console.error(
        'NEXORA work-order fetch error:',
        error
      )

      setWorkOrderError(
        'Work Order Engine unavailable'
      )
    } finally {
      setWorkOrderLoading(false)
    }
  }

  const fetchAgentTrace = async () => {
    try {
      const response = await fetch(
        `${API_BASE}/api/agent-trace`
      )

      if (!response.ok) {
        throw new Error(
          'Unable to load agent trace'
        )
      }

      const data = await response.json()

      setAgentTrace(
        Array.isArray(data.trace)
          ? data.trace
          : []
      )
    } catch (error) {
      console.error(
        'NEXORA agent-trace fetch error:',
        error
      )
    } finally {
      setAgentTraceLoading(false)
    }
  }

  // SHARED WT-04 STATE
  // Digital Twin is the source of truth for the water scenario.

  useEffect(() => {
    if (!liveWT04) return

    const isCritical = liveWT04.status === 'Critical'
    const isWarning = liveWT04.status === 'Warning'

    setIncidents((currentIncidents) =>
      currentIncidents.map((incident) =>
        incident.id === 'INC-0041'
          ? {
              ...incident,
              severity: isCritical
                ? 'CRITICAL'
                : isWarning
                  ? 'MEDIUM'
                  : 'NORMAL',
              status: isCritical || isWarning
                ? 'INVESTIGATING'
                : 'RESOLVED',
              team: isCritical || isWarning
                ? 'Utility Response 02'
                : '—',
              description: isCritical
                ? `WT-04 is reporting ${liveWT04.value} bar in Zone C. A water-network anomaly is under investigation.`
                : isWarning
                  ? `WT-04 is reporting ${liveWT04.value} bar and requires monitoring.`
                  : `WT-04 is reporting ${liveWT04.value} bar. Zone C water pressure is within the normal operating range.`,
            }
          : incident
      )
    )

    if (isCritical || isWarning) {
      setSelectedIncident('INC-0041')
    } else {
      setSelectedIncident((current) =>
        current === 'INC-0041' ? 'INC-0038' : current
      )
    }
  }, [liveWT04])

  useEffect(() => {
    fetchWorkOrders()
    fetchAgentTrace()
  }, [])

  useEffect(() => {
    let socket
    let reconnectTimer
    let keepAliveTimer
    let componentActive = true

    const connectGateway = () => {
      if (!componentActive) return

      socket = new WebSocket(WS_URL)

      socket.onopen = () => {
        if (!componentActive) return

        setGatewayConnected(true)

        keepAliveTimer = setInterval(() => {
          if (
            socket &&
            socket.readyState ===
              WebSocket.OPEN
          ) {
            socket.send('ping')
          }
        }, 20000)
      }

      socket.onmessage = (event) => {
        try {
          const message =
            JSON.parse(event.data)

          const eventType =
            message.event

          const data =
            message.data

          if (
            eventType ===
            'AGENT_TRACE'
          ) {
            setAgentTrace(
              (currentTrace) => {
                const exists =
                  currentTrace.some(
                    (trace) =>
                      trace.trace_id ===
                      data.trace_id
                  )

                if (exists) {
                  return currentTrace.map(
                    (trace) =>
                      trace.trace_id ===
                      data.trace_id
                        ? data
                        : trace
                  )
                }

                return [
                  ...currentTrace,
                  data,
                ].slice(-200)
              }
            )
          }

          if (
            eventType ===
            'WORK_ORDER_GENERATED'
          ) {
            setWorkOrders(
              (currentOrders) => {
                const exists =
                  currentOrders.some(
                    (order) =>
                      order.work_order_id ===
                      data.work_order_id
                  )

                if (exists) {
                  return currentOrders.map(
                    (order) =>
                      order.work_order_id ===
                      data.work_order_id
                        ? data
                        : order
                  )
                }

                return [
                  data,
                  ...currentOrders,
                ]
              }
            )

            addActivity(
              'NEXORA Intelligence generated',
              data.work_order_id
            )
          }

          if (
            eventType ===
            'WORK_ORDER_APPROVED'
          ) {
            setWorkOrders(
              (currentOrders) =>
                currentOrders.map(
                  (order) =>
                    order.work_order_id ===
                    data.work_order_id
                      ? data
                      : order
                )
            )

            addActivity(
              'Human approval granted for',
              data.work_order_id
            )
          }

          if (
            eventType ===
            'WORK_ORDER_DISPATCHED'
          ) {
            setWorkOrders(
              (currentOrders) =>
                currentOrders.map(
                  (order) =>
                    order.work_order_id ===
                    data.work_order_id
                      ? data
                      : order
                )
            )

            setIncidents(
              (currentIncidents) =>
                currentIncidents.map(
                  (incident) =>
                    incident.id ===
                    data.incident_id
                      ? {
                          ...incident,
                          status:
                            'DISPATCHED',
                          team:
                            data
                              .recommended_team
                              .name,
                        }
                      : incident
                )
            )

            setTeams(
              (currentTeams) =>
                currentTeams.map(
                  (team) =>
                    team.name ===
                    data
                      .recommended_team
                      .name
                      ? {
                          ...team,
                          status:
                            'DEPLOYED',
                          task:
                            data.incident_id,
                        }
                      : team
                )
            )

            addActivity(
              `${data.recommended_team.name} dispatched through`,
              data.work_order_id
            )
          }

          if (
            eventType ===
            'SYSTEM_RESET'
          ) {
            setWorkOrders([])
            setAgentTrace([])

            setIncidents(
              (currentIncidents) =>
                currentIncidents.map(
                  (incident) =>
                    incident.id ===
                    'INC-0041'
                      ? {
                          ...incident,
                          severity: 'NORMAL',
                          status:
                            'RESOLVED',
                          team:
                            '—',
                        }
                      : incident
                )
            )

            setTeams(
              (currentTeams) =>
                currentTeams.map(
                  (team) =>
                    team.name ===
                    'Utility Response 02'
                      ? {
                          ...team,
                          status:
                            'AVAILABLE',
                          task: '—',
                        }
                      : team
                )
            )

            addActivity(
              'Predictive simulation reset for',
              'WT-04'
            )
          }
        } catch (error) {
          console.error(
            'NEXORA WebSocket message error:',
            error
          )
        }
      }

      socket.onerror = () => {
        if (!componentActive) return

        setGatewayConnected(false)
      }

      socket.onclose = () => {
        if (!componentActive) return

        setGatewayConnected(false)

        if (keepAliveTimer) {
          clearInterval(
            keepAliveTimer
          )
        }

        reconnectTimer = setTimeout(
          connectGateway,
          2500
        )
      }
    }

    connectGateway()

    return () => {
      componentActive = false

      if (reconnectTimer) {
        clearTimeout(
          reconnectTimer
        )
      }

      if (keepAliveTimer) {
        clearInterval(
          keepAliveTimer
        )
      }

      if (socket) {
        socket.close()
      }
    }
  }, [])

  const approveAndDispatch = async (
    workOrder
  ) => {
    if (!workOrder) return

    if (
      workOrder.status !==
      'PENDING_APPROVAL'
    ) {
      return
    }

    setDispatching(true)
    setWorkOrderError('')

    try {
      const response = await fetch(
        `${API_BASE}/api/work-orders/${workOrder.work_order_id}/approve-dispatch`,
        {
          method: 'POST',
        }
      )

      const data =
        await response.json()

      if (
        !response.ok ||
        data.error
      ) {
        throw new Error(
          data.error ||
            'Unable to dispatch work order'
        )
      }

      // LOCAL UPDATE
      // WebSocket will also confirm the event.

      setWorkOrders(
        (currentOrders) =>
          currentOrders.map(
            (order) =>
              order.work_order_id ===
              data.work_order_id
                ? data
                : order
          )
      )

      setIncidents(
        (currentIncidents) =>
          currentIncidents.map(
            (incident) =>
              incident.id ===
              data.incident_id
                ? {
                    ...incident,
                    status:
                      'DISPATCHED',
                    team:
                      data
                        .recommended_team
                        .name,
                  }
                : incident
          )
      )

      setTeams(
        (currentTeams) =>
          currentTeams.map(
            (team) =>
              team.name ===
              data
                .recommended_team
                .name
                ? {
                    ...team,
                    status:
                      'DEPLOYED',
                    task:
                      data.incident_id,
                  }
                : team
          )
      )

      addActivity(
        'Human-approved AI dispatch completed for',
        data.work_order_id
      )
    } catch (error) {
      console.error(
        'NEXORA dispatch error:',
        error
      )

      setWorkOrderError(
        error.message
      )
    } finally {
      setDispatching(false)
    }
  }

  const openResponse = () => {
    setResponseStatus(
      selected.status === 'RESOLVED'
        ? 'RESOLVED'
        : 'IN PROGRESS'
    )

    setResponseTeam(
      selected.team
    )

    setResponseNote('')

    setResponseOpen(true)
  }

  const closeResponse = () => {
    setResponseOpen(false)
  }

  const confirmResponse = () => {
    setIncidents(
      (currentIncidents) =>
        currentIncidents.map(
          (incident) =>
            incident.id ===
            selected.id
              ? {
                  ...incident,
                  status:
                    responseStatus,
                  team:
                    responseTeam,
                }
              : incident
        )
    )

    addActivity(
      responseStatus ===
        'RESOLVED'
        ? `${selected.id} marked as`
        : `${responseTeam} updated ${selected.id} to`,
      responseStatus
    )

    setResponseOpen(false)
  }

  const viewOnDigitalTwin = () => {
    if (!selected.sensorID) {
      return
    }

    if (
      openSensorInDigitalTwin
    ) {
      openSensorInDigitalTwin(
        selected.sensorID
      )
    }
  }

  return (
    <section className="operations-page">

      <div className="operations-heading">

        <div>
          <p className="section-label">
            OPERATIONS
          </p>

          <h1>
            Township Operations
          </h1>

          <p className="operations-description">
            Live incident coordination, response deployment
            and operational oversight.
          </p>
        </div>

        <div className="operations-live">
          <span className="live-dot"></span>

          COMMAND ACTIVE

          <span
            style={{
              marginLeft: '12px',
              opacity: 0.5,
            }}
          >
            ·
          </span>

          <span
            style={{
              color: gatewayConnected
                ? '#2df0b8'
                : '#ff5a62',
            }}
          >
            {gatewayConnected
              ? ' AI GATEWAY ONLINE'
              : ' AI GATEWAY OFFLINE'}
          </span>
        </div>

      </div>

      <div className="operations-stats">

        <div className="operation-stat">
          <span>
            ACTIVE INCIDENTS
          </span>

          <strong>
            {
              incidents.filter(
                (incident) =>
                  incident.status !==
                  'RESOLVED'
              ).length
            }
          </strong>

          <small>
            Across all sectors
          </small>
        </div>

        <div className="operation-stat critical">
          <span>
            CRITICAL
          </span>

          <strong>
            {
              incidents.filter(
                (incident) =>
                  incident.severity ===
                    'CRITICAL' &&
                  incident.status !==
                    'RESOLVED'
              ).length
            }
          </strong>

          <small>
            Immediate attention
          </small>
        </div>

        <div className="operation-stat">
          <span>
            AI WORK ORDERS
          </span>

          <strong>
            {workOrders.length}
          </strong>

          <small>
            Predictive maintenance
          </small>
        </div>

        <div className="operation-stat">
          <span>
            RESOLUTION RATE
          </span>

          <strong>
            92%
          </strong>

          <small>
            Last 30 days
          </small>
        </div>

      </div>

      <div className={`agent-orchestrator ${orchestrationState.tone}`}>

        <div className="agent-orchestrator-header">

          <div>
            <p className="section-label">
              MULTI-AGENT INTELLIGENCE
            </p>

            <h2>
              NEXORA Agent Orchestrator
            </h2>

            <p>
              Observable decision and action trace across
              anomaly detection, predictive risk, response
              planning, team optimisation and human governance.
            </p>
          </div>

          <div className="agent-orchestrator-status">

            <span className={`agent-live-dot ${
              gatewayConnected
                ? 'online'
                : 'offline'
            }`}></span>

            <div>
              <small>
                {gatewayConnected
                  ? 'LIVE ORCHESTRATION'
                  : 'GATEWAY OFFLINE'}
              </small>

              <strong>
                {orchestrationState.label}
              </strong>
            </div>

          </div>

        </div>

        <div className="agent-pipeline">

          {agentOrder.map(
            (agent, index) => {
              const trace =
                latestAgentStates[agent]

              const status =
                trace?.status || 'STANDBY'

              const stateClass =
                status === 'WAITING_APPROVAL'
                  ? 'waiting'
                  : status === 'ACTIVE'
                    ? 'active'
                    : [
                        'COMPLETED',
                        'APPROVED',
                        'DISPATCHED',
                      ].includes(status)
                      ? 'complete'
                      : 'standby'

              return (
                <div
                  className="agent-pipeline-wrap"
                  key={agent}
                >

                  <div
                    className={`agent-node ${stateClass}`}
                  >

                    <div className="agent-node-icon">
                      {stateClass === 'complete'
                        ? '✓'
                        : agentMeta[agent].icon}
                    </div>

                    <div>
                      <strong>
                        {agentMeta[agent].label}
                      </strong>

                      <span>
                        {agentMeta[agent].role}
                      </span>

                      <small>
                        {status.replaceAll(
                          '_',
                          ' '
                        )}
                      </small>
                    </div>

                  </div>

                  {index <
                    agentOrder.length - 1 && (
                    <div
                      className={`agent-connector ${
                        trace
                          ? 'energized'
                          : ''
                      }`}
                    >
                      <span></span>
                    </div>
                  )}

                </div>
              )
            }
          )}

        </div>

        <div className="agent-trace-shell">

          <div className="agent-trace-heading">

            <div>
              <span>
                LIVE DECISION TRACE
              </span>

              <small>
                Auditable system actions · no hidden
                reasoning exposed
              </small>
            </div>

            <div className="agent-run-id">
              {latestAgentRunId ||
                'NO ACTIVE RUN'}
            </div>

          </div>

          <div className="agent-trace-list">

            {agentTraceLoading ? (

              <div className="agent-trace-empty">
                Loading orchestration trace...
              </div>

            ) : visibleAgentTrace.length === 0 ? (

              <div className="agent-trace-empty">

                <span>◎</span>

                <div>
                  <strong>
                    AGENT NETWORK STANDBY
                  </strong>

                  <p>
                    Run the WT-04 failure simulation
                    from Digital Twin to observe the
                    multi-agent response pipeline.
                  </p>
                </div>

              </div>

            ) : (

              [...visibleAgentTrace]
                .reverse()
                .map(
                  (trace, index) => {

                    const time =
                      trace.timestamp
                        ? new Date(
                            trace.timestamp
                          ).toLocaleTimeString(
                            'en-GB',
                            {
                              hour:
                                '2-digit',
                              minute:
                                '2-digit',
                              second:
                                '2-digit',
                            }
                          )
                        : '--:--:--'

                    const details =
                      trace.details || {}

                    return (
                      <div
                        className={`agent-trace-row ${
                          trace.status ===
                          'WAITING_APPROVAL'
                            ? 'waiting'
                            : ''
                        }`}
                        key={
                          trace.trace_id ||
                          `${trace.agent}-${index}`
                        }
                      >

                        <div className="agent-trace-time">
                          {time}
                        </div>

                        <div
                          className={`agent-trace-badge agent-${trace.agent?.toLowerCase()}`}
                        >
                          {trace.agent}
                        </div>

                        <div className="agent-trace-content">

                          <strong>
                            {trace.action}
                          </strong>

                          <div className="agent-trace-details">

                            {details.pressure !==
                              undefined && (
                              <span>
                                PRESSURE{' '}
                                <b>
                                  {details.pressure}{' '}
                                  {details.unit ||
                                    'bar'}
                                </b>
                              </span>
                            )}

                            {details.failure_probability !==
                              undefined && (
                              <span>
                                FAILURE RISK{' '}
                                <b>
                                  {
                                    details.failure_probability
                                  }
                                  %
                                </b>
                              </span>
                            )}

                            {details.risk_level && (
                              <span>
                                RISK{' '}
                                <b>
                                  {
                                    details.risk_level
                                  }
                                </b>
                              </span>
                            )}

                            {details.predicted_failure_window && (
                              <span>
                                WINDOW{' '}
                                <b>
                                  {
                                    details.predicted_failure_window
                                  }
                                </b>
                              </span>
                            )}

                            {details.task_count !==
                              undefined && (
                              <span>
                                TASKS{' '}
                                <b>
                                  {
                                    details.task_count
                                  }
                                </b>
                              </span>
                            )}

                            {details.safety_control_count !==
                              undefined && (
                              <span>
                                SAFETY{' '}
                                <b>
                                  {
                                    details.safety_control_count
                                  }
                                </b>
                              </span>
                            )}

                            {details.team && (
                              <span>
                                TEAM{' '}
                                <b>
                                  {details.team}
                                </b>
                              </span>
                            )}

                            {details.dispatch_score !==
                              undefined && (
                              <span>
                                SCORE{' '}
                                <b>
                                  {
                                    details.dispatch_score
                                  }
                                </b>
                              </span>
                            )}

                            {details.teams_evaluated !==
                              undefined && (
                              <span>
                                EVALUATED{' '}
                                <b>
                                  {
                                    details.teams_evaluated
                                  }
                                </b>
                              </span>
                            )}

                            {details.work_order_id && (
                              <span>
                                WORK ORDER{' '}
                                <b>
                                  {
                                    details.work_order_id
                                  }
                                </b>
                              </span>
                            )}

                            {details.approved_by && (
                              <span>
                                APPROVED BY{' '}
                                <b>
                                  {
                                    details.approved_by
                                  }
                                </b>
                              </span>
                            )}

                          </div>

                        </div>

                        <div
                          className={`agent-trace-state ${
                            trace.status ===
                            'WAITING_APPROVAL'
                              ? 'waiting'
                              : [
                                  'COMPLETED',
                                  'APPROVED',
                                  'DISPATCHED',
                                ].includes(
                                  trace.status
                                )
                                ? 'complete'
                                : 'active'
                          }`}
                        >
                          {trace.status.replaceAll(
                            '_',
                            ' '
                          )}
                        </div>

                      </div>
                    )
                  }
                )
            )}

          </div>

        </div>

      </div>

      {selectedWorkOrder && (
        <div
          className={`nexora-work-order ${
            selectedWorkOrder.status ===
            'DISPATCHED'
              ? 'dispatched'
              : ''
          }`}
        >

          {/* HEADER */}

          <div className="nwo-header">

            <div className="nwo-heading">

              <div className="nwo-ai-icon">
                ⚡
              </div>

              <div>
                <p className="nwo-eyebrow">
                  NEXORA INTELLIGENCE ·
                  AI-GENERATED WORK ORDER
                </p>

                <h2>
                  {
                    selectedWorkOrder
                      .title
                  }
                </h2>

                <div className="nwo-identifiers">
                  <span>
                    {
                      selectedWorkOrder
                        .work_order_id
                    }
                  </span>

                  <span>
                    {
                      selectedWorkOrder
                        .incident_id
                    }
                  </span>

                  <span>
                    {
                      selectedWorkOrder
                        .sensor_id
                    }
                  </span>
                </div>
              </div>

            </div>

            <div className="nwo-status-area">

              <span className="nwo-priority">
                {
                  selectedWorkOrder
                    .priority
                }
              </span>

              <span
                className={`nwo-status ${
                  selectedWorkOrder
                    .status ===
                  'DISPATCHED'
                    ? 'complete'
                    : ''
                }`}
              >
                {
                  selectedWorkOrder
                    .status
                    .replaceAll(
                      '_',
                      ' '
                    )
                }
              </span>

            </div>

          </div>

          {/* INTELLIGENCE GRID */}

          <div className="nwo-intelligence-grid">

            <div className="nwo-risk-card">

              <span>
                ML FAILURE RISK
              </span>

              <strong>
                {
                  selectedWorkOrder
                    .failure_probability
                }
                %
              </strong>

              <small>
                Random Forest prediction
              </small>

            </div>

            <div className="nwo-data-card">

              <span>
                FAILURE WINDOW
              </span>

              <strong>
                {
                  selectedWorkOrder
                    .predicted_failure_window
                }
              </strong>

              <small>
                Predicted maintenance window
              </small>

            </div>

            <div className="nwo-data-card">

              <span>
                AFFECTED ASSET
              </span>

              <strong>
                {
                  selectedWorkOrder
                    .sensor_id
                }
              </strong>

              <small>
                {
                  selectedWorkOrder
                    .zone
                } · Water Network
              </small>

            </div>

            <div className="nwo-data-card">

              <span>
                AUTOMATION
              </span>

              <strong>
                HUMAN-IN-THE-LOOP
              </strong>

              <small>
                Approval required before dispatch
              </small>

            </div>

          </div>

          {/* BODY */}

          <div className="nwo-body">

            {/* LEFT */}

            <div className="nwo-column">

              <div className="nwo-section">

                <div className="nwo-section-heading">
                  <span>
                    GENERATED WORK SCOPE
                  </span>

                  <small>
                    {
                      selectedWorkOrder
                        .generated_scope
                        ?.length || 0
                    } TASKS
                  </small>
                </div>

                <div className="nwo-scope-list">

                  {
                    selectedWorkOrder
                      .generated_scope
                      ?.map(
                        (
                          task,
                          index
                        ) => (
                          <div
                            className="nwo-scope-item"
                            key={`${task}-${index}`}
                          >
                            <span>
                              {String(
                                index + 1
                              ).padStart(
                                2,
                                '0'
                              )}
                            </span>

                            <p>
                              {task}
                            </p>
                          </div>
                        )
                      )
                  }

                </div>

              </div>

              <div className="nwo-section">

                <div className="nwo-section-heading">
                  <span>
                    SAFETY CONTROL
                  </span>
                </div>

                <div className="nwo-safety-list">

                  {
                    selectedWorkOrder
                      .safety_notes
                      ?.map(
                        (
                          note,
                          index
                        ) => (
                          <div
                            key={`${note}-${index}`}
                            className="nwo-safety-item"
                          >
                            <span>
                              !
                            </span>

                            <p>
                              {note}
                            </p>
                          </div>
                        )
                      )
                  }

                </div>

              </div>

            </div>

            {/* RIGHT */}

            <div className="nwo-column">

              <div className="nwo-dispatch-card">

                <div className="nwo-section-heading">
                  <span>
                    NEXORA AUTO-DISPATCH
                  </span>

                  <small>
                    RECOMMENDED
                  </small>
                </div>

                <div className="nwo-team">

                  <div className="nwo-team-icon">
                    UR
                  </div>

                  <div>
                    <strong>
                      {
                        selectedWorkOrder
                          .recommended_team
                          .name
                      }
                    </strong>

                    <span>
                      {
                        selectedWorkOrder
                          .recommended_team
                          .specialization
                      }
                    </span>
                  </div>

                  <div className="nwo-match-score">
                    <span>
                      MATCH SCORE
                    </span>

                    <strong>
                      {
                        selectedWorkOrder
                          .recommended_team
                          .dispatch_score
                      }
                    </strong>
                  </div>

                </div>

                <div className="nwo-reasons">

                  {
                    selectedWorkOrder
                      .recommended_team
                      .selection_reasons
                      ?.map(
                        (
                          reason,
                          index
                        ) => (
                          <div
                            key={`${reason}-${index}`}
                          >
                            <span>
                              ✓
                            </span>

                            {reason}
                          </div>
                        )
                      )
                  }

                </div>

              </div>

              {/* TELEMETRY */}

              <div className="nwo-telemetry">

                <div className="nwo-section-heading">
                  <span>
                    TRIGGER TELEMETRY
                  </span>

                  <small>
                    ML INPUT SNAPSHOT
                  </small>
                </div>

                <div className="nwo-telemetry-grid">

                  <div>
                    <span>
                      PRESSURE
                    </span>

                    <strong>
                      {
                        selectedWorkOrder
                          .telemetry_snapshot
                          ?.pressure
                      } bar
                    </strong>
                  </div>

                  <div>
                    <span>
                      FLOW RATE
                    </span>

                    <strong>
                      {
                        selectedWorkOrder
                          .telemetry_snapshot
                          ?.flow_rate
                      }
                    </strong>
                  </div>

                  <div>
                    <span>
                      VIBRATION
                    </span>

                    <strong>
                      {
                        selectedWorkOrder
                          .telemetry_snapshot
                          ?.vibration
                      }
                    </strong>
                  </div>

                  <div>
                    <span>
                      TEMPERATURE
                    </span>

                    <strong>
                      {
                        selectedWorkOrder
                          .telemetry_snapshot
                          ?.temperature
                      }°C
                    </strong>
                  </div>

                  <div>
                    <span>
                      DROP RATE
                    </span>

                    <strong>
                      {
                        selectedWorkOrder
                          .telemetry_snapshot
                          ?.pressure_drop_rate
                      }
                    </strong>
                  </div>

                  <div>
                    <span>
                      ANOMALIES
                    </span>

                    <strong>
                      {
                        selectedWorkOrder
                          .telemetry_snapshot
                          ?.anomaly_count
                      }
                    </strong>
                  </div>

                </div>

              </div>

            </div>

          </div>

          {/* RECOMMENDED ACTION */}

          <div className="nwo-recommendation">

            <span>
              NEXORA RECOMMENDATION
            </span>

            <p>
              {
                selectedWorkOrder
                  .recommended_action
              }
            </p>

          </div>

          {/* APPROVAL */}

          <div className="nwo-approval">

            <div>

              <span
                className={`nwo-approval-indicator ${
                  selectedWorkOrder
                    .status ===
                  'DISPATCHED'
                    ? 'approved'
                    : ''
                }`}
              >
                {
                  selectedWorkOrder
                    .status ===
                  'DISPATCHED'
                    ? '✓'
                    : '!'
                }
              </span>

              <div>

                <strong>
                  {
                    selectedWorkOrder
                      .status ===
                    'DISPATCHED'
                      ? 'WORK ORDER APPROVED & DISPATCHED'
                      : 'HUMAN APPROVAL REQUIRED'
                  }
                </strong>

                <p>
                  {
                    selectedWorkOrder
                      .status ===
                    'DISPATCHED'
                      ? `${selectedWorkOrder.recommended_team.name} has been deployed to ${selectedWorkOrder.zone}.`
                      : 'NEXORA has generated the response plan and recommended a team. An operations controller must authorise deployment.'
                  }
                </p>

              </div>

            </div>

            {
              selectedWorkOrder
                .status ===
              'PENDING_APPROVAL' ? (

                <button
                  type="button"
                  className="nwo-dispatch-button"
                  disabled={
                    dispatching
                  }
                  onClick={() =>
                    approveAndDispatch(
                      selectedWorkOrder
                    )
                  }
                >
                  {
                    dispatching
                      ? 'DISPATCHING...'
                      : 'APPROVE & DISPATCH →'
                  }
                </button>

              ) : (

                <div className="nwo-dispatched-badge">
                  ● TEAM DEPLOYED
                </div>

              )
            }

          </div>

          {workOrderError && (
            <div className="nwo-error">
              {workOrderError}
            </div>
          )}

        </div>
      )}

      {selected.id ===
        'INC-0041' &&
        !selectedWorkOrder &&
        !workOrderLoading && (

          <div className="nwo-waiting">

            <div className="nwo-ai-icon">
              ⚡
            </div>

            <div>
              <strong>
                NEXORA Predictive Response
              </strong>

              <p>
                No AI-generated work order is active.
                Run the WT-04 failure simulation from
                Digital Twin to trigger predictive maintenance.
              </p>
            </div>

          </div>

        )}

      <div className="operations-layout">

        {/* INCIDENT COMMAND */}

        <div className="incident-command">

          <div className="operations-panel-heading">

            <div>
              <p className="section-label">
                LIVE QUEUE
              </p>

              <h2>
                Incident Command
              </h2>
            </div>

            <span>
              {
                incidents.filter(
                  (incident) =>
                    incident.status !==
                    'RESOLVED'
                ).length
              } ACTIVE
            </span>

          </div>

          <div className="incident-command-list">

            {incidents.map(
              (incident) => (

                <button
                  type="button"
                  key={incident.id}
                  className={`command-incident ${
                    selectedIncident ===
                    incident.id
                      ? 'selected'
                      : ''
                  } ${
                    incident.status ===
                    'RESOLVED'
                      ? 'resolved'
                      : ''
                  }`}
                  onClick={() =>
                    setSelectedIncident(
                      incident.id
                    )
                  }
                >

                  <div className="incident-time">
                    {incident.time}
                  </div>

                  <div className="incident-main">

                    <div className="incident-id">
                      {incident.id}
                    </div>

                    <strong>
                      {incident.title}
                    </strong>

                    <span>
                      {incident.location}
                    </span>

                  </div>

                  <div className="incident-state">

                    <span
                      className={`severity ${incident.severity.toLowerCase()}`}
                    >
                      {
                        incident.severity
                      }
                    </span>

                    <small>
                      {incident.status}
                    </small>

                  </div>

                </button>

              )
            )}

          </div>

        </div>

        <aside className="incident-inspector">

          <p className="section-label">
            INCIDENT DETAIL
          </p>

          <div className="incident-inspector-title">

            <div>

              <span>
                {selected.id}
              </span>

              <h2>
                {selected.title}
              </h2>

              <p>
                {selected.location}
              </p>

            </div>

            <span
              className={`severity ${selected.severity.toLowerCase()}`}
            >
              {selected.severity}
            </span>

          </div>

          {/* SUMMARY */}

          <div className="incident-description">

            <span>
              INTELLIGENCE SUMMARY
            </span>

            <p>
              {selected.description}
            </p>

          </div>

          {/* METADATA */}

          <div className="incident-metadata">

            <div>
              <span>
                STATUS
              </span>

              <strong>
                {selected.status}
              </strong>
            </div>

            <div>
              <span>
                SOURCE
              </span>

              <strong>
                {selected.source}
              </strong>
            </div>

            <div>
              <span>
                ASSIGNED TEAM
              </span>

              <strong>
                {selected.team}
              </strong>
            </div>

            <div>
              <span>
                DETECTED
              </span>

              <strong>
                {selected.time}
              </strong>
            </div>

          </div>

          {/* AI LINK */}

          {selectedWorkOrder && (

            <div className="incident-ai-link">

              <span>
                ⚡ NEXORA WORK ORDER
              </span>

              <strong>
                {
                  selectedWorkOrder
                    .work_order_id
                }
              </strong>

              <small>
                {
                  selectedWorkOrder
                    .status
                    .replaceAll(
                      '_',
                      ' '
                    )
                }
              </small>

            </div>

          )}

          {/* ACTIONS */}

          <div className="incident-actions">

            <button
              type="button"
              onClick={
                viewOnDigitalTwin
              }
              disabled={
                !selected.sensorID
              }
              title={
                selected.sensorID
                  ? `View ${selected.sensorID} on Digital Twin`
                  : 'No Digital Twin sensor linked to this incident'
              }
            >
              VIEW ON DIGITAL TWIN
            </button>

            <button
              type="button"
              className="primary-action"
              onClick={
                openResponse
              }
            >
              OPEN RESPONSE
            </button>

          </div>

        </aside>

      </div>

      <div className="operations-lower">

        {/* RESPONSE TEAMS */}

        <div className="response-teams">

          <div className="operations-panel-heading">

            <div>
              <p className="section-label">
                FIELD OPERATIONS
              </p>

              <h2>
                Response Teams
              </h2>
            </div>

          </div>

          <div className="team-list">

            {teams.map(
              (team) => (

                <div
                  className="team-row"
                  key={team.name}
                >

                  <div>

                    <strong>
                      {team.name}
                    </strong>

                    <span>
                      {team.type}
                    </span>

                  </div>

                  <div>

                    <small>
                      {team.task}
                    </small>

                    <b
                      className={
                        team.status ===
                        'AVAILABLE'
                          ? 'team-available'
                          : ''
                      }
                    >
                      ● {team.status}
                    </b>

                  </div>

                </div>

              )
            )}

          </div>

        </div>

        {/* ACTIVITY LOG */}

        <div className="operations-log">

          <div className="operations-panel-heading">

            <div>
              <p className="section-label">
                SYSTEM FEED
              </p>

              <h2>
                Activity Log
              </h2>
            </div>

          </div>

          <div className="activity-list">

            {activityLog.map(
              (
                activity,
                index
              ) => (

                <div
                  className="activity-row"
                  key={`${activity.time}-${index}`}
                >

                  <span>
                    {activity.time}
                  </span>

                  <p>
                    {activity.text}{' '}

                    <strong>
                      {
                        activity.highlight
                      }
                    </strong>
                  </p>

                </div>

              )
            )}

          </div>

        </div>

      </div>

      {responseOpen && (

        <div
          className="response-modal-overlay"
          onClick={
            closeResponse
          }
        >

          <div
            className="response-modal"
            onClick={(e) =>
              e.stopPropagation()
            }
          >

            {/* MODAL HEADER */}

            <div className="response-modal-header">

              <div>

                <p className="section-label">
                  RESPONSE CONTROL
                </p>

                <h2>
                  {selected.id}
                </h2>

                <span>
                  {selected.title}
                </span>

              </div>

              <button
                type="button"
                className="response-close"
                onClick={
                  closeResponse
                }
              >
                ×
              </button>

            </div>

            {/* INCIDENT SOURCE */}

            <div className="response-source">

              <span>
                INCIDENT SOURCE
              </span>

              <strong>
                {selected.source}
              </strong>

            </div>

            {/* STATUS */}

            <div className="response-field">

              <label>
                RESPONSE STATUS
              </label>

              <div className="response-status-options">

                <button
                  type="button"
                  className={
                    responseStatus ===
                    'DISPATCHED'
                      ? 'active'
                      : ''
                  }
                  onClick={() =>
                    setResponseStatus(
                      'DISPATCHED'
                    )
                  }
                >
                  DISPATCHED
                </button>

                <button
                  type="button"
                  className={
                    responseStatus ===
                    'IN PROGRESS'
                      ? 'active'
                      : ''
                  }
                  onClick={() =>
                    setResponseStatus(
                      'IN PROGRESS'
                    )
                  }
                >
                  IN PROGRESS
                </button>

                <button
                  type="button"
                  className={
                    responseStatus ===
                    'RESOLVED'
                      ? 'active'
                      : ''
                  }
                  onClick={() =>
                    setResponseStatus(
                      'RESOLVED'
                    )
                  }
                >
                  RESOLVED
                </button>

              </div>

            </div>

            {/* TEAM */}

            <div className="response-field">

              <label htmlFor="response-team">
                ASSIGN RESPONSE TEAM
              </label>

              <select
                id="response-team"
                value={
                  responseTeam
                }
                onChange={(e) =>
                  setResponseTeam(
                    e.target.value
                  )
                }
              >

                <option>
                  Utility Response 02
                </option>

                <option>
                  Civil Works 01
                </option>

                <option>
                  Electrical Team 03
                </option>

                <option>
                  Mobility Control
                </option>

                <option>
                  Emergency Response 01
                </option>

              </select>

            </div>

            {/* NOTE */}

            <div className="response-field">

              <label htmlFor="response-note">
                RESPONSE NOTE
              </label>

              <textarea
                id="response-note"
                value={
                  responseNote
                }
                onChange={(e) =>
                  setResponseNote(
                    e.target.value
                  )
                }
                placeholder="Add operational note..."
              />

            </div>

            {/* FOOTER */}

            <div className="response-modal-footer">

              <button
                type="button"
                className="response-cancel"
                onClick={
                  closeResponse
                }
              >
                CANCEL
              </button>

              <button
                type="button"
                className="response-confirm"
                onClick={
                  confirmResponse
                }
              >
                CONFIRM RESPONSE
              </button>

            </div>

          </div>

        </div>

      )}

    </section>
  )
}

export default Operations