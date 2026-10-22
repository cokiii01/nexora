import { useState } from 'react'







function ResidentPortal({ backToHome, liveWT04 }) {



  const [activeTab, setActiveTab] = useState('home')

  const waterCritical = liveWT04?.status === 'Critical'
  const waterWarning = liveWT04?.status === 'Warning'
  const waterAttention = waterCritical || waterWarning



  const [submitted, setSubmitted] = useState(false)







  const [formData, setFormData] = useState({



    category: '',



    location: '',



    description: '',



  })







  const reports = [



    {



      id: 'INC-0038',



      category: 'Road & Infrastructure',



      title: 'Road surface damage',



      location: 'Zone A · Jalan NEXORA 3',



      date: '30 Sep 2026',



      status: 'IN PROGRESS',



      progress: 66,



    },



    {



      id: 'INC-0027',



      category: 'Lighting',



      title: 'Streetlight flickering',



      location: 'Zone B · Commercial Walk',



      date: '24 Sep 2026',



      status: 'RESOLVED',



      progress: 100,



    },



  ]







  const updates = [



    {



      tag: 'MAINTENANCE',



      date: '02 OCT',



      title: 'Scheduled water network inspection',



      text:



        'Maintenance teams will conduct a routine water network inspection in Zone C from 10:00 AM to 12:00 PM.',



    },



    {



      tag: 'COMMUNITY',



      date: '05 OCT',



      title: 'Weekend community recycling drive',



      text:



        'Residents can drop off recyclable household materials at the Zone A Community Hub.',



    },



    {



      tag: 'MOBILITY',



      date: '07 OCT',



      title: 'Traffic flow improvement works',



      text:



        'Minor traffic diversions will take place near the Zone B commercial district.',



    },



  ]







  const handleChange = (event) => {



    const { name, value } = event.target







    setFormData((current) => ({



      ...current,



      [name]: value,



    }))



  }







  const handleSubmit = (event) => {



    event.preventDefault()







    if (



      !formData.category ||



      !formData.location ||



      !formData.description.trim()



    ) {



      return



    }







    setSubmitted(true)



  }







  const resetReport = () => {



    setSubmitted(false)







    setFormData({



      category: '',



      location: '',



      description: '',



    })







    setActiveTab('reports')



  }







  return (



    <div className="resident-portal">



      <header className="resident-nav">



        <button



          type="button"



          className="resident-brand"



          onClick={() => setActiveTab('home')}



        >



          <span className="resident-logo">⚡</span>







          <div>



            <strong>NEXORA</strong>



            <small>CONNECT</small>



          </div>



        </button>







        <nav>



          <button



            type="button"



            className={activeTab === 'home' ? 'active' : ''}



            onClick={() => setActiveTab('home')}



          >



            HOME



          </button>







          <button



            type="button"



            className={activeTab === 'report' ? 'active' : ''}



            onClick={() => {



              setSubmitted(false)



              setActiveTab('report')



            }}



          >



            REPORT ISSUE



          </button>







          <button



            type="button"



            className={activeTab === 'reports' ? 'active' : ''}



            onClick={() => setActiveTab('reports')}



          >



            MY REPORTS



          </button>







          <button



            type="button"



            className={activeTab === 'updates' ? 'active' : ''}



            onClick={() => setActiveTab('updates')}



          >



            UPDATES



          </button>



        </nav>







        <div className="resident-nav-right">



          <div className="resident-profile">



            <span>MS</span>







            <div>



              <strong>RESIDENT</strong>



              <small>ZONE A</small>



            </div>



          </div>







          {backToHome && (



            <button



              type="button"



              className="resident-exit"



              onClick={backToHome}



            >



              EXIT



            </button>



          )}



        </div>



      </header>







      {activeTab === 'home' && (



        <main className="resident-home">



          <section className="resident-hero">



            <div className="resident-hero-copy">



              <p className="resident-eyebrow">



                NEXORA CONNECT



              </p>







              <h1>



                Your township.



                <br />



                <span>Connected.</span>



              </h1>







              <p className="resident-hero-description">



                Report issues, track responses and stay



                informed about what is happening across



                your community.



              </p>







              <div className="resident-hero-actions">



                <button



                  type="button"



                  className="resident-primary-btn"



                  onClick={() => {



                    setSubmitted(false)



                    setActiveTab('report')



                  }}



                >



                  REPORT AN ISSUE



                  <span>→</span>



                </button>







                <button



                  type="button"



                  className="resident-secondary-btn"



                  onClick={() => setActiveTab('reports')}



                >



                  TRACK MY REPORTS



                </button>



              </div>



            </div>







            <div className="resident-status-card">



              <div className="resident-status-top">



                <span>



                  <i></i>



                  TOWNSHIP STATUS



                </span>







                <strong>{waterAttention ? 'SERVICE ADVISORY' : 'OPERATIONAL'}</strong>



              </div>







              <div className="resident-status-main">



                <span className="resident-status-icon">



                  ✓



                </span>







                <div>



                  <p>YOUR AREA</p>



                  <h3>
                    {waterAttention
                      ? 'Zone A remains operational'
                      : 'Zone A is operating normally'}
                  </h3>



                  <span>



                    No major disruptions currently affecting



                    your area.



                  </span>



                </div>



              </div>







              <div className="resident-status-grid">



                <div>



                  <span>SAFETY</span>



                  <strong>NORMAL</strong>



                </div>







                <div>



                  <span>WATER</span>



                  <strong>NORMAL</strong>



                </div>







                <div>



                  <span>TRAFFIC</span>



                  <strong>MODERATE</strong>



                </div>



              </div>



            </div>



          </section>







          <section className="resident-quick-section">



            <div className="resident-section-heading">



              <div>



                <p>COMMUNITY SERVICES</p>



                <h2>How can we help?</h2>



              </div>







              <span>



                Connected directly to NEXORA Township



                Operations



              </span>



            </div>







            <div className="resident-service-grid">



              <button



                type="button"



                onClick={() => {



                  setSubmitted(false)



                  setActiveTab('report')



                }}



              >



                <span className="service-number">01</span>



                <div className="service-icon">!</div>



                <h3>Report an Issue</h3>



                <p>



                  Tell township management about



                  infrastructure, safety or environmental



                  issues.



                </p>



                <strong>START REPORT →</strong>



              </button>







              <button



                type="button"



                onClick={() => setActiveTab('reports')}



              >



                <span className="service-number">02</span>



                <div className="service-icon">◎</div>



                <h3>Track Response</h3>



                <p>



                  Follow the progress of your reports from



                  submission through resolution.



                </p>



                <strong>VIEW REPORTS →</strong>



              </button>







              <button



                type="button"



                onClick={() => setActiveTab('updates')}



              >



                <span className="service-number">03</span>



                <div className="service-icon">⌁</div>



                <h3>Township Updates</h3>



                <p>



                  Stay informed about maintenance,



                  community activities and local changes.



                </p>



                <strong>VIEW UPDATES →</strong>



              </button>



            </div>



          </section>







          <section className="resident-home-report">



            <div>



              <p className="resident-eyebrow">



                YOUR LATEST REPORT



              </p>







              <h2>Road surface damage</h2>







              <span>



                INC-0038 · Zone A · Jalan NEXORA 3



              </span>



            </div>







            <div className="resident-home-progress">



              <div>



                <span>IN PROGRESS</span>



                <strong>66%</strong>



              </div>







              <div className="resident-progress-track">



                <i style={{ width: '66%' }}></i>



              </div>







              <p>



                Response team has been assigned and the



                issue is currently being assessed.



              </p>



            </div>







            <button



              type="button"



              onClick={() => setActiveTab('reports')}



            >



              VIEW DETAILS →



            </button>



          </section>



        </main>



      )}







      {activeTab === 'report' && (



        <main className="resident-page">



          {!submitted ? (



            <>



              <div className="resident-page-header">



                <p className="resident-eyebrow">



                  REPORT AN ISSUE



                </p>







                <h1>Tell us what happened.</h1>







                <p>



                  Your report will be sent directly to



                  NEXORA Township Operations for assessment



                  and response.



                </p>



              </div>







              <div className="resident-report-layout">



                <form



                  className="resident-report-form"



                  onSubmit={handleSubmit}



                >



                  <div className="resident-form-heading">



                    <span>01</span>







                    <div>



                      <h2>Issue details</h2>



                      <p>



                        Provide the information needed for



                        the township response team.



                      </p>



                    </div>



                  </div>







                  <label>



                    ISSUE CATEGORY







                    <select



                      name="category"



                      value={formData.category}



                      onChange={handleChange}



                    >



                      <option value="">



                        Select category



                      </option>







                      <option value="Road & Infrastructure">



                        Road & Infrastructure



                      </option>







                      <option value="Street Lighting">



                        Street Lighting



                      </option>







                      <option value="Water">



                        Water



                      </option>







                      <option value="Waste & Cleanliness">



                        Waste & Cleanliness



                      </option>







                      <option value="Safety">



                        Safety & Security



                      </option>







                      <option value="Environment">



                        Environment



                      </option>



                    </select>



                  </label>







                  <label>



                    LOCATION







                    <select



                      name="location"



                      value={formData.location}



                      onChange={handleChange}



                    >



                      <option value="">



                        Select location



                      </option>







                      <option value="Zone A · Jalan NEXORA 3">



                        Zone A · Jalan NEXORA 3



                      </option>







                      <option value="Zone A · Community Hub">



                        Zone A · Community Hub



                      </option>







                      <option value="Zone B · Commercial Walk">



                        Zone B · Commercial Walk



                      </option>







                      <option value="Zone C · Residential District">



                        Zone C · Residential District



                      </option>



                    </select>



                  </label>







                  <label>



                    DESCRIPTION







                    <textarea



                      name="description"



                      value={formData.description}



                      onChange={handleChange}



                      placeholder="Describe the issue you observed..."



                      rows="6"



                    ></textarea>



                  </label>







                  <div className="resident-upload-box">



                    <span>+</span>







                    <div>



                      <strong>ADD PHOTO</strong>



                      <p>



                        Optional · JPG or PNG · Max 10 MB



                      </p>



                    </div>



                  </div>







                  <div className="resident-form-footer">



                    <span>



                      Reports are shared with township



                      operations for response purposes.



                    </span>







                    <button



                      type="submit"



                      disabled={



                        !formData.category ||



                        !formData.location ||



                        !formData.description.trim()



                      }



                    >



                      SUBMIT REPORT →



                    </button>



                  </div>



                </form>







                <aside className="resident-report-info">



                  <p className="resident-eyebrow">



                    WHAT HAPPENS NEXT?



                  </p>







                  <div>



                    <span>01</span>







                    <section>



                      <strong>Report received</strong>



                      <p>



                        NEXORA records your report and



                        identifies its location.



                      </p>



                    </section>



                  </div>







                  <div>



                    <span>02</span>







                    <section>



                      <strong>



                        Intelligence assessment



                      </strong>



                      <p>



                        The issue is categorised and



                        prioritised using township context.



                      </p>



                    </section>



                  </div>







                  <div>



                    <span>03</span>







                    <section>



                      <strong>Operations response</strong>



                      <p>



                        The appropriate township team is



                        assigned to investigate.



                      </p>



                    </section>



                  </div>







                  <div>



                    <span>04</span>







                    <section>



                      <strong>Track resolution</strong>



                      <p>



                        You can follow the status until the



                        issue is resolved.



                      </p>



                    </section>



                  </div>



                </aside>



              </div>



            </>



          ) : (



            <section className="resident-success">



              <div className="resident-success-icon">



                ✓



              </div>







              <p className="resident-eyebrow">



                REPORT RECEIVED



              </p>







              <h1>Thank you for reporting.</h1>







              <p>



                Your report has been sent to NEXORA



                Township Operations for assessment.



              </p>







              <div className="resident-reference">



                <span>REFERENCE NUMBER</span>



                <strong>INC-0038</strong>



              </div>







              <div className="resident-success-summary">



                <div>



                  <span>CATEGORY</span>



                  <strong>{formData.category}</strong>



                </div>







                <div>



                  <span>LOCATION</span>



                  <strong>{formData.location}</strong>



                </div>







                <div>



                  <span>STATUS</span>



                  <strong className="submitted-status">



                    SUBMITTED



                  </strong>



                </div>



              </div>







              <button



                type="button"



                className="resident-primary-btn"



                onClick={resetReport}



              >



                TRACK THIS REPORT →



              </button>



            </section>



          )}



        </main>



      )}







      {activeTab === 'reports' && (



        <main className="resident-page">



          <div className="resident-page-header">



            <p className="resident-eyebrow">



              MY REPORTS



            </p>







            <h1>Track your reports.</h1>







            <p>



              Follow township response progress from



              submission through resolution.



            </p>



          </div>







          <div className="resident-reports-list">



            {reports.map((report) => (



              <article



                className="resident-report-item"



                key={report.id}



              >



                <div className="resident-report-id">



                  <span>{report.id}</span>



                  <small>{report.date}</small>



                </div>







                <div className="resident-report-main">



                  <span>{report.category}</span>



                  <h2>{report.title}</h2>



                  <p>{report.location}</p>



                </div>







                <div className="resident-report-progress">



                  <div>



                    <span>{report.status}</span>



                    <strong>{report.progress}%</strong>



                  </div>







                  <div className="resident-progress-track">



                    <i



                      style={{



                        width: `${report.progress}%`,



                      }}



                    ></i>



                  </div>







                  <small>



                    {report.status === 'RESOLVED'



                      ? 'Issue resolved'



                      : 'Response currently underway'}



                  </small>



                </div>



              </article>



            ))}



          </div>







          <button



            type="button"



            className="resident-new-report"



            onClick={() => {



              setSubmitted(false)



              setActiveTab('report')



            }}



          >



            + REPORT ANOTHER ISSUE



          </button>



        </main>



      )}







      {activeTab === 'updates' && (



        <main className="resident-page">



          <div className="resident-page-header">



            <p className="resident-eyebrow">



              TOWNSHIP UPDATES



            </p>







            <h1>Stay connected.</h1>







            <p>



              Important maintenance, community and mobility



              information from your township.



            </p>



          </div>







          <div className="resident-updates-list">



            {updates.map((update) => (



              <article



                className="resident-update-card"



                key={update.title}



              >



                <div className="resident-update-date">



                  <strong>



                    {update.date.split(' ')[0]}



                  </strong>



                  <span>



                    {update.date.split(' ')[1]}



                  </span>



                </div>







                <div>



                  <span className="resident-update-tag">



                    {update.tag}



                  </span>







                  <h2>{update.title}</h2>







                  <p>{update.text}</p>



                </div>







                <span className="resident-update-arrow">



                  →



                </span>



              </article>



            ))}



          </div>



        </main>



      )}







      <footer className="resident-footer">



        <span>NEXORA CONNECT</span>







        <p>



          Connected community services powered by NEXORA



          Township Intelligence.



        </p>







        <span>● SYSTEM ONLINE</span>



      </footer>



    </div>



  )



}







export default ResidentPortal