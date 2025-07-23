import React, { useState, useEffect, useRef, useMemo } from "react";
import axios from "axios";
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
} from "react-bootstrap";
import CandidatesTable from "./CandidateTable.jsx";
import { getDistance as geoGetDistance } from "geolib";
import cities from "cities.json";
import "react-bootstrap-typeahead/css/Typeahead.css";
import { AsyncTypeahead } from "react-bootstrap-typeahead";
import { compareTwoStrings } from "string-similarity";

// if two texts share ≥8 distinct words, treat as maximally similar
function compareEnhanced(a, b) {
  const tokensA = Array.from(
    new Set(a.toLowerCase().match(/\b\w+\b/g) || [])
  );
  const tokensB = Array.from(
    new Set(b.toLowerCase().match(/\b\w+\b/g) || [])
  );
  const common = tokensA.filter((w) => tokensB.includes(w));
  if (common.length >= 8) return 1;
  return compareTwoStrings(a, b);
}

// only US + India
const FILTERED_CITIES = cities.filter(
  (c) => c.country === "US" || c.country === "IN"
);

// flatten to "City, State" strings
const cityOptions = FILTERED_CITIES.map((c) => `${c.name}, ${c.admin1}`);


import { unparse } from "papaparse";

export default function AppCandidates({ jobId }) {
    

  // ── State Hooks ───────────────────────────────────────────────
  const [searchTerm, setSearchTerm]           = useState("");
  const [requireAll, setRequireAll]           = useState(false);
  const [minGpaText, setMinGpaText]           = useState("");
  const [gpaError, setGpaError]               = useState(false);
  const [gpaListed, setGpaListed]             = useState(false);
  const [distance, setDistance]               = useState("");
  const [location, setLocation]               = useState("");
  const [locationError, setLocationError]     = useState(false);
  const [reqText, setReqText]                 = useState("");
  const [nicknames, setNicknames]             = useState([]);
  const [mapping, setMapping]                 = useState({});
  const [sortConfig, setSortConfig]           = useState({});
  const [showModal, setShowModal]             = useState(false);
  const [modalCandidate, setModalCandidate]   = useState(null);
  const [anonymize, setAnonymize]             = useState(false);
  const [userCoords, setUserCoords]           = useState(null);
  const [distanceError, setDistanceError]     = useState(false);
  const [candidates, setCandidates]           = useState([]);
  const [selectedRows, setSelectedRows]       = useState([]);
  // toggle our new Entrepreneurial badge
  const [showEntrepreneurial, setShowEntrepreneurial] = useState(false);
  const [cityOptionsAsync, setCityOptionsAsync] = useState([]);
    const [cityLoading, setCityLoading]           = useState(false);

  // ── Helpers ───────────────────────────────────────────────────
  function lookupCoords(address) {
    const [cityName, stateAbbr] = address
      .split(",")
      .map((s) => s.trim().toLowerCase());
    const rec = FILTERED_CITIES.find(
      (c) =>
        c.name.toLowerCase() === cityName &&
        c.country === "US" &&
        c.admin1.toLowerCase() === stateAbbr
    );
    return rec ? { lat: +rec.lat, lng: +rec.lng } : null;
  }

  // bucket by first char for ultra-fast per-keystroke filtering
  const prefixMap = useMemo(() => {
    return cityOptions.reduce((map, label) => {
      const key = label.charAt(0).toLowerCase();
      (map[key] ||= []).push(label);
      return map;
    }, {});
  }, []);

  // AsyncTypeahead loader (only scans small bucket + slices to 10)
  function handleCitySearch(query) {
    console.log("Searching cities for:", query);
    setCityLoading(true);
    const key = query.charAt(0).toLowerCase();
    const bucket = prefixMap[key] || cityOptions; 
    console.log("   bucket size:", bucket.length)
    const matches = bucket
      .filter((lbl) => lbl.toLowerCase().startsWith(query.toLowerCase()))
      .slice(0, 10);
    setCityOptionsAsync(matches);
    setCityLoading(false);
  }

  function makeCsv(rows) {
    return unparse(rows, {
      quotes: false,
      quoteChar: '"',
      escapeChar: '"',
      delimiter: ",",
      header: true,
      newline: "\r\n",
    });
  }

  // Haversine distance helper (meters)
  const R = 6371e3;
  function getDistance(p1, p2) {
    const toRad = (d) => (d * Math.PI) / 180;
    const φ1 = toRad(p1.lat), φ2 = toRad(p2.lat);
    const Δφ = toRad(p2.lat - p1.lat);
    const Δλ = toRad(p2.lng - p1.lng);
    const a =
      Math.sin(Δφ / 2) ** 2 +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // ── Data Fetch & Upload ────────────────────────────────────────
  async function fetchCandidates() {
    try {
      const { data } = await axios.get(`/api/candidates?jobId=${jobId}`);
      setCandidates(
        data.map((c) => ({
          ...c,
          starred: false,
          scores: {},
          coords: lookupCoords(c.location),
        }))
      );
    } catch (err) {
      console.error("fetchCandidates failed:", err);
    }
  }

  async function uploadResumes(files) {
    if (!files.length) return alert("Select at least one file!");
    const form = new FormData();
    Array.from(files).forEach((f) => form.append("files", f));
    try {
      await axios.post(`/api/upload?jobId=${jobId}`, form);
      fetchCandidates();
    } catch (err) {
      console.error("uploadResumes failed:", err);
      alert("Upload failed");
    }
  }

  // ── Other Handlers ─────────────────────────────────────────────
  // Copy & paste your implementations of:
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

  // ─── Delete Selected Resumes ─────────────────────────────────────────
  async function deleteSelected() {
    if (!selectedRows.length) return;

    if (
      !window.confirm(
        `Are you sure you want to delete ${selectedRows.length} resume(s)?`
      )
    ) {
      return;
    }

    try {
      // 1) hit the backend delete endpoint
      const response = await axios.delete("/api/candidates", {
        data: { ids: selectedRows },
      });

      // 2) check the response body to see which IDs were truly deleted
      //    (your backend returns { deleted: [1,2,3] })
      const { deleted } = response.data;
      if (!Array.isArray(deleted)) {
        throw new Error("Unexpected delete response");
      }

      // 3) now update your React state to remove only those records
      setCandidates((prev) => prev.filter((c) => !deleted.includes(c.id)));
      setSelectedRows([]);
    } catch (err) {
      console.error("Delete failed:", err);

      // if the DELETE never even reached the server (404 or network error),
      // you’ll see it here.  Check DevTools → Network → DELETE /api/candidates
      alert("Failed to delete selected resumes. See console/network tab.");
    }
  }

  // the export routine
  async function exportSelectedToCsv() {
    // filter out only the starred/selected candidates
    const sel = candidates.filter((c) => selectedRows.includes(c.id));
    if (!sel.length) {
      return alert("No rows selected!");
    }

    // build your rows exactly as before
    const rows = sel.map((c) => ({
      ID: c.id,
      Name: c.name,
      Email: c.email,
      Phone: c.phone,
      Location: c.location,
      GPA: c.gpa ?? "",
      Education: (c.degrees_earned || []).map((d) => d[0]).join("; "),
      Skills: c.skills?.replace(/\r?\n/g, "; ") ?? "",
      Projects: (c.projects || []).map((p) => p.name).join("; "),
      Experience: (c.experience || []).join(" | "),
      Starred: c.starred ? "Yes" : "No",
      "Upload Date": c.upload_date || "",
    }));

    const csvText = makeCsv(rows);

    // CASE A: if the File System Access API is available
    if (window.showSaveFilePicker) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: "resumes.csv",
          types: [
            {
              description: "CSV Files",
              accept: { "text/csv": [".csv"] },
            },
          ],
        });
        const writable = await handle.createWritable();
        await writable.write(csvText);
        await writable.close();
      } catch (err) {
        console.error("Save canceled or failed", err);
      }
    }
    // CASE B: fallback for older browsers
    else {
      const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "resumes.csv"; // user can override this in the Save dialog
      a.click();
      URL.revokeObjectURL(url);
    }
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
  // GPA input validation
  function handleGpaChange(e) {
    const v = e.target.value;
    setMinGpaText(v);
    setGpaError(!/^$|^[0-4](\.\d{1,2})?$/.test(v));
  }

  function formatGpa(gpa) {
    if (gpa == null) return "[GPA Not Listed]";
    const s = gpa.toFixed(2);
    // if the very last char is “0”, chop it off
    return s.endsWith("0") ? s.slice(0, -1) : s;
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
  const handleSelectAll = () => {  
    setSelectedRows(  
      selectedRows.length > 0  
        ? []  
        : displayed.map((c) => c.id)  
    );  
  };  

  // ── Effects ────────────────────────────────────────────────────
  useEffect(() => {
    fetchCandidates();
  }, [jobId]);

  // fetch this job’s details so we can prefill the location
  useEffect(() => {
    axios
      .get("/api/jobs")
      .then(({ data }) => {
        const job = data.find((j) => j.id === jobId);
        if (job?.location) {
          setLocation(job.location);
          setLocationError(false);
        }
      })
      .catch((err) => console.error("Failed to load job:", err));
  }, [jobId]);

  useEffect(() => {
    if (!location) setUserCoords(null);
    else setUserCoords(lookupCoords(location));
  }, [location]);

  // ── Filtering & Sorting ────────────────────────────────────────
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
      let aVal, bVal;
    if (key === "Entrepreneurial") {
        aVal = entrepreneurialScores[a.id]?.total ?? 0;
        bVal = entrepreneurialScores[b.id]?.total ?? 0;
      } else {
        aVal = a.scores?.[key]?.score ?? 0;
        bVal = b.scores?.[key]?.score ?? 0;
      }

      const cmp = dir * (bVal - aVal); // descending
      if (cmp !== 0) return cmp; // only return if there's a difference
    }
    return 0; // completely equal
  });

    // ─── Select All / Deselect All Tri-state Logic ───────────────────────  
  const selectAllRef = useRef(null);  
  useEffect(() => {  
    const all = selectedRows.length === displayed.length;  
    const some = selectedRows.length > 0 && !all;  
    if (selectAllRef.current) {  
      selectAllRef.current.indeterminate = some;  
    }  
  }, [selectedRows, displayed.length]);  

  // ── Entrepreneurial Score Breakdown ────────────────────────────
  const entrepreneurialScores = useMemo(() => {
    if (!showEntrepreneurial) return {};

    // build map of id → [{ firstLine, rest }]
    const projMap = candidates.reduce((acc, c) => {
      acc[c.id] = (c.projects || []).map((p) => {
        const lines = p.split("\n").filter(Boolean);
        const first = (lines[0] || "").replace(/\b\d{4}\b/g, "").trim();
        const rest = lines.slice(1).join(" ").replace(/\b\d{4}\b/g, "").trim();
        return { firstLine: first, rest };
      });
      return acc;
    }, {});

    // flatten all firstLines for cross-candidate comparison
    const allFirsts = Object.values(projMap).flatMap((arr) =>
      arr.map((x) => x.firstLine)
    );

    // keyword list (same as before)
    const keywords = [
      "Founded", "Founder", "Co-founded", "Self-employed", "Sole proprietor", "Independent contractor", "Owner", "Operator", "Published", "Designed and marketed", "Creator of", "Produced original content", "Curated content", "Personal project", "Portfolio project", "Monetized", "Generated revenue", "Built a customer base", "Scaled a business", "Grew user base", "Started", "Launched", "Ran ads", "Managed ad campaigns", "Online marketplace", "Identified a market gap", "Spearheaded", "Pitched to investors", "Freelance", "Consultant", "Contract work", "Online business", "™", "®", "mentored"
    ];

    const breakdowns = {};
    for (const [id, arr] of Object.entries(projMap)) {
      // 1) uniqueness
      const uniqs = arr.map(({ firstLine }) => {
        const sims = allFirsts.map((other) =>
            compareEnhanced(firstLine, other)
        );
        const avgSim = sims.reduce((sum, v) => sum + v, 0) / sims.length || 0;
        return 1 - avgSim;
      });
      const factor1 = uniqs.reduce((sum, v) => sum + v, 0) / (uniqs.length || 1);

      // 2) variety
       // 2) variety: weighted (80% title, 20% rest‐of‐text) across each project pair
      const pairs = [];
      for (let i = 0; i < arr.length; i++) {
        for (let j = i + 1; j < arr.length; j++) {
          // 1–sim on firstLine (heavier) + rest (lighter)
          const w1 = 0.1 * (1 - compareEnhanced(arr[i].firstLine, arr[j].firstLine));
            const w2 = 0.9 * (1 - compareEnhanced(arr[i].rest,      arr[j].rest));
          pairs.push(w1 + w2);
        }
      }

      const factor2 =
        pairs.length > 0
          ? pairs.reduce((sum, v) => sum + v, 0) / pairs.length
          : 1;

      // 3) keyword match on an exponential curve into 0–33 points
      const allText = (candidates.find((c) => c.id === +id)?.projects || []).join(" ");
      const hits = keywords.filter((kw) =>
        new RegExp(`\\b${kw.replace(/[-/\\^$*+?.()|[\\]{}]/g, '\\$&')}\\b`, "i").test(allText)
      ).length;
      // exponential sensitivity control (lower → steeper)
      const alpha = 1.8;
      // raw [0–1]: 1 − e^(−hits/alpha)
      const raw = 1 - Math.exp(-hits / alpha);
      // scale into 0–33 point range
      const keywordPoints = Math.round(raw * 33);
      const factor3 = raw;

      // convert each factor (0–1) into 0–33 slice, plus total
      const u = Math.round(factor1 * 33);
      const v = Math.round(factor2 * 33);
      const k = Math.round(factor3 * 33);
      breakdowns[id] = {
        uniqueness: u,
        variety:    v,
        keywords:   k,
        total:     Math.round(((factor1 + factor2 + factor3) / 3) * 100),
      };
    }
    return breakdowns;
  }, [candidates, showEntrepreneurial]);


  // ── Render ─────────────────────────────────────────────────────
  return (
    <Container fluid className="py-4" style={{ marginTop: "1rem" }}>
      <h3>Job #{jobId} Candidates</h3>
      <Row>
        {/* ─── Sidebar Filters ─────────────────────────────────── */}
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
  <Form.Control.Feedback type="invalid">
    Enter a whole number
  </Form.Control.Feedback>
  <span className="mx-2">miles of</span>

  <div style={{ flex: "1 1 auto", minWidth: "10rem" }}>
    <AsyncTypeahead
      id="city-async-typeahead"
      isLoading={cityLoading}
      // filterBy={() => true}         // disable AsyncTypeahead’s built-in filter
      minLength={2}                    // fire on every char (for debugging)
        delay={200}                      // debounce your onSearch
      onSearch={handleCitySearch}
      options={cityOptionsAsync}
      placeholder="Enter city, state"
      flip
      selected={location ? [location] : []}
      onChange={(sel) => {
            if (sel.length) {
            setLocation(sel[0]);
            } else {
            setLocation("");
            }
            setLocationError(false);
        }}
      onBlur={() => {
            // no error if empty
            if (!location.trim()) {
            setLocationError(false);
            return;
            }
            const ok = cityOptions.includes(location);
            setLocationError(!ok);
        }}
      inputProps={{
        className: locationError
          ? "form-control-sm is-invalid"
          : "form-control-sm",
      }}
      renderMenuItemChildren={(opt) => <span>{opt}</span>}
    />

    {locationError && (
      <div className="invalid-feedback d-block">
        Please select a valid city (e.g. “Tempe, AZ”)
      </div>
    )}
  </div>
</Form.Group>

            {/* ─────────────────────────────────────────────────── */}

                  <hr />

                  {/* GPA */}
                  <Form.Group controlId="gpaFilter" className="mb-3">
                    <Form.Check
                      type="checkbox"
                      label="Has GPA Listed"
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

        {/* ─── Main Panel ─────────────────────────────────────── */}
        <Col xs={12} md={9}>
          <div className="toolbar mb-3 d-flex flex-wrap align-items-center">
            <Form.Check
              type="checkbox"
              label="Entrepreneurial"
              className="me-3"
              checked={showEntrepreneurial}
              onChange={(e) => setShowEntrepreneurial(e.target.checked)}
            />

            <label className="btn btn-primary me-2">
              Upload Resumes
              <input
                type="file"
                multiple
                onChange={(e) => uploadResumes(e.target.files)}
                style={{ display: "none" }}
              />
            </label>
            <Button
              variant="outline-secondary"
              className="me-2"
              onClick={exportSelectedToCsv}
            >
              Export Selected
            </Button>
            <Button
              variant="outline-secondary"
              className="me-2"
              disabled={selectedRows.length === 0}
              onClick={deleteSelected}
            >
              Delete Selected
            </Button>

            {/* requirement‐sorting badges */}
            {[
              ...nicknames,
              ...(showEntrepreneurial ? ["Entrepreneurial"] : []),
            ].map((nick) => {
              const dir = sortConfig[nick] || 0;
              const arrow = dir === 1 ? "↑" : dir === -1 ? "↓" : "";
              const variant = dir ? "primary" : "secondary";

              const tooltipText =
                nick === "Entrepreneurial"
                  ? "Score based on project uniqueness, variety, and keywords"
                  : mapping[nick].replace(/•\s*/g, "\n• ").trim();

              return (
                <OverlayTrigger
                  key={nick}
                  placement="bottom"
                  flip={false}
                  delay={{ show: 2000, hide: 0 }}
                  overlay={<Tooltip id={`tt-${nick}`}>{tooltipText}</Tooltip>}
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

            {/* ─── Select All / Deselect All Checkbox ────────────────────── */}
        <div className="form-check mb-2">
          <input
            className="form-check-input"
            type="checkbox"
            id="select-all-checkbox"
            ref={selectAllRef}
            checked={selectedRows.length === displayed.length}
            onChange={handleSelectAll}
            style={{ cursor: "pointer" }}
          />
          <label
            className="form-check-label"
            htmlFor="select-all-checkbox"
            style={{ cursor: "pointer" }}
          >
            {selectedRows.length === 0 ? "Select All" : "Deselect All"}
          </label>
        </div>
          <CandidatesTable
            candidates={displayed}
            anonymize={anonymize}
            onToggleStar={toggleStar}
            onViewCandidate={handleViewCandidate}
            selectedRows={selectedRows}
            onSelectRow={onSelectRow}
            onClearBadgeSort={() => setSortConfig({})}
            showEntrepreneurial={showEntrepreneurial}
            entrepreneurialScores={entrepreneurialScores}
          />
        </Col>
      </Row>

      {/* ─── Resume Preview Modal ──────────────────────────────── */}
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
                    GPA: {formatGpa(modalCandidate?.gpa)}
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
            {modalCandidate?.skills && (
              <div className="resume-section mb-0">
                <h2 className="resume-section-title">Skills</h2>
                <pre className="resume-skills-block">
                  {modalCandidate.skills}
                </pre>
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
  );
}
