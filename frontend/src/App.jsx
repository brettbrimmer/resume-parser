import React, { useState, useEffect } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import {
  Container,
  Row,
  Col,
  Card,
  Form,
  Button,
  Badge,
  OverlayTrigger,
  Tooltip,
  Modal,
  Navbar,
  Nav
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
  const [mapping, setMapping]   = useState({});       // { requirementKey: label }
  const [sortConfig, setSortConfig] = useState({}); // { [name]: 1|-1 }

  // control the resume‐popup
  const [showModal, setShowModal] = useState(false);
  const [modalCandidate, setModalCandidate] = useState(null);

  // whether to hide real names
  const [anonymize, setAnonymize] = useState(false);

  // fetch one candidate and show in modal
  async function handleViewCandidate(id) {
    try {
      const { data } = await axios.get(`/api/candidates/${id}`);
      setModalCandidate(data);
      setShowModal(true);
    } catch (err) {
      console.error("Failed to load candidate:", err);
    }
  }

  // cycle: 0 → 1 (↑) → -1 (↓) → back to 0
  function handleBadgeClick(name) {
    setSortConfig((prev) => {
      const curr = prev[name] || 0;
      const next = curr === 0 ? 1 : curr === 1 ? -1 : 0;
      if (next === 0) {
        const { [name]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [name]: next };
    });
  }

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
    // treat the whole textarea as a single requirement
    //const trimmed = reqText.trim();
    //const lines = trimmed ? [trimmed] : [];
    if (!lines.length) {
      alert("Enter at least one requirement.");
      return;
    }
    try {
      const { data } = await axios.post("/api/requirements", {
        requirements: lines,
      });
      // invert label→key into key→label:
     const flipped = Object.entries(data.mapping).reduce(
       (acc, [label, key]) => ({ ...acc, [key]: label }),
       {}
     );
     setMapping(flipped);
     setNicknames(Object.keys(flipped));
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

  // Apply client‐side filters first
  const filtered = candidates.filter((c) => {
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

  // 2) always sort by badges (no-op if sortConfig is empty)
  console.log("SortConfig:", sortConfig);
    filtered.forEach(c => {
      console.log("Candidate", c.id, "scores:", c.scores);
    });
  const displayed = [...filtered].sort((a, b) => {
  for (const [key, dir] of Object.entries(sortConfig)) {
    const aVal = a.scores?.[key]?.score ?? 0;
    const bVal = b.scores?.[key]?.score ?? 0;

    const cmp = dir * (bVal - aVal); // descending
    if (cmp !== 0) return cmp; // only return if there's a difference
  }
  return 0; // completely equal
});

// ←—— Place your debug log here
  console.log(
    "App rendering, displayed order:",
    displayed.map((c) => c.id),
    "sortConfig:",
    sortConfig
  );

  return (
    <>
      {/* ─── Top Navbar ─────────────────────────────────────────────────── */}
      <Navbar bg="light" expand="lg" sticky="top" className="shadow-sm">
        <Container fluid className="justify-content-start">
          <Navbar.Brand href="/">
            <img
              src="src/images/resumeParserLogo.png"
              height="20"
              alt="Resume Parser Logo"
            />
          </Navbar.Brand>
          <Nav>
            <Nav.Link href="/jobs" className="ms-3 pt-3">View Jobs</Nav.Link>
            <Nav.Link href="/create" className="ms-3 pt-3">Create Job</Nav.Link>
          </Nav>
        </Container>
      </Navbar>

      {/* ─── Page Body ──────────────────────────────────────────────────── */}
      <Container
        fluid
        className="py-4"
        style={{ marginTop: "1rem" }}  // adjust to push content below navbar
      >
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
                className="mb-3 d-flex flex-wrap align-items-center"
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
                    className="w-auto me-2 mb-1"
                  >
                    <option>10</option>
                    <option>25</option>
                    <option>50</option>
                    <option>100</option>
                    <option>150</option>
                    <option>200</option>
                  </Form.Select>
                  <span className="mx-2">miles of</span>
                  <Form.Select
                    size="sm"
                    value={location}
                    onChange={(e) =>
                      setLocation(e.target.value)
                    }
                    className="w-auto mb-1"
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
            {/* requirement-sorting badges */}
            {nicknames.map((nick) => {
              const dir   = sortConfig[nick] || 0;
              const arrow = dir === 1 ? "↑" : dir === -1 ? "↓" : "";
              const variant = dir ? "primary" : "secondary";
              return (
                <OverlayTrigger
                  key={nick}
                  placement="bottom"
                  flip={false}
                  delay={{ show: 2000, hide: 0 }}
                  overlay={
                    <Tooltip id={`tt-${nick}`}>
                      {mapping[nick]
                        // inject real line breaks before every bullet
                        .replace(/•\s*/g, '\n• ')
                        .trim()}
                    </Tooltip>
                  }
                >
                  <Badge
                    bg={variant}
                    className="me-2 mb-2"
                    style={{ cursor: "pointer" }}
                    onClick={() => handleBadgeClick(nick)}
                  >
                    {nick} {arrow}
                  </Badge>
                </OverlayTrigger>
              );
            })}

            {/* anonymize toggle, pushed to right */}
          <div className="ms-auto">
            <Form.Check
              type="checkbox"
              label="Anonymize Candidate Data"
              checked={anonymize}
              onChange={(e) => setAnonymize(e.target.checked)}
            />
          </div>

          </div>

          <CandidatesTable
            candidates={displayed}
            anonymize={anonymize}
            // nicknames={nicknames}
            onToggleStar={toggleStar}
            onViewCandidate={handleViewCandidate}
            selectedRows={selectedRows}
            onSelectRow={onSelectRow}
          />
        </Col>
      </Row>
      {/* ——— Resume Preview Modal ——— */}
      <Modal
        show={showModal}
        onHide={() => setShowModal(false)}
        size="lg"
        // centered
        centered={false}                   // disable flex-centering
        dialogClassName="modal-top"       // our custom class on .modal-dialog
      >
        <Modal.Header closeButton>
          {/* <Modal.Title>Resume: {modalCandidate?.name}</Modal.Title> */}
        </Modal.Header>
        <Modal.Body className="resume-body">

        {/* ——— HEADER ——— */}
        <div className="resume-header text-center mb-4">
          {/* <h1 className="resume-name mb-1">{modalCandidate?.name}</h1> */}
          <h1 className="resume-name mb-1">
            {modalCandidate
            ? anonymize
              ? `C${modalCandidate.id
                  .toString()
                  .padStart(7, "0")}`
              : modalCandidate.name
            : ""}
          </h1>
          <div className="resume-contact text-muted">
            {modalCandidate
              ? anonymize
                ? "[Email Hidden]"
                : modalCandidate.email
              : ""} &bull;{" "}
            {modalCandidate
              ? anonymize
                ? "[Phone Hidden]"
                : modalCandidate.phone
              : ""} &bull; {modalCandidate?.location}
          </div>
        </div>

        {/* ——— EDUCATION ——— */}
        <div className="resume-section">
          <h2 className="resume-section-title">Education</h2>
          <div className="d-flex justify-content-between">
            <div>
              <strong>
                {/*modalCandidate?.degrees_earned?.[0]?.[0]
                  || */"North Carolina State University"}
              </strong>
              <div className="text-muted">
                {modalCandidate?.degrees_earned?.[0]?.[1]
                  || "Expected Graduation: May 2027"}
              </div>
            </div>
            <div className="text-end">
              <div>
                {modalCandidate?.degrees_earned?.[0]?.[0]
                  .split("–")[0]
                  || "Bachelor of Arts, Business Administration"}
              </div>
              <div className="text-muted">
                GPA: {modalCandidate?.gpa?.toFixed(2) || "3.50"}
              </div>
           </div>
          </div>
        </div>

        {/* ——— EXPERIENCE ——— */}
        <h4>Experience</h4>
        {(modalCandidate?.experience || []).map((block, idx) => {
          const lines = block.split("\n").filter((l) => l.trim());
          const [title, company, dates, ...rest] = lines;
          return (
            <div key={idx} className="mb-3">
              <h5>{title}</h5>
              {company && <p className="text-muted">{company}</p>}
              {dates   && <p className="text-small">{dates}</p>}
              <ul className="ps-3">
                {rest.map((line, i) => {
                  // strip any leading bullet char
                  const clean = line.replace(/^[^\w]+/, "");
                  return <li key={i}>{clean}</li>;
                })}
              </ul>
            </div>
          );
        })}

        {/* ——— PROJECTS ——— */}
        <div className="resume-section">
          <h2 className="resume-section-title">Projects</h2>

           {(modalCandidate?.projects || []).map((block, idx) => {
          // break the raw block into lines
          const lines = block.split("\n").filter((l) => l.trim());
          // first line is the title
          const [title, second, ...rest] = lines;
          // if the second line has a '|', treat it as tech stack
          const tech = second && second.includes("|") ? second : null;
          // the rest become your “description” array
          const descLines = tech ? rest : [second, ...rest].filter((l) => l);

          return (
            <div key={idx} className="mb-3">
              <h5 className="project-name">{title}</h5>
              {tech && <p className="project-tech">{tech}</p>}
              <ul className="project-desc">
                {descLines.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            </div>
          );
        })}
        </div>

        {/* ——— SKILLS ——— */}
        <div className="resume-section mb-0">
          <h2 className="resume-section-title">Skills</h2>
          <ul className="mb-0">
            <li><strong>Computer:</strong> Windows/Mac OS, Word, PowerPoint, Excel</li>
            <li><strong>Language:</strong> Spanish (fluent)</li>
            <li><strong>Social Media:</strong> Facebook, Twitter, Instagram</li>
          </ul>
        </div>

      </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
    </>
  );
}

export default App;
