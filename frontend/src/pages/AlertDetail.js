import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";

const API = "http://localhost:8000";

function AlertDetail() {
  const { alertId } = useParams();
  const navigate = useNavigate();
  const [alertData, setAlertData] = useState(null);
  const [screening, setScreening] = useState(false);
  const [screeningHit, setScreeningHit] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchAlert();
  }, [alertId]);

  const fetchAlert = async () => {
    try {
      const res = await fetch(`${API}/api/alerts/${encodeURIComponent(alertId)}`);
      if (!res.ok) throw new Error("Alert not found");
      const data = await res.json();
      setAlertData(data);
    } catch (err) {
      setError(err.message);
    }
  };

  const screenAllHits = async () => {
    setScreening(true);
    setError("");
    try {
      await fetch(`${API}/api/screening/${encodeURIComponent(alertId)}`, { method: "POST" });
      navigate(`/alert/${encodeURIComponent(alertId)}/result`);
    } catch (err) {
      setError("Screening failed. Check backend logs.");
    }
    setScreening(false);
  };

  const screenSingleHit = async (entryId) => {
    setScreeningHit(entryId);
    setError("");
    try {
      await fetch(
        `${API}/api/screening/${encodeURIComponent(alertId)}/hit/${encodeURIComponent(entryId)}`,
        { method: "POST" }
      );
      navigate(`/alert/${encodeURIComponent(alertId)}/result`);
    } catch (err) {
      setError("Screening failed. Check backend logs.");
    }
    setScreeningHit(null);
  };

  if (error) return <div className="page"><div className="error-message">{error}</div></div>;
  if (!alertData) return <div className="page"><p>Loading...</p></div>;

  const { alert, results } = alertData;
  const party = alert.party;

  return (
    <div className="page">
      <div className="page-header">
        <h1>Alert: {alert.alert_id}</h1>
        <button onClick={screenAllHits} disabled={screening} className="btn btn-primary">
          {screening ? "Screening..." : "Screen All Hits"}
        </button>
      </div>

      {results.length > 0 && (
        <div className="info-banner">
          Screening results available.{" "}
          <span className="link" onClick={() => navigate(`/alert/${encodeURIComponent(alertId)}/result`)}>
            View Results
          </span>
        </div>
      )}

      <div className="detail-grid">
        <div className="card">
          <h2>Party / Customer Data</h2>
          <div className="field-grid">
            <div className="field">
              <label>Name</label>
              <span className="bold">{party.name}</span>
            </div>
            <div className="field">
              <label>Date of Birth</label>
              <span>{party.dob || "N/A"}</span>
            </div>
            <div className="field">
              <label>Year of Birth</label>
              <span>{party.yob || "N/A"}</span>
            </div>
            <div className="field">
              <label>Gender</label>
              <span>{party.gender}</span>
            </div>
            <div className="field">
              <label>Nationality</label>
              <span>{party.nationalities?.join(", ") || "N/A"}</span>
            </div>
            <div className="field">
              <label>Birth Country</label>
              <span>{party.birth_country || "N/A"}</span>
            </div>
            <div className="field">
              <label>IDs</label>
              <span>
                {party.ids?.map((id, i) => (
                  <span key={i} className="monospace">{id.id_number} ({id.id_type})</span>
                ))}
              </span>
            </div>
            <div className="field">
              <label>Address</label>
              <span>
                {party.addresses?.map((a, i) => (
                  <span key={i}>{[a.line1, a.line2, a.city, a.country].filter(Boolean).join(", ")}</span>
                ))}
              </span>
            </div>
          </div>
        </div>
      </div>

      <h2>Watchlist Hits ({alert.hits?.length || 0})</h2>
      <div className="hits-grid">
        {alert.hits?.map((hit, idx) => (
          <div key={idx} className="card hit-card">
            <div className="hit-header">
              <div>
                <span className={`badge ${hit.score >= 90 ? "badge-high" : hit.score >= 70 ? "badge-medium" : "badge-low"}`}>
                  Score: {hit.score}
                </span>
                <span className={`badge ${isHighRiskList(hit.list_id) ? "badge-high" : "badge-info"}`}>
                  {hit.list_id}
                </span>
              </div>
              <button
                onClick={() => screenSingleHit(hit.entry_id)}
                disabled={screeningHit === hit.entry_id}
                className="btn btn-sm"
              >
                {screeningHit === hit.entry_id ? "Screening..." : "Screen This Hit"}
              </button>
            </div>

            <div className="field-grid">
              <div className="field">
                <label>Display Name</label>
                <span className="bold">{hit.display_name}</span>
              </div>
              <div className="field">
                <label>Matched Name</label>
                <span className="monospace">{hit.matched_name}</span>
              </div>
              <div className="field">
                <label>Aliases</label>
                <span>{hit.aliases?.map(a => a.display_name).join(", ") || "None"}</span>
              </div>
              <div className="field">
                <label>Category</label>
                <span>{hit.categories?.join(", ") || "N/A"}</span>
              </div>
              <div className="field">
                <label>Nationality</label>
                <span>{hit.nationalities?.join(", ") || "N/A"}</span>
              </div>
              <div className="field">
                <label>Gender</label>
                <span>{hit.gender}</span>
              </div>
              <div className="field">
                <label>Position</label>
                <span>{hit.position || "N/A"}</span>
              </div>
              <div className="field">
                <label>Deceased</label>
                <span>{hit.is_deceased ? `Yes (${hit.deceased_date})` : "No"}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function isHighRiskList(listId) {
  const high = ["OFAC_SDN", "UN_CONSOLIDATED", "EU_CONSOLIDATED", "UK_HMT", "MAS_TF"];
  return high.includes(listId);
}

export default AlertDetail;
