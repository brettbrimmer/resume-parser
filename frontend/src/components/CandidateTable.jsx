import React, { useState, useEffect } from "react";
import { Table, Badge, OverlayTrigger, Tooltip, Form } from "react-bootstrap";

export default function CandidatesTable({
  candidates,
  anonymize,
  onToggleStar,
  onViewCandidate,
  onClearBadgeSort,
  selectedRows,
  onSelectRow,
  showEntrepreneurial,
  entrepreneurialScores    
}) {

  console.log(
    "Table rendering with order:",
    candidates.map((c) => c.id)
  );
  // ── Sorting state ────────────────────────────────────────────────
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState("asc");

  // ── Build sorted list, or pass through if no sortColumn ───────────
  const sortedCandidates = sortColumn
    ? [...candidates].sort((a, b) => {
        let aVal, bVal;
        switch (sortColumn) {
          case "selected":
          // map selected → 0 (top), unselected → 1 (bottom)
          aVal = selectedRows.includes(a.id) ? 0 : 1;
          bVal = selectedRows.includes(b.id) ? 0 : 1;
          break;

          case "starred":
            // map starred→0, unstarred→1 so asc (▲) shows ★ first
            aVal = a.starred ? 0 : 1;
            bVal = b.starred ? 0 : 1;
            break;

          case "uploadDate":
            aVal = a.upload_date ? new Date(a.upload_date).getTime() : 0;
            bVal = b.upload_date ? new Date(b.upload_date).getTime() : 0;
            break;

          default:
            return 0;
        }
        return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
      })
    : candidates;
  return (
    <Table
    hover
    bordered
    responsive
    size="sm"
    className="sortable-table"
  >
      <thead>
        <tr>
          <th
          className="col-select sortable-header"
          style={{ cursor: "pointer" }}
          onClick={() => {
            if (sortColumn !== "selected") {
              setSortColumn("selected");
              setSortDirection("asc");
            } else if (sortDirection === "asc") {
              setSortDirection("desc");
            } else {
              setSortColumn(null);
            }
            onClearBadgeSort();
          }}
        >
          Select
          {sortColumn === "selected"
            ? sortDirection === "asc"
              ? " ▲"
              : " ▼"
            : ""}
        </th>
        <th>Actions</th>
          {/* <th className="col-id">ID</th> */}
          {/* <th className="col-candidate">Candidate</th> */}
          <th className="col-candidate">Candidate</th>
          {/* <th>Filename</th> */}
          {/* <th>Size</th> */}
          {/* {nicknames.map((n) => ( */}
          {/*   <th key={n}>{n}</th> */}
          {/* ))} */}
          <th>Badges</th>
          <th
            className="col-star sortable-header"
            style={{ cursor: "pointer" }}
            onClick={() => {
              if (sortColumn !== "starred") {
                setSortColumn("starred");
                setSortDirection("asc");
              } else if (sortDirection === "asc") {
                setSortDirection("desc");
              } else {
                setSortColumn(null);
              }
              onClearBadgeSort(); // ← clear badge sort whenever Star sorts
            }}
          >
            Star
            {sortColumn === "starred"
              ? sortDirection === "asc"
                ? " ▲"
                : " ▼"
              : ""}
          </th>
          <th
            className="col-upload-date sortable-header"
            style={{ cursor: "pointer" }}
            onClick={() => {
              if (sortColumn !== "uploadDate") {
                setSortColumn("uploadDate");
                setSortDirection("asc");
              } else if (sortDirection === "asc") {
                setSortDirection("desc");
              } else {
                setSortColumn(null);
              }
              onClearBadgeSort(); // ← clear badge sort whenever Date sorts
            }}
          >
            Upload Date
            {sortColumn === "uploadDate"
              ? sortDirection === "asc"
                ? " ▲"
                : " ▼"
              : ""}
          </th>
        </tr>
      </thead>
      <tbody>
        {sortedCandidates.map((c) => (
          <tr key={c.id}>
            <td
              className="col-select"
              style={{ cursor: "pointer" }}
              onClick={() => onSelectRow(c.id)}
            >
              <Form.Check
                type="checkbox"
                checked={selectedRows.includes(c.id)}
                readOnly // avoids React warning
                onClick={(e) => {
                  e.stopPropagation(); // block the cell’s onClick
                  onSelectRow(c.id); // but still toggle once
                }}
              />
            </td>
            {/*<td className="col-id">{c.id}</td> */}
            {/*<td className="col-candidate">{c.name}</td> */}
            {/* <td className="col-candidate">Candidate {c.id}</td> */}
            <td className="col-view">
              <button
                className="btn btn-sm btn-outline-primary"
                onClick={() => onViewCandidate(c.id)}
              >
                View
              </button>
            </td>
            <td
              className="col-candidate"
              style={{ cursor: "pointer" }}
              onClick={() => onSelectRow(c.id)}
            >
              {anonymize 
                ? `C${c.id.toString().padStart(7, "0")}` 
                : c.name}
            </td>
            {/* …other columns… */}
            {/* <td className="col-candidate">
                C{c.id.toString().padStart(7, '0')}
            </td> */}
            {/* <td>{c.filename}</td> */}
            {/* <td>{c.size}</td> */}
            {/*{nicknames.map((n) => (
              <td key={n}>
                {c.scores?.[n]?.score != null
                  ? c.scores[n].score.toFixed(1)
                  : "-"}
              </td>
            ))}*/}
            <td className="col-badge">
              {/* AI-powered requirement badges */}
              {Object.entries(c.scores || {}).map(([nick, entry]) => {
                const num = entry.score;
                const reason = entry.reason;
                let variant = "secondary";
                if (num <= 50) variant = "danger";
                else if (num <= 70) variant = "warning";
                else if (num <= 80) variant = "info";
                else variant = "success";

                let extraClass;
                if (num <= 50) extraClass = "badge-score-low";
                else if (num <= 70) extraClass = "badge-score-medium";
                else if (num <= 80) extraClass = "badge-score-high";
                else extraClass = "badge-score-veryhigh";

                return (
                  <OverlayTrigger
                    key={nick}
                    container={document.body}
                    transition={false}
                    placement="bottom"
                    flip={false}
                    delay={{ show: 0, hide: 0 }}
                    overlay={<Tooltip id={`tt-${nick}`}>{reason}</Tooltip>}
                  >
                    <Badge pill className={`me-1 mb-1 ${extraClass}`}>
                      {nick} {num.toFixed(1)}
                    </Badge>
                  </OverlayTrigger>
                );
              })}
              
              {/* Entrepreneurial badge */}
              {showEntrepreneurial && (() => {
                // pull apart the breakdown object
                const {
                  uniqueness = 0,
                  variety    = 0,
                  keywords   = 0,
                  total      = 0,
                } = entrepreneurialScores[c.id] || {};

                // same color logic as above, but on total
                let variant = "secondary";
                if (total <= 50) variant = "danger";
                else if (total <= 70) variant = "warning";
                else if (total <= 80) variant = "info";
                else variant = "success";

                let extraClass =
                  total <= 50 ? "badge-score-low" :
                  total <= 70 ? "badge-score-medium" :
                  total <= 80 ? "badge-score-high" :
                  "badge-score-veryhigh";

                return (
                  <OverlayTrigger
                    key={`entrepreneurial-${c.id}`}
                    transition={false}
                    container={document.body}
                    placement="bottom"
                    flip={false}
                    delay={{ show: 0, hide: 0 }}
                    overlay={
                      <Tooltip id="tt-entrepreneurial">
                        <div style={{ whiteSpace: "pre-line" }}>
                          {`• Project Uniqueness Score: ${uniqueness}/33
                            • Project Variety Score: ${variety}/33
                            • Entrepreneurial Keywords Score: ${keywords}/33`}
                        </div>
                      </Tooltip>
                    }
                  >
                    <Badge pill bg={variant} className={`me-1 mb-1 ${extraClass}`}>
                      Entrepreneurial {total.toFixed(1)}
                    </Badge>
                  </OverlayTrigger>
                );
              })()}
            </td>
            <td
              className="col-star"
              style={{ textAlign: "center", cursor: "pointer" }}
              onClick={() => onToggleStar(c.id)}
            >
              {c.starred ? "★" : "☆"}
            </td>
            <td className="col-upload-date">
              {c.upload_date
                ? new Date(c.upload_date).toLocaleDateString()
                : "—"}
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
