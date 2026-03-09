import { useState, useEffect, useCallback } from "react";
import "./App.css";

const API = "http://localhost:8000";

/* ================================================================
   MAIN APP — Two modes: Name Screening | Negative News
   ================================================================ */
function App() {
  const [mode, setMode] = useState("names"); // "names" | "news"

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-left">
          <div className="logo">
            <span className="logo-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </span>
            <span className="logo-text">AML Screener</span>
          </div>
          <div className="mode-switcher">
            <button className={`mode-btn ${mode === "names" ? "active" : ""}`} onClick={() => setMode("names")}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              Name Screening
            </button>
            <button className={`mode-btn ${mode === "news" ? "active" : ""}`} onClick={() => setMode("news")}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 20H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v1M15 13h2l2-3 2 3h2"/><line x1="7" y1="8" x2="13" y2="8"/><line x1="7" y1="12" x2="11" y2="12"/><line x1="7" y1="16" x2="13" y2="16"/></svg>
              Negative News
            </button>
          </div>
        </div>
        <div className="topbar-right">
          <div className="avatar">K</div>
        </div>
      </header>

      {mode === "names" ? <NameScreeningPanel /> : <NegativeNewsPanel />}
    </div>
  );
}

/* ================================================================
   NAME SCREENING PANEL (existing alert-based screening)
   ================================================================ */
