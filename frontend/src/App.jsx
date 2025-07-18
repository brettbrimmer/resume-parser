import React, { useState, useEffect } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import {
  Container,
  Row,
  Col,
  Card,
  Form,
  Button,
} from "react-bootstrap";
import axios from "axios";
import "./App.css";
import CandidatesTable from "./components/CandidateTable.jsx";

function App() {
  // ─── Filter & Requirements States ────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState("");
  const [requireAll, setRequireAll] = useState(false);

  const [minGpaText, setMinGpaText] = useState("");
  const [gpaError, setGpaError] = useState(false);
  const [gpaListed, setGpaListed] = useState(false);

  const [distance, setDistance] = useState("10");
  const [location, setLocation] = useState("Tempe, AZ");

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

  async function fetchCandidates() {
    try {
      const res = await axios.get("/api/candidates");
      setCandidates(
        res.data.map((c) => ({ ...c, starred: false, scores: {} }))
      );
    } catch (err) {
      console.error(err);
    }
  }

  // Upload resumes
  async function uploadResumes() {
    if (!files.length) return alert("Select at least one file!");
    const form = new FormData();
    Array.from(files).forEach((f) => form.append("files", f));
    try {
      await axios.post("/api/upload", form);
      fetchCandidates();
    } catch (err) {
      console.error(err);
      alert("Upload failed");
    }
  }

  // Apply requirements → OpenAI scoring
  async function applyRequirements() {
    const lines = reqText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (!lines.length) {
      alert("Enter at least one requirement.");
      return;
    }
    try {
      const { data } = await axios.post("/api/requirements", {
        requirements: lines,
      });
      setNicknames(Object.values(data.mapping));
      setCandidates((prev) =>
        prev.map((c) => {
          const scored = data.candidates.find((x) => x.id === c.id);
          return { ...c, scores: scored?.results || {} };
        })
      );
    } catch (err) {
      console.error(err);
      alert("Failed applying requirements");
    }
  }

  // GPA input validation
  function handleGpaChange(e) {
    const v = e.target.value;
    setMinGpaText(v);
    setGpaError(!/^$|^[0-4](\.\d{1,2})?$/.test(v));
  }

  // Star & row‐select toggles
  function toggleStar(id) {
    setCandidates((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, starred: !c.starred } : c
      )
    );
  }
  function onSelectRow(id) {
    setSelectedRows((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id]
    );
  }

  // Apply client‐side filters
  const displayed = candidates.filter((c) => {
    // 1) text‐search
    if (searchTerm.trim()) {
      const terms = searchTerm
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);
      const hay = c.text?.toLowerCase() || "";
      if (requireAll) {
        if (!terms.every((t) => hay.includes(t))) return false;
      } else {
        if (!terms.some((t) => hay.includes(t))) return false;
      }
    }

    // 2) GPA filter
    const threshold =
      !gpaError && minGpaText.trim() !== ""
        ? parseFloat(minGpaText)
        : null;
    if (gpaListed && c.gpa == null) return false;
    if (
      threshold != null &&
      c.gpa != null &&
      c.gpa < threshold
    )
      return false;

    return true;
  });

  return (
    <Container fluid className="py-4">
      <Row>
        {/* ─── Sidebar ─────────────────────────────────────────────────── */}
        <Col xs={12} md={2}>
          <Card className="mb-4">
            <Card.Header as="h5">Filters</Card.Header>
            <Card.Body>
              <Form>
                {/* Search */}
                <Form.Group controlId="searchResumes" className="mb-3">
                  <Form.Label>Search Resumes</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="e.g. React, Python…"
                    value={searchTerm}
                    onChange={(e) =>
                      setSearchTerm(e.target.value)
                    }
                  />
                  <Form.Check
                    type="checkbox"
                    label="Require all search terms"
                    className="mt-2"
                    checked={requireAll}
                    onChange={(e) =>
                      setRequireAll(e.target.checked)
                    }
                  />
                </Form.Group>

                <hr />

                {/* Location */}
                <Form.Group
                  controlId="locationFilter"
                  className="mb-3 d-flex align-items-center"
                >
                  <Form.Label className="me-2 mb-0">
                    Within
                  </Form.Label>
                  <Form.Select
                    size="sm"
                    value={distance}
                    onChange={(e) =>
                      setDistance(e.target.value)
                    }
                    className="w-auto"
                  >
                    <option>10</option>
                    <option>25</option>
                    <option>50</option>
                    <option>100</option>
                  </Form.Select>
                  <span className="mx-2">miles of</span>
                  <Form.Select
                    size="sm"
                    value={location}
                    onChange={(e) =>
                      setLocation(e.target.value)
                    }
                    className="w-auto"
                  >
                    <option>Tempe, AZ</option>
                    <option>Phoenix, AZ</option>
                    <option>Chicago, IL</option>
                  </Form.Select>
                </Form.Group>

                <hr />

                {/* GPA */}
                <Form.Group controlId="gpaFilter" className="mb-3">
                  <Form.Check
                    type="checkbox"
                    label="Has GPA"
                    checked={gpaListed}
                    onChange={(e) =>
                      setGpaListed(e.target.checked)
                    }
                  />
                  <div className="d-flex align-items-center mt-2">
                    <Form.Label className="me-2 mb-0">
                      Min GPA
                    </Form.Label>
                    <Form.Control
                      type="text"
                      placeholder="e.g. 3.5"
                      value={minGpaText}
                      onChange={handleGpaChange}
                      size="sm"
                      isInvalid={gpaError}
                      className="w-auto"
                      style={{ maxWidth: "6rem" }}
                    />
                    <Form.Control.Feedback type="invalid">
                      0–4, up to 2 decimals
                    </Form.Control.Feedback>
                  </div>
                </Form.Group>

                <hr />

                {/* Requirements */}
                <Form.Group controlId="requirements" className="mb-3">
                  <Form.Label>
                    Requirements (one per line)
                  </Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={5}
                    placeholder="Strong React skills"
                    value={reqText}
                    onChange={(e) => setReqText(e.target.value)}
                  />
                </Form.Group>
                <div className="d-grid">
                  <Button
                    variant="primary"
                    onClick={applyRequirements}
                  >
                    Apply Requirements
                  </Button>
                </div>
              </Form>
            </Card.Body>
          </Card>
        </Col>

        {/* ─── Main Panel ─────────────────────────────────────────────────────── */}
        <Col xs={12} md={9}>
          <div className="toolbar mb-3 d-flex flex-wrap align-items-center">
            <label className="btn btn-primary me-2">
              Choose Files
              <input
                type="file"
                multiple
                onChange={(e) =>
                  setFiles(e.target.files)
                }
                style={{ display: "none" }}
              />
            </label>
            <Button
              variant="primary"
              className="me-2"
              onClick={uploadResumes}
            >
              Upload Resumes
            </Button>
            <Button
              variant="outline-secondary"
              className="me-2"
              onClick={() =>
                alert(
                  `Exporting ${
                    candidates.filter((c) => c.starred).length
                  } starred`
                )
              }
            >
              Export Starred
            </Button>
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
        </Col>
      </Row>
    </Container>
  );
}

export default App;
