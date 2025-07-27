import React, { useState, useEffect, useRef, useMemo } from "react";
import { Collapse } from "react-bootstrap";
import SavedBadgesPanel from "./SavedBadgesPanel";
import SaveBadgeModal   from "./SaveBadgeModal";
import axios from "axios";
import {
  Container,
  Row,
  Col,
  Card,
  Form,
  Button,
  Spinner,
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
import FilterPanel from "./FilterPanel.jsx";

const STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "of",
  "in",
  "to",
  "for",
  "with",
  "on",
  "using",
  "by",
  "is",
  "was",
  "were",
  "has",
  "have",
  "at",
  "from",
  "that",
  "this",
  "it",
  "its",
]);

// strip boilerplate, keep only “meaningful” words
function distill(text) {
  return (text.toLowerCase().match(/\b\w+\b/g) || [])
    .filter((w) => w.length > 3 && !STOPWORDS.has(w))
    .join(" ");
}

// if two texts share ≥8 distinct words, treat as maximally similar
function compareEnhanced(a, b) {
  const tokensA = Array.from(
    new Set(
      (a.toLowerCase().match(/\b\w+\b/g) || []).filter((w) => !STOPWORDS.has(w))
    )
  );
  const tokensB = Array.from(
    new Set(
      (b.toLowerCase().match(/\b\w+\b/g) || []).filter((w) => !STOPWORDS.has(w))
    )
  );
  const common = tokensA.filter((w) => tokensB.includes(w));
  if (common.length >= 15) return 1;
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
  const [searchTerm, setSearchTerm] = useState("");
  const [requireAll, setRequireAll] = useState(false);
  const [minGpaText, setMinGpaText] = useState("");
  const [gpaError, setGpaError] = useState(false);
  const [gpaListed, setGpaListed] = useState(false);
  const [distance, setDistance] = useState("");
  const [location, setLocation] = useState("");
  const [locationError, setLocationError] = useState(false);
  const [jobTitle, setJobTitle] = useState("");
  const [jobLocationDefault, setJobLocationDefault] = useState("");
  const [reqText, setReqText] = useState("");
  const [nicknames, setNicknames] = useState([]);
  // loading flag for Add Requirement
  const [isApplyingReq, setIsApplyingReq] = useState(false);
  const [mapping, setMapping] = useState({});
  const [sortConfig, setSortConfig] = useState({});
  const [showModal, setShowModal] = useState(false);
  const [modalCandidate, setModalCandidate] = useState(null);
  const [anonymize, setAnonymize] = useState(false);
  const [userCoords, setUserCoords] = useState(null);
  const [distanceError, setDistanceError] = useState(false);
  const [candidates, setCandidates] = useState([]);
  const [selectedRows, setSelectedRows] = useState([]);
  // toggle our new Entrepreneurial badge
  const [showEntrepreneurial, setShowEntrepreneurial] = useState(false);
  const [cityOptionsAsync, setCityOptionsAsync] = useState([]);
  const [cityLoading, setCityLoading] = useState(false);

  // collapse state
  const [filtersCollapsed, setFiltersCollapsed] = useState(false);

  // Saved badges loaded from DB
  const [savedBadges, setSavedBadges] = useState([]);

  // Modal state
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [badgeToSave, setBadgeToSave]     = useState({ title: "", reqText: "" });

  // Fetch saved badges on mount
  useEffect(() => {
    fetch("/api/badges")
      .then((res) => res.json())
      .then((data) => setSavedBadges(data))
      .catch(console.error);
  }, []);

  // handler to save a new badge
  const handleSaveBadge = async ({ title, reqText }) => {
    // 1) POST and grab the new badge back, instead of re-fetching the whole list
  const res = await fetch("/api/badges", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, reqText }),
  });
  const payload = await res.json();

  setSavedBadges(prev =>
    // if payload is an array, concat flattens it;
    // if it’s a single object, it just appends it
    prev.concat(payload)
  );
  };

  // when you click a saved badge, re-apply its reqText
  const handleApplySavedBadge = ({ reqText }) => {
    setReqText(reqText);
    applyRequirements();
  };

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
    console.log("   bucket size:", bucket.length);
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
  async function applyRequirements(text = reqText) {
    const lines = text
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
    setIsApplyingReq(true);
    try {
      // now include jobId so backend only processes that job’s resumes
      const { data } = await axios.post(
        `/api/requirements?jobId=${jobId}`, 
        { requirements: lines }
      );
      // clear the requirements textarea after sending
      setReqText("");
      // invert label→key into key→label:
      const flipped = Object.entries(data.mapping).reduce(
        (acc, [label, key]) => ({ ...acc, [key]: label }),
        {}
      );
      // 1) Merge new mappings into existing ones
   setMapping(prev => ({ ...prev, ...flipped }));

   // 2) Append only brand-new requirement keys
   setNicknames(prev => [
     ...prev,
     ...Object.keys(flipped).filter(k => !prev.includes(k))
   ]);

   // 3) Merge each candidate’s new scores into existing scores
   setCandidates(prev =>
     prev.map(c => {
       const scored = data.candidates.find(x => x.id === c.id);
       return {
         ...c,
         scores: {
           ...c.scores,               // keep old badges
           ...(scored?.results || {}) // add new ones
         }
       };
     })
   );
    } catch (err) {
      console.error(err);
      alert("Failed applying requirements");
    } finally {
      setIsApplyingReq(false);
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
    setSelectedRows(selectedRows.length > 0 ? [] : displayed.map((c) => c.id));
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
          setJobLocationDefault(job.location);
          setLocationError(false);
        }
        if (job?.title) {
          setJobTitle(job.title);
        }
      })
      .catch((err) => console.error("Failed to load job:", err));
  }, [jobId]);

  useEffect(() => {
    if (!location) setUserCoords(null);
    else setUserCoords(lookupCoords(location));
  }, [location]);

  // ── Entrepreneurial Score Breakdown ────────────────────────────
  const entrepreneurialScores = useMemo(() => {
    if (!showEntrepreneurial) return {};

    // build map of id → [{ firstLine, rest }]
    const projMap = candidates.reduce((acc, c) => {
      acc[c.id] = (c.projects || []).map((p) => {
        const lines = p.split("\n").filter(Boolean);
        const first = (lines[0] || "").replace(/\b\d{4}\b/g, "").trim();
        const rest = lines
          .slice(1)
          .join(" ")
          .replace(/\b\d{4}\b/g, "")
          .trim();
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
      "Founded",
      "Founder",
      "Co-founded",
      "Self-employed",
      "Sole proprietor",
      "Independent contractor",
      "Owner",
      "Operator",
      "Published",
      "Designed and marketed",
      "Creator of",
      "Produced original content",
      "Curated content",
      "Personal project",
      "Portfolio project",
      "Monetized",
      "Generated revenue",
      "Built a customer base",
      "Scaled a business",
      "Grew user base",
      "Started",
      "Launched",
      "Ran ads",
      "Managed ad campaigns",
      "Online marketplace",
      "Identified a market gap",
      "Spearheaded",
      "Pitched",
      "Investors",
      "Freelance",
      "Consultant",
      "Contract work",
      "Online business",
      "™",
      "®",
      "mentored",
      "Acquired Users",
      "Built a Customer Base",
      "market gap",
      "Sold",
      "Startup",
      "Microstartup",
      "Indie",
      "independently",
      "Acquisition offer",
      "ran",
      "owned",
      "managed",
      "from scratch",
      "scaled",
      "waitlist",
      "Built user base",
      "Patreon",
      "Kickstarter",
      "Kickstarted",
      "Indiegogo",
      "Gumroad",
      "Product Hunt",
      "Indie Hackers",
      "BetaList",
      "AppSumo",
      "Hacker News",
      "HN Launch",
      "Show HN",
      "MicroAcquire",
      "Acquire.com",
      "Shopify",
      "Etsy",
      "Teespring",
      "Printful",
      "RedBubble",
      "Big Cartel",
      "Sellfy",
      "Stripe",
      "Paddle",
      "Lemon Squeezy",
      "Podia",
      "ThriveCart",
      "SamCart",
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
      const factor1 =
        uniqs.reduce((sum, v) => sum + v, 0) / (uniqs.length || 1);

      // 2) variety: 30% title, 70% distilled‐rest comparison
      const distilledRests = arr.map(({ rest }) => distill(rest));
      const pairs = [];
      for (let i = 0; i < arr.length; i++) {
        for (let j = i + 1; j < arr.length; j++) {
          const simTitle = compareEnhanced(arr[i].firstLine, arr[j].firstLine);
          // compare on distilled text so generic verbs don’t dominate
          const simRest = compareTwoStrings(
            distilledRests[i],
            distilledRests[j]
          );
          const w1 = 0.3 * (1 - simTitle);
          const w2 = 0.7 * (1 - simRest);
          pairs.push(w1 + w2);
        }
      }

      const factor2 =
        pairs.length > 0
          ? pairs.reduce((sum, v) => sum + v, 0) / pairs.length
          : 1;

      // 3) keyword match over the entire resume text (projects, skills, experience, education…)
      const cand = candidates.find((c) => c.id === +id) || {};
      const allText = [
        cand.text || "",
        ...(cand.projects || []),
        cand.skills || "",
        (cand.experience || []).join(" "),
        (cand.degrees_earned || []).map((d) => d[1]).join(" "),
      ].join(" ");
      const hits = keywords.filter((kw) =>
        new RegExp(
          `\\b${kw.replace(/[-/\\^$*+?.()|[\\]{}]/g, "\\$&")}\\b`,
          "i"
        ).test(allText)
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
        variety: v,
        keywords: k,
        total: Math.round(((factor1 + factor2 + factor3) / 3) * 100),
      };
    }
    return breakdowns;
  }, [candidates, showEntrepreneurial]);

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

  // ── Render ─────────────────────────────────────────────────────
  return (
    <Container fluid className="py-4" style={{ marginTop: "1rem" }}>
      <h3 className="d-flex align-items-baseline">
        {jobTitle ? jobTitle : `Job #${jobId}`} Candidates
        {jobLocationDefault && (
          <span className="fs-6 text-muted ms-2">({jobLocationDefault})</span>
        )}
      </h3>
      <Row>
        {/* Sidebar Filters */}
        <Col xs={12} md={2}>
          <Card className="mb-3">
            <Card.Header
              onClick={() => setFiltersCollapsed(f => !f)}
              style={{ cursor: "pointer" }}
            >
              <h5>
                Filters
                <span className="float-end">
                  {filtersCollapsed ? "+" : "–"}
                </span>
              </h5>
            </Card.Header>

            <Collapse in={!filtersCollapsed}>
              <div>
                <FilterPanel
            searchTerm={searchTerm}
            onSearchChange={(e) => setSearchTerm(e.target.value)}
            requireAll={requireAll}
            onRequireAllChange={(e) => setRequireAll(e.target.checked)}
            distance={distance}
            onDistanceChange={handleDistanceChange}
            distanceError={distanceError}
            location={location}
            onLocationChange={(sel) => {
              setLocation(sel.length ? sel[0] : "");
              setLocationError(false);
            }}
            onLocationBlur={() => {
              if (!location.trim()) return setLocationError(false);
              setLocationError(!cityOptions.includes(location));
            }}
            locationError={locationError}
            cityOptionsAsync={cityOptionsAsync}
            cityLoading={cityLoading}
            onCitySearch={handleCitySearch}
            cityOptions={cityOptions}
            gpaListed={gpaListed}
            onGpaListedChange={(e) => setGpaListed(e.target.checked)}
            minGpaText={minGpaText}
            onMinGpaTextChange={handleGpaChange}
            gpaError={gpaError}
            /* ─── Requirements props ───────────────────────── */
            reqText={reqText}
            onReqTextChange={(e) => setReqText(e.target.value)}
            isApplyingReq={isApplyingReq}
            onApplyRequirements={applyRequirements}
            /* ─── Entrepreneurial toggle props ───────────── */
            showEntrepreneurial={showEntrepreneurial}
            onShowEntrepreneurialChange={(e) =>
              setShowEntrepreneurial(e.target.checked)
            }
                />
              </div>
            </Collapse>
          </Card>

          <SavedBadgesPanel
            badges={savedBadges}
            onApplyBadge={handleApplySavedBadge}
          />

          <SaveBadgeModal
            show={showSaveModal}
            onHide={() => setShowSaveModal(false)}
            title={badgeToSave.title}
            reqText={badgeToSave.reqText}
            onSave={async () => {
              await handleSaveBadge(badgeToSave);
              setShowSaveModal(false);
            }}
          />
        </Col>

        {/* ─── Main Panel ─────────────────────────────────────── */}
        <Col xs={12} md={9}>
          <div className="toolbar mb-3 d-flex flex-wrap align-items-center">
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
              Export Selected (CSV)
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
                  transition={false}
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
              checked={
                displayed.length > 0 && selectedRows.length === displayed.length
              }
              disabled={displayed.length === 0}
              onChange={handleSelectAll}
              style={{
                cursor: displayed.length === 0 ? "not-allowed" : "pointer",
              }}
            />
            <label
              className={`form-check-label ${
                displayed.length === 0 ? "text-muted" : ""
              }`}
              htmlFor="select-all-checkbox"
              style={{
                cursor: displayed.length === 0 ? "not-allowed" : "pointer",
              }}
            >
              {selectedRows.length === 0 ? "Select All" : "Deselect All"}
            </label>
          </div>
          <CandidatesTable
      candidates={displayed}
      anonymize={anonymize}
      onToggleStar={toggleStar}
      onViewCandidate={handleViewCandidate}
      // ← badge sorting callback
      onSortByBadge={handleBadgeClick}
      // ← map of key → label for each dynamic badge
      badgeRequirements={mapping}
      // ← these control your “Save Badge” modal
      setBadgeToSave={setBadgeToSave}
      setShowSaveModal={setShowSaveModal}
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
              <pre className="resume-skills-block">{modalCandidate.skills}</pre>
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
