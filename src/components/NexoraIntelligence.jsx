import { useState } from 'react'

function NexoraIntelligence({
  openSensorInDigitalTwin,
  openOperations,
  openSustainability,
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [conversation, setConversation] = useState([])

  const suggestions = [
    'What requires immediate attention?',
    'What is happening in Zone C?',
    'Summarise township health',
    'Show sustainability risks',
  ]

  const intelligence = {
    priority: {
      title: '1 priority issue detected',
      tag: 'CRITICAL',
      text:
        'Zone C requires immediate attention. Water pressure sensor WT-04 is reporting 1.8 bar, while water consumption is 18% above the expected baseline. Incident INC-0041 is currently active.',
      insight:
        'Recommended response: inspect the Zone C water distribution network for potential leakage or pressure loss.',
      actions: ['sensor', 'incident'],
    },

    zoneC: {
      title: 'Zone C intelligence summary',
      tag: 'ATTENTION',
      text:
        'Zone C is experiencing abnormal water network behaviour. Sensor WT-04 is reporting critically low pressure at 1.8 bar, while environmental monitoring shows water consumption 18% above the expected baseline.',
      insight:
        'The combined pressure and consumption anomaly may indicate leakage, distribution loss or abnormal demand.',
      actions: ['sensor', 'incident'],
    },

    health: {
      title: 'Township operating normally',
      tag: '91 / 100',
      text:
        'Overall township health is 91/100. Four incidents are being monitored, including one critical water network alert in Zone C. Resolution performance remains at 92%.',
      insight:
        'Most infrastructure remains operational, with Zone C water infrastructure currently representing the highest priority.',
      actions: ['incident'],
    },

    sustainability: {
      title: 'Water efficiency requires attention',
      tag: 'ENVIRONMENT',
      text:
        'Energy consumption is down 8.2%, carbon emissions are down 6.7%, and waste diversion has reached 71%. Water consumption is currently 12.4% above the normal baseline.',
      insight:
        'Zone C is the primary environmental concern due to elevated consumption occurring alongside the WT-04 pressure anomaly.',
      actions: ['sustainability', 'sensor'],
    },
  }

  const determineResponse = (message) => {
    const text = message.toLowerCase()

    if (
      text.includes('immediate') ||
      text.includes('priority') ||
      text.includes('attention') ||
      text.includes('critical')
    ) {
      return intelligence.priority
    }

    if (
      text.includes('zone c') ||
      text.includes('water') ||
      text.includes('wt-04') ||
      text.includes('wt04')
    ) {
      return intelligence.zoneC
    }

    if (
      text.includes('sustain') ||
      text.includes('environment') ||
      text.includes('carbon') ||
      text.includes('energy') ||
      text.includes('waste')
    ) {
      return intelligence.sustainability
    }

    if (
      text.includes('health') ||
      text.includes('summary') ||
      text.includes('summarise') ||
      text.includes('summarize') ||
      text.includes('township')
    ) {
      return intelligence.health
    }

    return {
      title: 'Township intelligence available',
      tag: 'NEXORA',
      text:
        'I can analyse current township operations, infrastructure sensors, active incidents and environmental performance.',
      insight:
        'Try asking about immediate priorities, Zone C, township health or sustainability risks.',
      actions: [],
    }
  }

  const askNexora = (message) => {
    const cleaned = message.trim()

    if (!cleaned) return

    const response = determineResponse(cleaned)

    setConversation((current) => [
      ...current,
      {
        id: Date.now(),
        question: cleaned,
        response,
      },
    ])

    setQuery('')
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    askNexora(query)
  }

  const handleAction = (action) => {
    if (action === 'sensor') {
      openSensorInDigitalTwin?.('WT-04')
      setIsOpen(false)
    }

    if (action === 'incident') {
      openOperations?.()
      setIsOpen(false)
    }

    if (action === 'sustainability') {
      openSustainability?.()
      setIsOpen(false)
    }
  }

  const clearConversation = () => {
    setConversation([])
  }

  return (
    <>
      {/* FLOATING BUTTON */}

      <button
        type="button"
        className={`nexora-ai-trigger ${
          isOpen ? 'active' : ''
        }`}
        onClick={() => setIsOpen(true)}
      >
       <span className="nexora-ai-symbol nexora-bolt">
  ⚡
</span>

        <span>
          ASK NEXORA
        </span>

        <i></i>
      </button>


      {/* PANEL */}

      <div
        className={`nexora-ai-overlay ${
          isOpen ? 'open' : ''
        }`}
        onClick={() => setIsOpen(false)}
      ></div>


      <aside
        className={`nexora-ai-panel ${
          isOpen ? 'open' : ''
        }`}
      >

        {/* HEADER */}

        <div className="nexora-ai-header">

          <div className="nexora-ai-brand">

            <div className="nexora-ai-logo">
              ✦
            </div>

            <div>
              <span>
                NEXORA INTELLIGENCE
              </span>

              <h2>
                Township Assistant
              </h2>
            </div>

          </div>


          <button
            type="button"
            className="nexora-ai-close"
            onClick={() => setIsOpen(false)}
            aria-label="Close NEXORA Intelligence"
          >
            ×
          </button>

        </div>


        {/* SYSTEM STATUS */}

        <div className="nexora-ai-system">

          <div>
            <span className="nexora-ai-online"></span>

            <strong>
              INTELLIGENCE ONLINE
            </strong>
          </div>

          <span>
            LIVE TOWNSHIP CONTEXT
          </span>

        </div>


        {/* BODY */}

        <div className="nexora-ai-body">

          {conversation.length === 0 ? (
            <div className="nexora-ai-welcome">

              <span className="nexora-ai-welcome-icon">
                ✦
              </span>

              <p className="section-label">
                NEXORA INTELLIGENCE
              </p>

              <h3>
                How can I assist?
              </h3>

              <p>
                Ask about township operations,
                infrastructure conditions, active incidents
                or environmental performance.
              </p>


              <div className="nexora-ai-context">

                <span>
                  CURRENT CONTEXT
                </span>

                <div>

                  <p>
                    <i className="context-dot normal"></i>

                    Township health

                    <strong>
                      91 / 100
                    </strong>
                  </p>


                  <p>
                    <i className="context-dot critical"></i>

                    Critical alerts

                    <strong>
                      1
                    </strong>
                  </p>


                  <p>
                    <i className="context-dot warning"></i>

                    Zone C water

                    <strong>
                      ATTENTION
                    </strong>
                  </p>

                </div>

              </div>


              <div className="nexora-ai-suggestions">

                <span>
                  SUGGESTED QUESTIONS
                </span>

                {suggestions.map((suggestion) => (
                  <button
                    type="button"
                    key={suggestion}
                    onClick={() =>
                      askNexora(suggestion)
                    }
                  >
                    <span>
                      {suggestion}
                    </span>

                    <b>
                      →
                    </b>
                  </button>
                ))}

              </div>

            </div>
          ) : (
            <div className="nexora-ai-conversation">

              {conversation.map((item) => (
                <div
                  className="nexora-ai-exchange"
                  key={item.id}
                >

                  {/* USER QUESTION */}

                  <div className="nexora-ai-question">

                    <span>
                      YOU
                    </span>

                    <p>
                      {item.question}
                    </p>

                  </div>


                  {/* AI RESPONSE */}

                  <div className="nexora-ai-answer">

                    <div className="nexora-ai-answer-label">

                      <span>
                        ✦ NEXORA
                      </span>

                      <b>
                        {item.response.tag}
                      </b>

                    </div>


                    <h3>
                      {item.response.title}
                    </h3>


                    <p>
                      {item.response.text}
                    </p>


                    <div className="nexora-ai-insight">

                      <span>
                        INTELLIGENCE ASSESSMENT
                      </span>

                      <p>
                        {item.response.insight}
                      </p>

                    </div>


                    {item.response.actions.length > 0 && (
                      <div className="nexora-ai-actions">

                        {item.response.actions.includes(
                          'sensor'
                        ) && (
                          <button
                            type="button"
                            onClick={() =>
                              handleAction('sensor')
                            }
                          >
                            VIEW SENSOR
                          </button>
                        )}


                        {item.response.actions.includes(
                          'incident'
                        ) && (
                          <button
                            type="button"
                            onClick={() =>
                              handleAction('incident')
                            }
                          >
                            OPEN INCIDENT
                          </button>
                        )}


                        {item.response.actions.includes(
                          'sustainability'
                        ) && (
                          <button
                            type="button"
                            onClick={() =>
                              handleAction(
                                'sustainability'
                              )
                            }
                          >
                            VIEW SUSTAINABILITY
                          </button>
                        )}

                      </div>
                    )}

                  </div>

                </div>
              ))}


              <div className="nexora-ai-after">

                <span>
                  ASK ANOTHER QUESTION
                </span>

                <div className="nexora-ai-mini-suggestions">

                  {suggestions.map((suggestion) => (
                    <button
                      type="button"
                      key={suggestion}
                      onClick={() =>
                        askNexora(suggestion)
                      }
                    >
                      {suggestion}
                    </button>
                  ))}

                </div>


                <button
                  type="button"
                  className="nexora-ai-clear"
                  onClick={clearConversation}
                >
                  CLEAR CONVERSATION
                </button>

              </div>

            </div>
          )}

        </div>


        {/* INPUT */}

        <form
          className="nexora-ai-input"
          onSubmit={handleSubmit}
        >

          <div>

            <span>
              ✦
            </span>

            <input
              type="text"
              value={query}
              onChange={(event) =>
                setQuery(event.target.value)
              }
              placeholder="Ask NEXORA about the township..."
            />

          </div>


          <button
            type="submit"
            disabled={!query.trim()}
          >
            ASK
          </button>

        </form>


        <div className="nexora-ai-footer">
          NEXORA INTELLIGENCE · LIVE TOWNSHIP CONTEXT
        </div>

      </aside>
    </>
  )
}

export default NexoraIntelligence