import { useState } from "react";
import "./App.css";

function App() {
  const [message, setMessage] = useState("");

  const fetchHello = async () => {
    try {
      const response = await fetch("http://localhost:8000/api/hello");
      const data = await response.json();
      setMessage(data.message);
    } catch (error) {
      setMessage("Error connecting to backend");
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>AML Screener</h1>
        <button onClick={fetchHello} style={{ padding: "10px 20px", fontSize: "16px", cursor: "pointer" }}>
          Say Hello
        </button>
        {message && <p style={{ marginTop: "20px" }}>{message}</p>}
      </header>
    </div>
  );
}

export default App;
