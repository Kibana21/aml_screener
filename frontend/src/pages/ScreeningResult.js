import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";

const API = "http://localhost:8000";

function ScreeningResult() {
  const { alertId } = useParams();
  const [alertData, setAlertData] = useState(null);
  const [results, setResults] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchData();
  }, [alertId]);

  const fetchData = async () => {
    try {
      const [alertRes, resultsRes] = await Promise.all([
        fetch(`${API}/api/alerts/${encodeURIComponent(alertId)}`),
        fetch(`${API}/api/screening/${encodeURIComponent(alertId)}/results`),
      ]);
      if (!alertRes.ok) throw new Error("Alert not found");
      const alertJson = await alertRes.json();
      const resultsJson = await resultsRes.json();
      setAlertData(alertJson.alert);
      setResults(resultsJson);
    } catch (err) {
      setError(err.message);
    }
  };

  if (error) return <div className="page"><div className="error-message">{error}</div></div>;
  if (!alertData) return <div className="page"><p>Loading...</p></div>;

  const getDecisionClass = (decision) => {
    if (decision.includes("True")) return "decision-true-positive";
    if (decision.includes("Hold")) return "decision-hold";
    return "decision-false-positive";
  };

  const getFactorClass = (result) => {
    if (result === "Match") return "factor-match";
    if (result === "Mismatch") return "factor-mismatch";
    return "factor-unknown";
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>Screening Results</h1>
        <Link to={`/alert/${encodeURIComponent(alertId)}`} className="btn">
          Back to Alert
        </Link>
      </div>

      <div className="info-banner">
        <strong>Party:</strong> {alertData.party?.name} |{" "}
        <strong>Alert:</strong> {alertData.alert_id} |{" "}
        <strong>Hits Screened:</strong> {results.length}
      </div>

      {results.length === 0 && (
        <div className="empty-state">
          No screening results yet. Go back and run screening on the alert.
        </div>
      )}

      {results.map((result, idx) => {
        const hit = alertData.hits?.find(h => h.entry_id === result.hit_entry_id);
        return (
          <div key={idx} className="card result-card">
            <div className="result-header">
              <div>
                <h2>Hit: {hit?.display_name || result.hit_entry_id}</h2>
                <span className={`badge ${hit && isHighRiskList(hit.list_id) ? "badge-high" : "badge-info"}`}>
                  {result.hit_list_id}
                </span>
                {result.is_terror_sanction && (
                  <span className="badge badge-high">Terror/Sanctions</span>
                )}
              </div>
              <div className={`decision-badge ${getDecisionClass(result.decision)}`}>
                {result.decision}
              </div>
            </div>

            <div className="result-meta">
              <div className="field">
                <label>Rule Applied</label>
                <span>{result.rule_applied}</span>
              </div>
              <div className="field">
                <label>Name Match</label>
                <span>{result.name_match_type}</span>
              </div>
            </div>

            <div className="reasoning-section">
              <h3>Overall Reasoning</h3>
              <p className="reasoning-text">{result.overall_reasoning}</p>
            </div>

            {result.name_match_reasoning && (
              <div className="reasoning-section">
                <h3>Name Match Analysis</h3>
                <p className="reasoning-text">{result.name_match_reasoning}</p>
              </div>
            )}

            {result.info_request && (
              <div className="info-request">
                <h3>Information Requested</h3>
                <p>{result.info_request}</p>
              </div>
            )}

            <div className="factors-section">
              <div className="factors-column">
                <h3>Primary Factors</h3>
                <table className="factors-table">
                  <thead>
                    <tr>
                      <th>Factor</th>
                      <th>Result</th>
                      <th>Reasoning</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.primary_factors?.map((f, i) => (
                      <tr key={i}>
                        <td>{f.factor_name}</td>
                        <td>
                          <span className={`factor-badge ${getFactorClass(f.result)}`}>
                            {f.result}
                          </span>
                        </td>
                        <td className="reasoning-cell">{f.reasoning}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="factors-column">
                <h3>Secondary Factors</h3>
                <table className="factors-table">
                  <thead>
                    <tr>
                      <th>Factor</th>
                      <th>Result</th>
                      <th>Reasoning</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.secondary_factors?.map((f, i) => (
                      <tr key={i}>
                        <td>{f.factor_name}</td>
                        <td>
                          <span className={`factor-badge ${getFactorClass(f.result)}`}>
                            {f.result}
                          </span>
                        </td>
                        <td className="reasoning-cell">{f.reasoning}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function isHighRiskList(listId) {
  const high = ["OFAC_SDN", "UN_CONSOLIDATED", "EU_CONSOLIDATED", "UK_HMT", "MAS_TF"];
  return high.includes(listId);
}

export default ScreeningResult;