function NameScreeningPanel() {
  const [alerts, setAlerts] = useState([]);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [alertDetail, setAlertDetail] = useState(null);
  const [screeningResults, setScreeningResults] = useState({});
  const [loading, setLoading] = useState(false);
  const [screening, setScreening] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [expandedHit, setExpandedHit] = useState(null);
  const [error, setError] = useState("");

  const loadAlerts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      await fetch(`${API}/api/alerts/load-all`, { method: "POST" });
      const res = await fetch(`${API}/api/alerts/`);
      const data = await res.json();
      setAlerts(data);
      if (data.length > 0 && !selectedAlert) selectAlert(data[0]);
    } catch { setError("Cannot connect to backend. Is the server running?"); }
    setLoading(false);
  }, []);

  useEffect(() => { loadAlerts(); }, [loadAlerts]);

  const selectAlert = async (alert) => {
    setSelectedAlert(alert.alert_id);
    setActiveTab("overview");
    setExpandedHit(null);
    try {
      const res = await fetch(`${API}/api/alerts/${encodeURIComponent(alert.alert_id)}`);
      const data = await res.json();
      setAlertDetail(data);
      if (data.results?.length > 0) {
        const mapped = {};
        data.results.forEach(r => { mapped[r.hit_entry_id] = r; });
        setScreeningResults(prev => ({ ...prev, [alert.alert_id]: mapped }));
      }
    } catch { /* ignore */ }
  };

  const screenHit = async (alertId, entryId) => {
    setScreening(entryId);
    try {
      const res = await fetch(`${API}/api/screening/${encodeURIComponent(alertId)}/hit/${encodeURIComponent(entryId)}`, { method: "POST" });
      const result = await res.json();
      setScreeningResults(prev => ({ ...prev, [alertId]: { ...(prev[alertId] || {}), [entryId]: result } }));
    } catch { setError("Screening failed"); }
    setScreening(null);
  };

  const screenAll = async (alertId) => {
    setScreening("all");
    try {
      const res = await fetch(`${API}/api/screening/${encodeURIComponent(alertId)}`, { method: "POST" });
      const results = await res.json();
      const mapped = {};
      results.forEach(r => { mapped[r.hit_entry_id] = r; });
      setScreeningResults(prev => ({ ...prev, [alertId]: mapped }));
      setActiveTab("results");
    } catch { setError("Screening failed"); }
    setScreening(null);
  };

  const alert = alertDetail?.alert;
  const party = alert?.party;
  const hits = alert?.hits || [];
  const results = screeningResults[selectedAlert] || {};
  const hasResults = Object.keys(results).length > 0;

  return (
    <>
      {error && <Toast message={error} onClose={() => setError("")} />}
      <div className="layout">
        <aside className="sidebar">
          <div className="sidebar-header">
            <h2>Alerts</h2>
            <button onClick={loadAlerts} disabled={loading} className="btn-reload-sm">
              {loading ? "..." : "Reload"}
            </button>
          </div>
          <div className="sidebar-list">
            {alerts.map((a) => (
              <div key={a.alert_id} className={`alert-card ${selectedAlert === a.alert_id ? "active" : ""}`} onClick={() => selectAlert(a)}>
                <div className="alert-card-top">
                  <span className="alert-party-name">{a.party?.name}</span>
                  <span className="alert-score" style={{ color: getScoreColor(a.score) }}>{a.score}</span>
                </div>
                <div className="alert-card-meta">
                  <span>{a.party?.nationalities?.join(", ")}</span>
                  <span className="dot-sep" />
                  <span>{a.hits?.length} hit{a.hits?.length !== 1 ? "s" : ""}</span>
                </div>
                <div className="alert-card-bottom">
                  <span className="alert-date">{a.alert_date}</span>
                  {a.hits?.some(h => isHighRisk(h.list_id)) && <span className="tag-sanctions">Sanctions</span>}
                </div>
              </div>
            ))}
          </div>
        </aside>

        <main className="main-panel">
          {!alert ? (
            <EmptyState icon="shield" title="Select an alert to begin" subtitle="Choose an alert from the sidebar to view details and run screening" />
          ) : (
            <>
              <div className="detail-header">
                <div className="detail-header-left">
                  <h1>{party.name}</h1>
                  <div className="detail-header-tags">
                    {party.nationalities?.map((n, i) => <span key={i} className="tag">{n}</span>)}
                    <span className="tag">{party.gender}</span>
                    {party.dob && <span className="tag">DOB: {party.dob}</span>}
                  </div>
                </div>
                <div className="detail-header-right">
                  <ScoreCircle score={alert.score} />
                  <button onClick={() => screenAll(alert.alert_id)} disabled={screening === "all"} className="btn-screen-all">
                    {screening === "all" ? <><span className="spinner" /> Screening...</> : <>Screen All Hits</>}
                  </button>
                </div>
              </div>

              <div className="tabs">
                {["overview", "hits", "results"].map(t => (
                  <button key={t} className={`tab ${activeTab === t ? "active" : ""}`} onClick={() => setActiveTab(t)}>
                    {t === "overview" ? "Overview" : t === "hits" ? `Hits (${hits.length})` : <>Results {hasResults && <span className="tab-badge">{Object.keys(results).length}</span>}</>}
                  </button>
                ))}
              </div>

              <div className="tab-content">
                {activeTab === "overview" && (
                  <div className="overview-grid">
                    <InfoCard icon="user" title="Customer Profile">
                      <InfoField label="Full Name" value={party.name} /><InfoField label="Date of Birth" value={party.dob} />
                      <InfoField label="Year of Birth" value={party.yob} /><InfoField label="Gender" value={party.gender} />
                      <InfoField label="Birth Country" value={party.birth_country} /><InfoField label="Birth Location" value={party.birth_location} />
                      <InfoField label="Nationalities" value={party.nationalities?.join(", ")} /><InfoField label="Party Type" value={party.party_type} />
                    </InfoCard>
                    <InfoCard icon="id" title="Identification">
                      {party.ids?.map((id, i) => <InfoField key={i} label={`ID (Type ${id.id_type})`} value={id.id_number} mono />)}
                      {(!party.ids || party.ids.length === 0) && <span className="no-data">No IDs on file</span>}
                    </InfoCard>
                    <InfoCard icon="location" title="Address">
                      {party.addresses?.map((a, i) => <InfoField key={i} label="Address" value={[a.line1, a.line2, a.city, a.postal_code, a.country].filter(Boolean).join(", ")} />)}
                    </InfoCard>
                    <InfoCard icon="info" title="Alert Info">
                      <InfoField label="Alert ID" value={alert.alert_id} mono /><InfoField label="Date" value={alert.alert_date} />
                      <InfoField label="Job" value={alert.job_name} /><InfoField label="Type" value={alert.job_type} />
                      <InfoField label="Total Hits" value={alert.number_of_hits} />
                    </InfoCard>
                  </div>
                )}

                {activeTab === "hits" && (
                  <div className="hits-list">
                    {hits.map((hit, idx) => {
                      const hitResult = results[hit.entry_id];
                      const isExpanded = expandedHit === idx;
                      return (
                        <div key={idx} className={`hit-card ${isExpanded ? "expanded" : ""}`}>
                          <div className="hit-card-header" onClick={() => setExpandedHit(isExpanded ? null : idx)}>
                            <div className="hit-card-left">
                              <span className="hit-rank">#{idx + 1}</span>
                              <div>
                                <span className="hit-name">{hit.display_name}</span>
                                <div className="hit-meta-row">
                                  <span className={`list-tag ${isHighRisk(hit.list_id) ? "high" : "normal"}`}>{hit.list_id}</span>
                                  {hit.categories?.map((c, i) => <span key={i} className="cat-tag">{c}</span>)}
                                </div>
                              </div>
                            </div>
                            <div className="hit-card-right">
                              {hitResult && <DecisionPill decision={hitResult.decision} />}
                              <span className="hit-score" style={{ color: getScoreColor(hit.score) }}>{hit.score}</span>
                              <button onClick={(e) => { e.stopPropagation(); screenHit(alert.alert_id, hit.entry_id); }} disabled={screening === hit.entry_id} className="btn-screen">
                                {screening === hit.entry_id ? <span className="spinner" /> : "Screen"}
                              </button>
                              <span className={`chevron ${isExpanded ? "open" : ""}`}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg></span>
                            </div>
                          </div>
                          {isExpanded && (
                            <div className="hit-expanded">
                              <div className="hit-detail-grid">
                                <InfoField label="Matched Name" value={hit.matched_name} mono /><InfoField label="Display Name" value={hit.display_name} />
                                <InfoField label="Aliases" value={hit.aliases?.map(a => a.display_name).join(", ") || "None"} />
                                <InfoField label="Nationality" value={hit.nationalities?.join(", ")} /><InfoField label="Gender" value={hit.gender} />
                                <InfoField label="Position" value={hit.position} />
                                <InfoField label="Deceased" value={hit.is_deceased ? `Yes${hit.deceased_date ? ` (${hit.deceased_date})` : ""}` : "No"} />
                                <InfoField label="List ID" value={hit.list_id} /><InfoField label="Entry ID" value={hit.entry_id} mono />
                                {hit.additional_info && Object.entries(hit.additional_info).map(([k, v], i) => <InfoField key={i} label={k} value={v} />)}
                              </div>
                              {hitResult && (
                                <div className="inline-result">
                                  <div className="inline-result-header"><h4>Screening Result</h4><DecisionPill decision={hitResult.decision} /></div>
                                  <div className="reasoning-box"><p>{hitResult.overall_reasoning}</p></div>
                                  <span className="rule-tag">Rule: {hitResult.rule_applied}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {activeTab === "results" && (
                  <div className="results-panel">
                    {!hasResults ? (
                      <EmptyState title="No screening results yet" subtitle='Click "Screen All Hits" or screen individual hits to generate results' />
                    ) : (
                      Object.entries(results).map(([entryId, result]) => {
                        const hit = hits.find(h => h.entry_id === entryId);
                        const ds = getDecisionStyle(result.decision);
                        return (
                          <div key={entryId} className="result-card" style={{ borderLeftColor: ds.color }}>
                            <div className="result-card-header">
                              <div>
                                <h3>{hit?.display_name || entryId}</h3>
                                <div className="result-card-tags">
                                  <span className={`list-tag ${isHighRisk(result.hit_list_id) ? "high" : "normal"}`}>{result.hit_list_id}</span>
                                  {result.is_terror_sanction && <span className="list-tag high">Terror/Sanctions</span>}
                                  <span className="rule-tag">Rule: {result.rule_applied}</span>
                                </div>
                              </div>
                              <div className="decision-large" style={{ background: ds.bg, color: ds.color, border: `1px solid ${ds.border}` }}>{result.decision}</div>
                            </div>
                            <div className="result-section"><h4>Name Match Analysis</h4><div className="result-section-content"><span className="tag">{result.name_match_type}</span><p>{result.name_match_reasoning}</p></div></div>
                            <div className="result-section"><h4>Decision Reasoning</h4><div className="reasoning-box"><p>{result.overall_reasoning}</p></div></div>
                            {result.info_request && <div className="info-request-box"><h4>Additional Information Requested</h4><p>{result.info_request}</p></div>}
                            <div className="factors-grid">
                              <div><h4>Primary Factors</h4><FactorsList factors={result.primary_factors} /></div>
                              <div><h4>Secondary Factors</h4><FactorsList factors={result.secondary_factors} /></div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </>
  );
}

/* ================================================================
   NEGATIVE NEWS PANEL
   ================================================================ */
function NegativeNewsPanel() {
  const [form, setForm] = useState({ full_name: "", gender: "", nationality: "", dob: "", employer: "", job_title: "", industry: "", country: "", aliases: "", notes: "" });
  const [topN, setTopN] = useState(5);
  const [screening, setScreening] = useState(false);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [selectedHistory, setSelectedHistory] = useState(null);
  const [resultTab, setResultTab] = useState("summary");
  const [error, setError] = useState("");

  useEffect(() => { fetchHistory(); }, []);

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${API}/api/negative-news/history`);
      const data = await res.json();
      setHistory(data);
    } catch { /* ignore */ }
  };

  const loadHistoryItem = async (id) => {
    try {
      const res = await fetch(`${API}/api/negative-news/history/${id}`);
      const data = await res.json();
      setResult(data);
      setResultTab("summary");
      setSelectedHistory(id);
    } catch { setError("Failed to load result"); }
  };

  const runScreening = async () => {
    if (!form.full_name.trim()) { setError("Full name is required"); return; }
    setScreening(true);
    setError("");
    setResult(null);

    const profile = { ...form };
    if (profile.aliases) profile.aliases = profile.aliases.split(",").map(a => a.trim()).filter(Boolean);
    else profile.aliases = [];
    // Remove empty optional fields
    Object.keys(profile).forEach(k => { if (!profile[k] || (Array.isArray(profile[k]) && profile[k].length === 0)) delete profile[k]; });
    profile.full_name = form.full_name; // ensure not deleted

    try {
      const res = await fetch(`${API}/api/negative-news/screen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, top_n: topN }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail || "Screening failed"); }
      const data = await res.json();
      setResult(data);
      setResultTab("summary");
      setSelectedHistory(data.screening_id);
      fetchHistory();
    } catch (err) {
      setError(err.message || "Screening failed");
    }
    setScreening(false);
  };

  const riskColors = { HIGH: "#D31145", MEDIUM: "#EF6C00", LOW: "#1565C0", CLEAR: "#2E7D32" };
  const riskBg = { HIGH: "rgba(211,17,69,0.08)", MEDIUM: "rgba(239,108,0,0.08)", LOW: "rgba(21,101,192,0.08)", CLEAR: "rgba(46,125,50,0.08)" };
  const riskIcons = { HIGH: "\u{1F534}", MEDIUM: "\u{1F7E1}", LOW: "\u{1F535}", CLEAR: "\u{1F7E2}" };
  const sevColors = { HIGH: { bg: "rgba(211,17,69,0.08)", color: "#D31145" }, MEDIUM: { bg: "rgba(239,108,0,0.08)", color: "#EF6C00" }, LOW: { bg: "rgba(21,101,192,0.08)", color: "#1565C0" }, CLEAR: { bg: "rgba(46,125,50,0.08)", color: "#2E7D32" } };

  return (
    <>
      {error && <Toast message={error} onClose={() => setError("")} />}
      <div className="layout">
        {/* Sidebar — History + Form */}
        <aside className="sidebar nn-sidebar">
          <div className="sidebar-header">
            <h2>Adverse Media</h2>
          </div>

          {/* Subject Form */}
          <div className="nn-form">
            <h3>Screen a Subject</h3>
            <div className="form-field"><label>Full Name *</label><input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="e.g. John Tan Wei Ming" /></div>
            <div className="form-row">
              <div className="form-field"><label>Nationality</label><input value={form.nationality} onChange={e => setForm(f => ({ ...f, nationality: e.target.value }))} placeholder="e.g. Singaporean" /></div>
              <div className="form-field"><label>Country</label><input value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} placeholder="e.g. Singapore" /></div>
            </div>
            <div className="form-row">
              <div className="form-field"><label>Employer</label><input value={form.employer} onChange={e => setForm(f => ({ ...f, employer: e.target.value }))} placeholder="e.g. OCBC Bank" /></div>
              <div className="form-field"><label>Job Title</label><input value={form.job_title} onChange={e => setForm(f => ({ ...f, job_title: e.target.value }))} placeholder="e.g. VP Operations" /></div>
            </div>
            <div className="form-row">
              <div className="form-field"><label>Gender</label>
                <select value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}>
                  <option value="">—</option><option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option>
                </select>
              </div>
              <div className="form-field"><label>DOB</label><input value={form.dob} onChange={e => setForm(f => ({ ...f, dob: e.target.value }))} placeholder="YYYY-MM-DD" /></div>
            </div>
            <div className="form-field"><label>Industry</label><input value={form.industry} onChange={e => setForm(f => ({ ...f, industry: e.target.value }))} placeholder="e.g. Banking" /></div>
            <div className="form-field"><label>Aliases</label><input value={form.aliases} onChange={e => setForm(f => ({ ...f, aliases: e.target.value }))} placeholder="Comma-separated" /></div>
            <div className="form-field"><label>Notes</label><textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Extra context for disambiguation" rows={2} /></div>
            <div className="form-field"><label>Articles per Query</label>
              <select value={topN} onChange={e => setTopN(Number(e.target.value))}>
                <option value={3}>3 articles</option><option value={5}>5 articles</option><option value={10}>10 articles</option><option value={15}>15 articles</option><option value={20}>20 articles</option>
              </select>
            </div>
            <button onClick={runScreening} disabled={screening} className="btn-screen-all nn-submit">
              {screening ? <><span className="spinner" /> Screening...</> : <>Run Screening</>}
            </button>
          </div>

          {/* History */}
          {history.length > 0 && (
            <div className="nn-history">
              <h3>Recent Screenings</h3>
              {history.map(h => (
                <div key={h.screening_id} className={`alert-card ${selectedHistory === h.screening_id ? "active" : ""}`} onClick={() => loadHistoryItem(h.screening_id)}>
                  <div className="alert-card-top">
                    <span className="alert-party-name">{h.subject_name}</span>
                    <span className="alert-score" style={{ color: riskColors[h.risk_rating] || "#717171" }}>{h.risk_score}</span>
                  </div>
                  <div className="alert-card-meta">
                    <span style={{ color: riskColors[h.risk_rating] }}>{h.risk_rating}</span>
                    <span className="dot-sep" />
                    <span>{h.findings_count} finding{h.findings_count !== 1 ? "s" : ""}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </aside>

        {/* Main Panel — Results */}
        <main className="main-panel">
          {!result ? (
            <EmptyState icon="news" title="Run a negative news screening" subtitle="Fill in the subject profile on the left and click 'Run Screening' to search for adverse media" />
          ) : (
            <div className="nn-result">
              {/* Header */}
              <div className="detail-header">
                <div className="detail-header-left">
                  <h1>{result.subject?.full_name}</h1>
                  <div className="detail-header-tags">
                    {result.subject?.nationality && <span className="tag">{result.subject.nationality}</span>}
                    {result.subject?.employer && <span className="tag">{result.subject.employer}</span>}
                    {result.subject?.country && <span className="tag">{result.subject.country}</span>}
                  </div>
                </div>
                <div className="detail-header-right">
                  <div className="risk-badge-large" style={{ background: riskBg[result.overall_risk_rating], color: riskColors[result.overall_risk_rating], borderColor: riskColors[result.overall_risk_rating] }}>
                    <span className="risk-score-value">{result.overall_risk_score}</span>
                    <span className="risk-score-label">{riskIcons[result.overall_risk_rating]} {result.overall_risk_rating}</span>
                  </div>
                </div>
              </div>

              {/* Action Banner */}
              <div className="nn-action-banner" style={{ background: riskBg[result.overall_risk_rating], borderColor: riskColors[result.overall_risk_rating] }}>
                <span className="nn-action-label">Recommended Action</span>
                <span className="nn-action-text" style={{ color: riskColors[result.overall_risk_rating] }}>{result.recommended_action}</span>
              </div>

              {/* Stats Row */}
              <div className="nn-stats">
                <div className="stat"><span className="stat-value">{result.queries_executed?.length || 0}</span><span className="stat-label">Queries</span></div>
                <div className="stat"><span className="stat-value">{result.total_articles_retrieved || 0}</span><span className="stat-label">Articles Found</span></div>
                <div className="stat"><span className="stat-value">{result.matched_findings?.length || 0}</span><span className="stat-label">Matched</span></div>
                <div className="stat"><span className="stat-value">{result.discarded_results?.length || 0}</span><span className="stat-label">Discarded</span></div>
              </div>

              {/* Tabbed Results */}
              <div className="tabs">
                {[
                  { key: "summary", label: "Summary" },
                  { key: "findings", label: `Findings (${(result.matched_findings?.length || 0) + (result.inconclusive_findings?.length || 0)})` },
                  { key: "audit", label: "Audit Trail" },
                ].map(t => (
                  <button key={t.key} className={`tab ${resultTab === t.key ? "active" : ""}`} onClick={() => setResultTab(t.key)}>
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="tab-content">
                {/* ---- SUMMARY TAB ---- */}
                {resultTab === "summary" && (
                  <>
                    <div className="info-card">
                      <div className="info-card-header"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><h3>Risk Assessment</h3></div>
                      <div className="reasoning-box"><p>{result.narrative}</p></div>
                      {result.caveats && <div className="nn-caveats"><strong>Caveats:</strong> {result.caveats}</div>}
                    </div>

                    {result.risk_breakdown && (
                      <div className="info-card">
                        <div className="info-card-header"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg><h3>Category Breakdown</h3></div>
                        <div className="nn-breakdown">
                          {Object.entries(result.risk_breakdown).map(([cat, info]) => (
                            <div key={cat} className="nn-breakdown-row">
                              <div className="nn-breakdown-left">
                                <span className="nn-cat-name">{cat}</span>
                                <span className="nn-cat-count">{info.incident_count} incident{info.incident_count !== 1 ? "s" : ""}</span>
                              </div>
                              <div className="nn-breakdown-bar-wrap">
                                <div className="nn-breakdown-bar" style={{ width: info.severity === "CLEAR" ? "0%" : info.severity === "LOW" ? "25%" : info.severity === "MEDIUM" ? "55%" : "90%", background: (sevColors[info.severity] || sevColors.CLEAR).color }} />
                              </div>
                              <span className="nn-breakdown-sev" style={{ color: (sevColors[info.severity] || sevColors.CLEAR).color, background: (sevColors[info.severity] || sevColors.CLEAR).bg }}>{info.severity}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* ---- FINDINGS TAB ---- */}
                {resultTab === "findings" && (
                  <>
                    {result.matched_findings?.length > 0 && (
                      <div className="info-card">
                        <div className="info-card-header"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg><h3>Matched Findings ({result.matched_findings.length})</h3></div>
                        {result.matched_findings.map((f, i) => (
                          <div key={i} className="nn-finding">
                            <div className="nn-finding-header">
                              <div>
                                <span className="nn-finding-id">{f.finding_id}</span>
                                <span className="nn-finding-title">{f.article_title}</span>
                              </div>
                              <span className="nn-sev-badge" style={{ color: (sevColors[f.severity] || sevColors.LOW).color, background: (sevColors[f.severity] || sevColors.LOW).bg }}>
                                {f.severity}
                              </span>
                            </div>
                            <div className="nn-finding-meta">
                              <span>{f.article_source}</span>
                              <span className="dot-sep" />
                              <span>{f.article_date}</span>
                              <span className="dot-sep" />
                              <span>Confidence: {(f.match_confidence * 100).toFixed(0)}%</span>
                              {f.is_duplicate && <span className="list-tag high">Duplicate of {f.duplicate_of}</span>}
                            </div>
                            {f.risk_categories?.length > 0 && (
                              <div className="nn-finding-cats">{f.risk_categories.map((c, j) => <span key={j} className="cat-tag">{c}</span>)}</div>
                            )}
                            <div className="reasoning-box"><p>{f.key_facts}</p></div>
                            <details className="nn-finding-details"><summary>Match reasoning</summary><p>{f.match_reasoning}</p></details>
                            {f.article_url && <a href={f.article_url} target="_blank" rel="noopener noreferrer" className="nn-article-link">View article &rarr;</a>}
                          </div>
                        ))}
                      </div>
                    )}

                    {result.inconclusive_findings?.length > 0 && (
                      <div className="info-card">
                        <div className="info-card-header"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><h3>Inconclusive ({result.inconclusive_findings.length})</h3></div>
                        <p className="nn-inconclusive-note">These could not be confirmed or ruled out. They contribute to the risk score at reduced weight.</p>
                        {result.inconclusive_findings.map((f, i) => (
                          <div key={i} className="nn-finding inconclusive">
                            <div className="nn-finding-header">
                              <span className="nn-finding-title">{f.article_title}</span>
                              <span className="nn-sev-badge" style={{ color: "#EF6C00", background: "rgba(239,108,0,0.08)" }}>INCONCLUSIVE</span>
                            </div>
                            <div className="nn-finding-meta"><span>{f.article_source}</span><span className="dot-sep" /><span>Confidence: {(f.match_confidence * 100).toFixed(0)}%</span></div>
                            <div className="reasoning-box"><p>{f.key_facts || f.match_reasoning}</p></div>
                          </div>
                        ))}
                      </div>
                    )}

                    {!result.matched_findings?.length && !result.inconclusive_findings?.length && (
                      <EmptyState icon="shield" title="No findings" subtitle="No adverse media findings were identified for this subject" />
                    )}
                  </>
                )}

                {/* ---- AUDIT TRAIL TAB ---- */}
                {resultTab === "audit" && (
                  <>
                    <div className="info-card">
                      <div className="info-card-header"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><h3>Queries Executed ({result.queries_executed?.length || 0})</h3></div>
                      <div className="nn-queries">
                        {result.queries_executed?.map((q, i) => (
                          <div key={i} className="nn-query-row">
                            <span className="nn-query-id">{q.query_id}</span>
                            <span className="nn-query-text">{q.query_text}</span>
                            <span className="nn-query-count">{q.results_count} results</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {result.discarded_results?.length > 0 && (
                      <div className="info-card">
                        <div className="info-card-header">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                          <h3>Discarded Results ({result.discarded_results.length})</h3>
                        </div>
                        <div className="nn-discarded-list">
                          {result.discarded_results.map((d, i) => (
                            <div key={i} className="nn-discarded-item">
                              <span className="nn-discarded-title">{d.article_title}</span>
                              <span className="nn-discarded-reason">{d.discard_reason}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
}

/* ================================================================
   SHARED COMPONENTS
   ================================================================ */
function Toast({ message, onClose }) {
  return (
    <div className="toast-error"><span>{message}</span><button onClick={onClose} className="toast-close">&times;</button></div>
  );
}

function EmptyState({ icon, title, subtitle }) {
  const icons = {
    shield: <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#B0B0B0" strokeWidth="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
    news: <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#B0B0B0" strokeWidth="1.5"><path d="M19 20H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v1"/><line x1="7" y1="8" x2="13" y2="8"/><line x1="7" y1="12" x2="11" y2="12"/><line x1="7" y1="16" x2="13" y2="16"/></svg>,
  };
  return (
    <div className="empty-state">
      <div className="empty-icon">{icons[icon] || icons.shield}</div>
      <h3>{title}</h3><p>{subtitle}</p>
    </div>
  );
}

function ScoreCircle({ score }) {
  const color = getScoreColor(score);
  return (
    <div className="score-circle" style={{ borderColor: color }}>
      <span className="score-value" style={{ color }}>{score}</span>
      <span className="score-label">Score</span>
    </div>
  );
}

function DecisionPill({ decision }) {
  const ds = getDecisionStyle(decision);
  return <span className="decision-pill" style={{ background: ds.bg, color: ds.color, border: `1px solid ${ds.border}` }}>{decision}</span>;
}

function InfoCard({ icon, title, children }) {
  const icons = {
    user: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
    id: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="7" y1="8" x2="17" y2="8"/><line x1="7" y1="12" x2="12" y2="12"/></svg>,
    location: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>,
    info: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>,
  };
  return (
    <div className="info-card">
      <div className="info-card-header">{icons[icon]}<h3>{title}</h3></div>
      <div className="info-grid">{children}</div>
    </div>
  );
}

function InfoField({ label, value, mono }) {
  return <div className="info-field"><span className="info-label">{label}</span><span className={`info-value ${mono ? "mono" : ""}`}>{value || "—"}</span></div>;
}

function FactorsList({ factors }) {
  return (
    <div className="factors-list">
      {factors?.map((f, i) => (
        <div key={i} className="factor-row">
          <span className={`factor-dot ${f.result.toLowerCase()}`} />
          <div className="factor-info"><span className="factor-name">{f.factor_name}</span><span className="factor-reasoning">{f.reasoning}</span></div>
          <span className={`factor-result ${f.result.toLowerCase()}`}>{f.result}</span>
        </div>
      ))}
    </div>
  );
}

/* ================================================================
   HELPERS
   ================================================================ */
function getScoreColor(score) {
  if (score >= 90) return "#D31145";
  if (score >= 70) return "#EF6C00";
  return "#2E7D32";
}

function getDecisionStyle(decision) {
  if (!decision) return {};
  if (decision.includes("True")) return { bg: "rgba(211,17,69,0.08)", color: "#D31145", border: "rgba(211,17,69,0.2)" };
  if (decision.includes("Hold")) return { bg: "rgba(239,108,0,0.08)", color: "#EF6C00", border: "rgba(239,108,0,0.2)" };
  return { bg: "rgba(46,125,50,0.08)", color: "#2E7D32", border: "rgba(46,125,50,0.2)" };
}

function isHighRisk(listId) {
  return ["OFAC_SDN", "UN_CONSOLIDATED", "EU_CONSOLIDATED", "UK_HMT", "MAS_TF"].includes(listId);
}

export default App;
