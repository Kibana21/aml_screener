import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

const API = "http://localhost:8000";

function AlertList() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadAlerts = async () => {
    setLoading(true);
    setError("");
    try {
      await fetch(`${API}/api/alerts/load-all`, { method: "POST" });
      const res = await fetch(`${API}/api/alerts/`);
      const data = await res.json();
      setAlerts(data);
    } catch (err) {
      setError("Failed to connect to backend. Is the server running?");
    }
    setLoading(false);
  };

  useEffect(() => {
    loadAlerts();
  }, []);

  const getScoreBadge = (score) => {
    if (score >= 90) return "badge-high";
    if (score >= 70) return "badge-medium";
    return "badge-low";
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>Alert Dashboard</h1>
        <button onClick={loadAlerts} disabled={loading} className="btn btn-primary">
          {loading ? "Loading..." : "Reload Alerts"}
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="stats-bar">
        <div className="stat">
          <span className="stat-value">{alerts.length}</span>
          <span className="stat-label">Total Alerts</span>
        </div>
        <div className="stat">
          <span className="stat-value">
            {alerts.reduce((sum, a) => sum + (a.hits?.length || 0), 0)}
          </span>
          <span className="stat-label">Total Hits</span>
        </div>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Alert ID</th>
              <th>Date</th>
              <th>Party Name</th>
              <th>Nationality</th>
              <th>DOB</th>
              <th>Score</th>
              <th>Hits</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {alerts.map((alert) => (
              <tr key={alert.alert_id}>
                <td className="monospace">{alert.alert_id}</td>
                <td>{alert.alert_date}</td>
                <td className="bold">{alert.party?.name}</td>
                <td>{alert.party?.nationalities?.join(", ")}</td>
                <td>{alert.party?.dob || "-"}</td>
                <td>
                  <span className={`badge ${getScoreBadge(alert.score)}`}>
                    {alert.score}
                  </span>
                </td>
                <td>{alert.hits?.length || 0}</td>
                <td>
                  <Link to={`/alert/${encodeURIComponent(alert.alert_id)}`} className="btn btn-sm">
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {alerts.length === 0 && !loading && (
          <div className="empty-state">No alerts loaded. Click "Reload Alerts" to load from data directory.</div>
        )}
      </div>
    </div>
  );
}

export default AlertList;
