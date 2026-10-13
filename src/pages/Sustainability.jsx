import { useState } from 'react'



function Sustainability({ openSensorInDigitalTwin, liveWT04 }) {

  const [activeMetric, setActiveMetric] = useState('energy')

  const waterCritical = liveWT04?.status === 'Critical'
  const waterWarning = liveWT04?.status === 'Warning'
  const waterAttention = waterCritical || waterWarning



  const metrics = {

    energy: {

      label: 'ENERGY CONSUMPTION',

      value: '1.84',

      unit: 'MWh',

      change: '↓ 8.2%',

      changeLabel: 'vs last month',

      status: 'EFFICIENCY IMPROVING',

      description:

        'Township electricity demand remains below the monthly operational baseline.',

    },



    water: {
      label: 'WATER CONSUMPTION',
      value: waterAttention ? '428' : '382',
      unit: 'm³',
      change: waterAttention ? '↑ 12.4%' : '↓ 3.1%',
      changeLabel: waterAttention ? 'vs normal baseline' : 'vs normal baseline',
      status: waterAttention ? 'ATTENTION REQUIRED' : 'WITHIN NORMAL RANGE',
      description: waterAttention
        ? 'Water demand is elevated alongside abnormal WT-04 pressure readings in Zone C.'
        : 'Township water demand and Zone C pressure are within the expected operating range.',
    },



    carbon: {

      label: 'CARBON EMISSIONS',

      value: '642',

      unit: 'kg CO₂e',

      change: '↓ 6.7%',

      changeLabel: 'vs last month',

      status: 'ON TRACK',

      description:

        'Estimated operational carbon emissions continue to decline against the monthly target.',

    },



    waste: {

      label: 'WASTE DIVERSION',

      value: '71',

      unit: '%',

      change: '↑ 4.1%',

      changeLabel: 'this month',

      status: 'ON TRACK',

      description:

        'Recycling and waste recovery performance has improved across township sectors.',

    },

  }



  const metric = metrics[activeMetric]



  const zones = [

    {

      zone: 'Zone A',

      type: 'Residential',

      energy: '82%',

      water: '88%',

      waste: '76%',

      score: '84',

      status: 'GOOD',

    },

    {

      zone: 'Zone B',

      type: 'Commercial',

      energy: '74%',

      water: '81%',

      waste: '69%',

      score: '75',

      status: 'STABLE',

    },

    {

      zone: 'Zone C',

      type: 'Residential',

      energy: '79%',

      water: '62%',

      waste: '73%',

      score: '71',

      status: 'ATTENTION',

    },

  ]



  const targets = [

    {

      name: 'Energy Reduction',

      value: 68,

      target: '15% reduction by Q4',

    },

    {

      name: 'Water Efficiency',

      value: 54,

      target: '12% reduction by Q4',

    },

    {

      name: 'Waste Diversion',

      value: 71,

      target: '80% diversion target',

    },

    {

      name: 'Carbon Reduction',

      value: 63,

      target: '20% reduction by year end',

    },

  ]



  return (

    <section className="sustainability-page">



      {/* HEADER */}

      <div className="sustainability-heading">



        <div>

          <p className="section-label">

            SUSTAINABILITY

          </p>



          <h1>

            Environmental Intelligence

          </h1>



          <p className="sustainability-description">

            Real-time resource efficiency and environmental

            performance across the township.

          </p>

        </div>



        <div className="sustainability-live">

          <span className="live-dot"></span>

          ENVIRONMENT LIVE

        </div>



      </div>





      {/* KPI CARDS */}

      <div className="sustainability-stats">



        <button

          type="button"

          className={`sustainability-stat ${

            activeMetric === 'energy' ? 'active' : ''

          }`}

          onClick={() => setActiveMetric('energy')}

        >

          <span>ENERGY CONSUMPTION</span>



          <div>

            <strong>1.84</strong>

            <small>MWh</small>

          </div>



          <p className="positive">

            ↓ 8.2% vs last month

          </p>

        </button>





        <button

          type="button"

          className={`sustainability-stat ${

            activeMetric === 'water' ? 'active' : ''

          }`}

          onClick={() => setActiveMetric('water')}

        >

          <span>WATER CONSUMPTION</span>



          <div>

            <strong>{waterAttention ? '428' : '382'}</strong>

            <small>m³</small>

          </div>



          <p className="warning">

            ↑ 12.4% above baseline

          </p>

        </button>





        <button

          type="button"

          className={`sustainability-stat ${

            activeMetric === 'carbon' ? 'active' : ''

          }`}

          onClick={() => setActiveMetric('carbon')}

        >

          <span>CARBON EMISSIONS</span>



          <div>

            <strong>642</strong>

            <small>kg CO₂e</small>

          </div>



          <p className="positive">

            ↓ 6.7% vs last month

          </p>

        </button>





        <button

          type="button"

          className={`sustainability-stat ${

            activeMetric === 'waste' ? 'active' : ''

          }`}

          onClick={() => setActiveMetric('waste')}

        >

          <span>WASTE DIVERSION</span>



          <div>

            <strong>71</strong>

            <small>%</small>

          </div>



          <p className="positive">

            ↑ 4.1% this month

          </p>

        </button>



      </div>





      {/* MAIN INTELLIGENCE AREA */}

      <div className="sustainability-grid">



        {/* PERFORMANCE PANEL */}

        <div className="environment-performance">



          <div className="sustainability-panel-heading">



            <div>

              <p className="section-label">

                RESOURCE INTELLIGENCE

              </p>



              <h2>

                Performance Overview

              </h2>

            </div>



            <span>

              LIVE DATA

            </span>



          </div>





          <div className="metric-overview">



            <div className="metric-overview-heading">



              <div>

                <span>

                  {metric.label}

                </span>



                <div className="metric-large-value">

                  <strong>

                    {metric.value}

                  </strong>



                  <small>

                    {metric.unit}

                  </small>

                </div>

              </div>





              <div className="metric-change">

                <strong>

                  {metric.change}

                </strong>



                <span>

                  {metric.changeLabel}

                </span>

              </div>



            </div>





            {/* MOCK TREND GRAPH */}

            <div className="environment-chart">



              <div className="chart-grid-line line-1"></div>

              <div className="chart-grid-line line-2"></div>

              <div className="chart-grid-line line-3"></div>



              <div className="chart-bars">



                <div style={{ height: '48%' }}></div>

                <div style={{ height: '58%' }}></div>

                <div style={{ height: '52%' }}></div>

                <div style={{ height: '70%' }}></div>

                <div style={{ height: '64%' }}></div>

                <div style={{ height: '76%' }}></div>

                <div style={{ height: '62%' }}></div>

                <div style={{ height: '55%' }}></div>

                <div style={{ height: '67%' }}></div>

                <div style={{ height: '59%' }}></div>

                <div style={{ height: '51%' }}></div>

                <div style={{ height: '46%' }}></div>



              </div>



              <div className="chart-labels">

                <span>00:00</span>

                <span>06:00</span>

                <span>12:00</span>

                <span>18:00</span>

                <span>NOW</span>

              </div>



            </div>





            <div className="metric-intelligence">



              <div>

                <span>

                  SYSTEM ASSESSMENT

                </span>



                <strong>

                  {metric.status}

                </strong>

              </div>



              <p>

                {metric.description}

              </p>



            </div>



          </div>



        </div>





        {/* INTELLIGENCE ALERT */}
        <aside className="environment-alert">
          <div className="alert-heading">
            <div>
              <p className="section-label">
                {waterAttention ? 'INTELLIGENCE ALERT' : 'WATER NETWORK'}
              </p>
              <h2>
                {waterAttention ? 'Water Anomaly' : 'Water Network Stable'}
              </h2>
            </div>

            <span
              className="environment-alert-level"
              style={
                waterAttention
                  ? undefined
                  : {
                      color: '#15803d',
                      borderColor: '#86efac',
                      background: '#f0fdf4',
                    }
              }
            >
              {waterCritical ? 'CRITICAL' : waterWarning ? 'ATTENTION' : 'NORMAL'}
            </span>
          </div>

          <div className="environment-alert-value">
            <span>WT-04 LIVE PRESSURE</span>
            <strong>{liveWT04?.value ?? 3.2}</strong>
            <small>BAR · ZONE C</small>
          </div>

          <p className="environment-alert-text">
            {waterAttention
              ? 'Zone C water performance requires attention alongside abnormal pressure readings from sensor WT-04.'
              : 'Zone C water infrastructure is operating within the expected pressure and consumption range.'}
          </p>

          <div className="environment-alert-meta">
            <div><span>SECTOR</span><strong>Zone C</strong></div>
            <div><span>SENSOR</span><strong>WT-04</strong></div>
            <div><span>NETWORK</span><strong>Water</strong></div>
          </div>

          <button
            type="button"
            onClick={() => openSensorInDigitalTwin?.('WT-04')}
          >
            VIEW IN DIGITAL TWIN →
          </button>
        </aside>



      </div>





      {/* LOWER AREA */}

      <div className="sustainability-lower">



        {/* ZONE PERFORMANCE */}

        <div className="zone-efficiency">



          <div className="sustainability-panel-heading">



            <div>

              <p className="section-label">

                SECTOR PERFORMANCE

              </p>



              <h2>

                Zone Efficiency

              </h2>

            </div>



          </div>





          <div className="zone-efficiency-table">



            <div className="zone-efficiency-header">

              <span>SECTOR</span>

              <span>ENERGY</span>

              <span>WATER</span>

              <span>WASTE</span>

              <span>SCORE</span>

              <span>STATUS</span>

            </div>





            {zones.map((zone) => (



              <div

                className="zone-efficiency-row"

                key={zone.zone}

              >



                <div>

                  <strong>

                    {zone.zone}

                  </strong>



                  <small>

                    {zone.type}

                  </small>

                </div>



                <span>{zone.energy}</span>

                <span>{zone.water}</span>

                <span>{zone.waste}</span>



                <strong className="zone-score">

                  {zone.score}

                </strong>



                <b

                  className={

                    zone.status === 'ATTENTION'

                      ? 'zone-efficiency-warning'

                      : ''

                  }

                >

                  ● {zone.status}

                </b>



              </div>



            ))}



          </div>



        </div>





        {/* TARGETS */}

        <div className="sustainability-targets">



          <div className="sustainability-panel-heading">



            <div>

              <p className="section-label">

                2026 TARGETS

              </p>



              <h2>

                Sustainability Goals

              </h2>

            </div>



          </div>





          <div className="target-list">



            {targets.map((target) => (



              <div

                className="target-item"

                key={target.name}

              >



                <div className="target-heading">



                  <div>

                    <strong>

                      {target.name}

                    </strong>



                    <span>

                      {target.target}

                    </span>

                  </div>



                  <b>

                    {target.value}%

                  </b>



                </div>





                <div className="target-progress">



                  <div

                    style={{

                      width: `${target.value}%`,

                    }}

                  ></div>



                </div>



              </div>



            ))}



          </div>



        </div>



      </div>



    </section>

  )

}



export default Sustainability