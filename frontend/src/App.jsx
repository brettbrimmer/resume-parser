// App.jsx
import React, { useState, useEffect } from "react";
import { getFullNameByCode } from "us-state-codes";
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
  Nav,
} from "react-bootstrap";
import axios from "axios";
import "./App.css";
import CandidatesTable from "./components/CandidateTable.jsx";
import { getDistance } from "geolib";
// cities.json exports a default array of { name, lat, lng, country, admin1, admin2 }
import cities from "cities.json";

function App() {
  // ─── Filter & Requirements States ────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState("");
  const [requireAll, setRequireAll] = useState(false);

  const [minGpaText, setMinGpaText] = useState("");
  const [gpaError, setGpaError] = useState(false);
  const [gpaListed, setGpaListed] = useState(false);

  const [distance, setDistance] = useState("");
  const [location, setLocation] = useState("Tempe, AZ");

  const [reqText, setReqText] = useState("");
  const [nicknames, setNicknames] = useState([]);
  const [mapping, setMapping] = useState({}); // { requirementKey: label }
  const [sortConfig, setSortConfig] = useState({}); // { [name]: 1|-1 }

  // control the resume‐popup
  const [showModal, setShowModal] = useState(false);
  const [modalCandidate, setModalCandidate] = useState(null);

  // whether to hide real names
  const [anonymize, setAnonymize] = useState(false);

  const [userCoords, setUserCoords] = useState(null);

  const [distanceError, setDistanceError] = useState(false);

  // ——— Haversine distance helper (meters) ———
  const R = 6371e3; // meters
  function getDistance(p1, p2) {
    const toRad = (d) => (d * Math.PI) / 180;
    const φ1 = toRad(p1.lat),
      φ2 = toRad(p2.lat);
    const Δφ = toRad(p2.lat - p1.lat);
    const Δλ = toRad(p2.lng - p1.lng);
    const a =
      Math.sin(Δφ / 2) ** 2 +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // Simple, synchronous city→coords lookup
  function lookupCoords(address) {
    const [cityName, stateAbbr] = address
      .split(",")
      .map((s) => s.trim().toLowerCase());
    const rec = cities.find(
      (c) =>
        c.name.toLowerCase() === cityName &&
        c.country === "US" &&
        c.admin1.toLowerCase() === stateAbbr
    );
    return rec ? { lat: parseFloat(rec.lat), lng: parseFloat(rec.lng) } : null;
  }

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

  // Geocode whenever the filter “location” changes (step 4)
  useEffect(() => {
    if (!location) {
      setUserCoords(null);
    } else {
      setUserCoords(lookupCoords(location));
    }
  }, [location]);

  async function fetchCandidates() {
    try {
      const res = await axios.get("/api/candidates");
      setCandidates(
        res.data.map((c) => ({
          ...c,
          starred: false,
          scores: {},
          coords: lookupCoords(c.location), // ← add this line
        }))
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
      // clear the requirements textarea after sending
      setReqText("");
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

  // Distance input validation (allow empty or integer only)
  function handleDistanceChange(e) {
    const v = e.target.value;
    setDistance(v);
    const isValid = v === "" || /^\d+$/.test(v);
    setDistanceError(!isValid);
  }

  // Star & row‐select toggles
  function toggleStar(id) {
    setCandidates((prev) =>
      prev.map((c) => (c.id === id ? { ...c, starred: !c.starred } : c))
    );
  }
  function onSelectRow(id) {
    setSelectedRows((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
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
      !gpaError && minGpaText.trim() !== "" ? parseFloat(minGpaText) : null;
    if (gpaListed && c.gpa == null) return false;
    if (threshold != null && c.gpa != null && c.gpa < threshold) return false;

    // 3) Distance filter: drop anyone outside `distance` miles
    if (userCoords && parseFloat(distance) > 0) {
      if (!c.coords) return false;
      const meters = getDistance(userCoords, c.coords);
      const miles = meters / 1609.34;
      if (miles > parseFloat(distance)) return false;
    }

    return true;
  });

  // 2) always sort by badges (no-op if sortConfig is empty)
  console.log("SortConfig:", sortConfig);
  filtered.forEach((c) => {
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
            <Nav.Link href="/jobs" className="ms-3 pt-3">
              View Jobs
            </Nav.Link>
            <Nav.Link href="/create" className="ms-3 pt-3">
              Create Job
            </Nav.Link>
          </Nav>
        </Container>
      </Navbar>

      {/* ─── Page Body ──────────────────────────────────────────────────── */}
      <Container
        fluid
        className="py-4"
        style={{ marginTop: "1rem" }} // adjust to push content below navbar
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
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <Form.Check
                      type="checkbox"
                      label="Require all search terms"
                      className="mt-2"
                      checked={requireAll}
                      onChange={(e) => setRequireAll(e.target.checked)}
                    />
                  </Form.Group>

                  <hr />

                  {/* Location */}
                  <Form.Group
                    controlId="locationFilter"
                    className="mb-3 d-flex flex-wrap align-items-center"
                  >
                    <Form.Label className="me-2 mb-0">Within</Form.Label>
                    <Form.Control
                      type="text"
                      size="sm"
                      className="w-auto me-2 mb-1"
                      placeholder="Miles"
                      value={distance}
                      onChange={handleDistanceChange}
                      isInvalid={distanceError}
                      style={{ maxWidth: "4rem" }}
                    />
                    <span className="me-2">miles</span>
                    <Form.Control.Feedback type="invalid">
                      Enter a whole number
                    </Form.Control.Feedback>
                    <span className="mx-2">miles of</span>
                    <Form.Select
                      size="sm"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
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
                      onChange={(e) => setGpaListed(e.target.checked)}
                    />
                    <div className="d-flex align-items-center mt-2">
                      <Form.Label className="me-2 mb-0">Min GPA</Form.Label>
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
                    <Form.Label>Requirement</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={5}
                      placeholder="Enter a detailed requirement..."
                      value={reqText}
                      onChange={(e) => setReqText(e.target.value)}
                    />
                  </Form.Group>
                  <div className="d-grid">
                    <Button variant="primary" onClick={applyRequirements}>
                      Add Requirement
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
                  onChange={(e) => setFiles(e.target.files)}
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
                const dir = sortConfig[nick] || 0;
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
                          .replace(/•\s*/g, "\n• ")
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
          centered={false} // disable flex-centering
          dialogClassName="modal-top" // our custom class on .modal-dialog
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
                    ? `C${modalCandidate.id.toString().padStart(7, "0")}`
                    : modalCandidate.name
                  : ""}
              </h1>
              <div className="resume-contact text-muted">
                {modalCandidate
                  ? anonymize
                    ? "[Email Hidden]"
                    : modalCandidate.email
                  : ""}{" "}
                &bull;{" "}
                {modalCandidate
                  ? anonymize
                    ? "[Phone Hidden]"
                    : modalCandidate.phone
                  : ""}{" "}
                &bull; {modalCandidate?.location}
              </div>
            </div>

            {/* ——— EDUCATION ——— */}
            <div className="resume-section">
              <h2 className="resume-section-title">Education</h2>
              <div className="d-flex justify-content-between">
                <div>
                  <strong>
                    {
                      /*modalCandidate?.degrees_earned?.[0]?.[0]
                  || */ "North Carolina State University"
                    }
                  </strong>
                  <div className="text-muted">
                    {modalCandidate?.degrees_earned?.[0]?.[1] ||
                      "Expected Graduation: May 2027"}
                  </div>
                </div>
                <div className="text-end">
                  <div>
                    {modalCandidate?.degrees_earned?.[0]?.[0].split("–")[0] ||
                      "Bachelor of Arts, Business Administration"}
                  </div>
                  <div className="text-muted">
                    GPA: {modalCandidate?.gpa?.toFixed(2) || "3.50"}
                  </div>
                </div>
              </div>
            </div>

            {/* ——— EXPERIENCE ——— */}
            <div className="resume-section">
              <h2 className="resume-section-title">Experience</h2>
              {(modalCandidate?.experience || []).map((block, idx) => {
                const lines = block.split("\n").filter((l) => l.trim());
                const [title, company, dates, ...rest] = lines;
                return (
                  <div key={idx} className="mb-3">
                    <h5>{title}</h5>
                    {company && <p className="text-muted">{company}</p>}
                    {dates && <p className="text-small">{dates}</p>}
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
            </div>

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
                const descLines = tech
                  ? rest
                  : [second, ...rest].filter((l) => l);

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
            {modalCandidate?.skills?.length > 0 && (
              <div className="resume-section mb-0">
                <h2 className="resume-section-title">Skills</h2>
                <div className="mb-2">
                  {modalCandidate.skills.map((skill) => (
                    <Badge bg="secondary" key={skill} className="me-1 mb-1">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
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
