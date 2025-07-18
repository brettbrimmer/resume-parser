import React, { useState, useEffect } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import { Table, Badge } from "react-bootstrap";
import axios from "axios";
import "./App.css";
import CandidatesTable from "./components/CandidateTable.jsx";

function App() {
  // ─── Filter & Requirements States ────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState("");
  const [requireAll, setRequireAll] = useState(false);
  const [filters, setFilters] = useState({ AI: false, ML: false, SE: false });
  const [minGPA, setMinGPA] = useState("2.0");
  const [distance, setDistance] = useState("10");
  const [location, setLocation] = useState("Tempe, AZ");

  // NEW: requirements input & nicknames
  const [reqText, setReqText] = useState("");
  const [nicknames, setNicknames] = useState([]);

  // ─── Upload & Data States ────────────────────────────────────────────────
  const [files, setFiles] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [selectedRows, setSelectedRows] = useState([]);

  // Fetch parsed candidates on mount
  useEffect(() => {
    fetchCandidates();
  }, []);

  const fetchCandidates = async () => {
    try {
      const res = await axios.get("/api/candidates");
      setCandidates(
        res.data.map((c) => ({ ...c, starred: false, scores: {} }))
      );
      console.log("candidates payload:", res.data);
    } catch (err) {
      console.error("Error fetching candidates:", err);
    }
  };

  // Upload to backend, then refresh list
  const uploadResumes = async () => {
    if (!files.length) return alert("Select at least one file!");
    const form = new FormData();
    Array.from(files).forEach((f) => form.append("files", f));

    try {
      await axios.post("/api/upload", form);
      fetchCandidates();
    } catch (err) {
      console.error("Upload failed:", err);
      alert("Upload failed. Check console.");
    }
  };

  // ─── Requirements → OpenAI Scoring ───────────────────────────────────────
  const applyRequirements = async () => {
    const lines = reqText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    if (!lines.length) {
      return alert("Enter at least one requirement.");
    }

    try {
      //const { data } = await axios.post("/api/requirements", {
      const { data } = await axios.post(
        "http://localhost:8000/api/requirements",
        {
          requirements: lines,
        }
      );

      // 1) update column nicknames
      const newNames = Object.values(data.mapping);
      setNicknames(newNames);

      // 2) merge new scores into candidates
      +    setCandidates((prev) =>
      prev.map((c) => {
        const scored = data.candidates.find((x) => x.id === c.id);
        return { ...c, scores: scored?.results || {} };
      })
    );
    } catch (err) {
      console.error("Error applying requirements:", err);
      alert("Failed to apply requirements.");
    }
  };

  // Toggle star on a candidate
  const toggleStar = (id) => {
    setCandidates((prev) =>
      prev.map((c) => (c.id === id ? { ...c, starred: !c.starred } : c))
    );
  };

  // Toggle selection on a candidate row
  const onSelectRow = (id) => {
    setSelectedRows((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // Apply client‐side filters (search + checkboxes)
  const displayed = candidates.filter((c) => {
    // no filter if search box is empty
    if (!searchTerm) return true;

    // build an array of non-empty, trimmed, lowercase terms
    const terms = searchTerm
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);

    // prepare the text to search in
    const hay = c.text?.toLowerCase() || "";

    if (requireAll) {
      // every term must be present
      if (!terms.every((term) => hay.includes(term))) {
        return false;
      }
    } else {
      // at least one term must match
      if (!terms.some((term) => hay.includes(term))) {
        return false;
      }
    }

    return true;
  });

  return (
    <div className="app-container">
      {/* ─── Sidebar ────────────────────────────────────────────────────────── */}
      <div className="sidebar">
        <h3>Filters</h3>
        <div>
          <label>Search Resumes:</label>
          <br />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="e.g. React, Python..."
          />
        </div>
        <div>
          <input
            type="checkbox"
            id="requireAll"
            checked={requireAll}
            onChange={(e) => setRequireAll(e.target.checked)}
          />
          <label htmlFor="requireAll"> Require all search terms</label>
        </div>
        {["AI", "ML", "SE"].map((key) => (
          <div key={key}>
            <input
              type="checkbox"
              id={key}
              checked={filters[key]}
              onChange={(e) =>
                setFilters((f) => ({ ...f, [key]: e.target.checked }))
              }
            />
            <label htmlFor={key}>
              {key === "AI"
                ? " AI"
                : key === "ML"
                ? " Machine Learning"
                : " Software Engineer"}
            </label>
          </div>
        ))}
        <div>
          <label>GPA at least</label>
          <br />
          <select value={minGPA} onChange={(e) => setMinGPA(e.target.value)}>
            <option>2.0</option>
            <option>3.0</option>
            <option>4.0</option>
          </select>
        </div>
        <div>
          <label>Within</label>
          <br />
          <select
            value={distance}
            onChange={(e) => setDistance(e.target.value)}
          >
            <option>10</option>
            <option>25</option>
            <option>50</option>
            <option>100</option>
          </select>
          <span> miles of </span>
          <select
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          >
            <option>Tempe, AZ</option>
            <option>Phoenix, AZ</option>
            <option>Chicago, IL</option>
          </select>
        </div>

        {/* ─── New Requirements Input ─────────────────────────────────── */}
        <div style={{ marginTop: "1rem" }}>
          <label>Requirements (one per line):</label>
          <textarea
            rows="5"
            value={reqText}
            onChange={(e) => setReqText(e.target.value)}
            placeholder="e.g. Strong React skills"
            style={{ width: "100%" }}
          />
          <button class="btn btn-primary me-2" onClick={applyRequirements} style={{ marginTop: "0.5rem" }}>
            Apply Requirements
          </button>
        </div>
      </div>

      {/* ─── Main Panel ─────────────────────────────────────────────────── */}
      <div className="main">
        <div className="toolbar">
          <label className="btn btn-primary me-2">
            Choose Files
            <input
              type="file"
              multiple
              onChange={(e) => setFiles(e.target.files)}
              style={{ display: "none" }}
            />
          </label>
          <button class="btn btn-primary me-2" onClick={uploadResumes}>Upload Resumes</button>
          <button class="btn btn-primary me-2"
            onClick={() => {
              const starred = candidates.filter((c) => c.starred);
              alert(`Exporting ${starred.length} candidates`);
            }}
          >
            Export Starred
          </button>
        </div>

        <CandidatesTable
          candidates={displayed}
          nicknames={nicknames}
          onToggleStar={toggleStar}
          onViewCandidate={(id) =>
            window.open(`/api/candidates/${id}`, "_blank")
          }
          selectedRows={selectedRows}
          onSelectRow={onSelectRow}
        />
      </div>
    </div>
  );
}

export default App;
