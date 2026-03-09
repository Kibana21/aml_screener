import { useState, useEffect, useCallback } from "react";
import "./App.css";

const API = "http://localhost:8000";

function App() {
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
      if (data.length > 0 && !selectedAlert) {
        selectAlert(data[0]);
      }
    } catch {
      setError("Cannot connect to backend. Is the server running?");
    }
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
      const res = await fetch(
        `${API}/api/screening/${encodeURIComponent(alertId)}/hit/${encodeURIComponent(entryId)}`,
        { method: "POST" }
      );
      const result = await res.json();
      setScreeningResults(prev => ({
        ...prev,
        [alertId]: { ...(prev[alertId] || {}), [entryId]: result },
      }));
    } catch {
      setError("Screening failed");
    }
    setScreening(null);
  };

  const screenAll = async (alertId) => {
    setScreening("all");
    try {
      const res = await fetch(
        `${API}/api/screening/${encodeURIComponent(alertId)}`,
        { method: "POST" }
      );
      const results = await res.json();
      const mapped = {};
      results.forEach(r => { mapped[r.hit_entry_id] = r; });
      setScreeningResults(prev => ({ ...prev, [alertId]: mapped }));
      setActiveTab("results");
    } catch {
      setError("Screening failed");
    }
    setScreening(null);
  };

  const alert = alertDetail?.alert;
  const party = alert?.party;
  const hits = alert?.hits || [];
  const results = screeningResults[selectedAlert] || {};
  const hasResults = Object.keys(results).length > 0;

  const getScoreColor = (score) => {
    if (score >= 90) return "#FF385C";
    if (score >= 70) return "#E07912";
    return "#008A05";
  };

  const getDecisionStyle = (decision) => {
    if (!decision) return {};
    if (decision.includes("True")) return { bg: "#FFF0F0", color: "#D93025", border: "#FECDD3" };
    if (decision.includes("Hold")) return { bg: "#FFF8E1", color: "#E07912", border: "#FDE68A" };
    return { bg: "#F0FFF4", color: "#008A05", border: "#BBF7D0" };
  };

  return (
    <div className="app">
      {/* Top Bar */}
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
        </div>
        <div className="topbar-right">
          <button onClick={loadAlerts} disabled={loading} className="btn-reload">
            {loading ? "Loading..." : "Reload Alerts"}
          </button>
          <div className="avatar">K</div>
        </div>
      </header>

      {error && (
        <div className="toast-error">
          <span>{error}</span>
          <button onClick={() => setError("")} className="toast-close">&times;</button>
        </div>
      )}

      <div className="layout">
        {/* Sidebar - Alert List */}
        <aside className="sidebar">
          <div className="sidebar-header">
            <h2>Alerts</h2>
            <span className="alert-count">{alerts.length}</span>
          </div>
          <div className="sidebar-list">
            {alerts.map((a) => (
              <div
                key={a.alert_id}
                className={`alert-card ${selectedAlert === a.alert_id ? "active" : ""}`}
                onClick={() => selectAlert(a)}
              >
                <div className="alert-card-top">
                  <span className="alert-party-name">{a.party?.name}</span>
                  <span className="alert-score" style={{ color: getScoreColor(a.score) }}>
                    {a.score}
                  </span>
                </div>
                <div className="alert-card-meta">
                  <span>{a.party?.nationalities?.join(", ")}</span>
                  <span className="dot-sep" />
                  <span>{a.hits?.length} hit{a.hits?.length !== 1 ? "s" : ""}</span>
                </div>
                <div className="alert-card-bottom">
                  <span className="alert-date">{a.alert_date}</span>
                  {a.hits?.some(h => isHighRisk(h.list_id)) && (
                    <span className="tag-sanctions">Sanctions</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* Main Panel */}
        <main className="main-panel">
          {!alert ? (
            <div className="empty-state">
              <div className="empty-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#B0B0B0" strokeWidth="1.5">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
              </div>
              <h3>Select an alert to begin</h3>
              <p>Choose an alert from the sidebar to view details and run screening</p>
            </div>
          ) : (
            <>
              {/* Alert Header */}
              <div className="detail-header">
                <div className="detail-header-left">
                  <h1>{party.name}</h1>
                  <div className="detail-header-tags">
                    {party.nationalities?.map((n, i) => (
                      <span key={i} className="tag">{n}</span>
                    ))}
                    <span className="tag">{party.gender}</span>
                    {party.dob && <span className="tag">DOB: {party.dob}</span>}
                  </div>
                </div>
                <div className="detail-header-right">
                  <div className="score-circle" style={{ borderColor: getScoreColor(alert.score) }}>
                    <span className="score-value" style={{ color: getScoreColor(alert.score) }}>{alert.score}</span>
                    <span className="score-label">Score</span>
                  </div>
                  <button
                    onClick={() => screenAll(alert.alert_id)}
                    disabled={screening === "all"}
                    className="btn-screen-all"
                  >
                    {screening === "all" ? (
                      <><span className="spinner" /> Screening...</>
                    ) : (
                      <>Screen All Hits</>
                    )}
                  </button>
                </div>
              </div>

              {/* Tabs */}
              <div className="tabs">
                <button className={`tab ${activeTab === "overview" ? "active" : ""}`} onClick={() => setActiveTab("overview")}>
                  Overview
                </button>
                <button className={`tab ${activeTab === "hits" ? "active" : ""}`} onClick={() => setActiveTab("hits")}>
                  Hits ({hits.length})
                </button>
                <button className={`tab ${activeTab === "results" ? "active" : ""}`} onClick={() => setActiveTab("results")}>
                  Results {hasResults && <span className="tab-badge">{Object.keys(results).length}</span>}
                </button>
              </div>

              {/* Tab Content */}
              <div className="tab-content">
                {activeTab === "overview" && (
                  <div className="overview-grid">
                    {/* Party Card */}
                    <div className="info-card">
                      <div className="info-card-header">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        <h3>Customer Profile</h3>
                      </div>
                      <div className="info-grid">
                        <InfoField label="Full Name" value={party.name} />
                        <InfoField label="Date of Birth" value={party.dob} />
                        <InfoField label="Year of Birth" value={party.yob} />
                        <InfoField label="Gender" value={party.gender} />
                        <InfoField label="Birth Country" value={party.birth_country} />
                        <InfoField label="Birth Location" value={party.birth_location} />
                        <InfoField label="Nationalities" value={party.nationalities?.join(", ")} />
                        <InfoField label="Party Type" value={party.party_type} />
                      </div>
                    </div>

                    {/* IDs Card */}
                    <div className="info-card">
                      <div className="info-card-header">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="7" y1="8" x2="17" y2="8"/><line x1="7" y1="12" x2="12" y2="12"/></svg>
                        <h3>Identification</h3>
                      </div>
                      <div className="info-grid">
                        {party.ids?.map((id, i) => (
                          <InfoField key={i} label={`ID (Type ${id.id_type})`} value={id.id_number} mono />
                        ))}
                        {(!party.ids || party.ids.length === 0) && (
                          <span className="no-data">No IDs on file</span>
                        )}
                      </div>
                    </div>

                    {/* Address Card */}
                    <div className="info-card">
                      <div className="info-card-header">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                        <h3>Address</h3>
                      </div>
                      <div className="info-grid">
                        {party.addresses?.map((a, i) => (
                          <InfoField key={i} label="Address" value={[a.line1, a.line2, a.city, a.postal_code, a.country].filter(Boolean).join(", ")} />
                        ))}
                      </div>
                    </div>

                    {/* Alert Meta Card */}
                    <div className="info-card">
                      <div className="info-card-header">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                        <h3>Alert Info</h3>
                      </div>
                      <div className="info-grid">
                        <InfoField label="Alert ID" value={alert.alert_id} mono />
                        <InfoField label="Date" value={alert.alert_date} />
                        <InfoField label="Job" value={alert.job_name} />
                        <InfoField label="Type" value={alert.job_type} />
                        <InfoField label="Total Hits" value={alert.number_of_hits} />
                      </div>
                    </div>
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
                                  <span className={`list-tag ${isHighRisk(hit.list_id) ? "high" : "normal"}`}>
                                    {hit.list_id}
                                  </span>
                                  {hit.categories?.map((c, i) => (
                                    <span key={i} className="cat-tag">{c}</span>
                                  ))}
                                </div>
                              </div>
                            </div>
                            <div className="hit-card-right">
                              {hitResult && (
                                <span className="decision-pill" style={{
                                  background: getDecisionStyle(hitResult.decision).bg,
                                  color: getDecisionStyle(hitResult.decision).color,
                                  border: `1px solid ${getDecisionStyle(hitResult.decision).border}`,
                                }}>
                                  {hitResult.decision}
                                </span>
                              )}
                              <span className="hit-score" style={{ color: getScoreColor(hit.score) }}>
                                {hit.score}
                              </span>
                              <button
                                onClick={(e) => { e.stopPropagation(); screenHit(alert.alert_id, hit.entry_id); }}
                                disabled={screening === hit.entry_id}
                                className="btn-screen"
                              >
                                {screening === hit.entry_id ? <span className="spinner" /> : "Screen"}
                              </button>
                              <span className={`chevron ${isExpanded ? "open" : ""}`}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
                              </span>
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="hit-expanded">
                              <div className="hit-detail-grid">
                                <InfoField label="Matched Name" value={hit.matched_name} mono />
                                <InfoField label="Display Name" value={hit.display_name} />
                                <InfoField label="Aliases" value={hit.aliases?.map(a => a.display_name).join(", ") || "None"} />
                                <InfoField label="Nationality" value={hit.nationalities?.join(", ")} />
                                <InfoField label="Gender" value={hit.gender} />
                                <InfoField label="Position" value={hit.position} />
                                <InfoField label="Deceased" value={hit.is_deceased ? `Yes${hit.deceased_date ? ` (${hit.deceased_date})` : ""}` : "No"} />
                                <InfoField label="List ID" value={hit.list_id} />
                                <InfoField label="Entry ID" value={hit.entry_id} mono />
                                {hit.additional_info && Object.entries(hit.additional_info).map(([k, v], i) => (
                                  <InfoField key={i} label={k} value={v} />
                                ))}
                              </div>

                              {hitResult && (
                                <div className="inline-result">
                                  <div className="inline-result-header">
                                    <h4>Screening Result</h4>
                                    <span className="decision-pill" style={{
                                      background: getDecisionStyle(hitResult.decision).bg,
                                      color: getDecisionStyle(hitResult.decision).color,
                                      border: `1px solid ${getDecisionStyle(hitResult.decision).border}`,
                                    }}>
                                      {hitResult.decision}
                                    </span>
                                  </div>
                                  <div className="reasoning-box">
                                    <p>{hitResult.overall_reasoning}</p>
                                  </div>
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
                      <div className="empty-state small">
                        <h3>No screening results yet</h3>
                        <p>Click "Screen All Hits" or screen individual hits to generate results</p>
                      </div>
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
                                  <span className={`list-tag ${isHighRisk(result.hit_list_id) ? "high" : "normal"}`}>
                                    {result.hit_list_id}
                                  </span>
                                  {result.is_terror_sanction && <span className="list-tag high">Terror/Sanctions</span>}
                                  <span className="rule-tag">Rule: {result.rule_applied}</span>
                                </div>
                              </div>
                              <div className="decision-large" style={{ background: ds.bg, color: ds.color, border: `1px solid ${ds.border}` }}>
                                {result.decision}
                              </div>
                            </div>

                            {/* Name Match */}
                            <div className="result-section">
                              <h4>Name Match Analysis</h4>
                              <div className="result-section-content">
                                <span className="tag">{result.name_match_type}</span>
                                <p>{result.name_match_reasoning}</p>
                              </div>
                            </div>

                            {/* Reasoning */}
                            <div className="result-section">
                              <h4>Decision Reasoning</h4>
                              <div className="reasoning-box">
                                <p>{result.overall_reasoning}</p>
                              </div>
                            </div>

                            {result.info_request && (
                              <div className="info-request-box">
                                <h4>Additional Information Requested</h4>
                                <p>{result.info_request}</p>
                              </div>
                            )}

                            {/* Factors */}
                            <div className="factors-grid">
                              <div>
                                <h4>Primary Factors</h4>
                                <div className="factors-list">
                                  {result.primary_factors?.map((f, i) => (
                                    <div key={i} className="factor-row">
                                      <span className={`factor-dot ${f.result.toLowerCase()}`} />
                                      <div className="factor-info">
                                        <span className="factor-name">{f.factor_name}</span>
                                        <span className="factor-reasoning">{f.reasoning}</span>
                                      </div>
                                      <span className={`factor-result ${f.result.toLowerCase()}`}>{f.result}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <h4>Secondary Factors</h4>
                                <div className="factors-list">
                                  {result.secondary_factors?.map((f, i) => (
                                    <div key={i} className="factor-row">
                                      <span className={`factor-dot ${f.result.toLowerCase()}`} />
                                      <div className="factor-info">
                                        <span className="factor-name">{f.factor_name}</span>
                                        <span className="factor-reasoning">{f.reasoning}</span>
                                      </div>
                                      <span className={`factor-result ${f.result.toLowerCase()}`}>{f.result}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
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
    </div>
  );
}

function InfoField({ label, value, mono }) {
  return (
    <div className="info-field">
      <span className="info-label">{label}</span>
      <span className={`info-value ${mono ? "mono" : ""}`}>{value || "—"}</span>
    </div>
  );
}

function isHighRisk(listId) {
  return ["OFAC_SDN", "UN_CONSOLIDATED", "EU_CONSOLIDATED", "UK_HMT", "MAS_TF"].includes(listId);
}

export default App;
