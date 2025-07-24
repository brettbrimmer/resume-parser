import React, { useState } from "react";
import { Table, Badge, OverlayTrigger, Tooltip, Form } from "react-bootstrap";
import PropTypes from "prop-types";

/**
 * CandidatesTable
 *
 * Displays a sortable table of candidate rows with options to:
 *   - Select candidates
 *   - Star/unstar candidates
 *   - View candidate details
 *   - Display AI requirement badges and optional entrepreneurial badge
 *
 * Props:
 *   @param {Array}   candidates             List of candidate objects
 *   @param {boolean} anonymize              Whether to anonymize candidate names
 *   @param {Function} onToggleStar          Toggle handler for star icon
 *   @param {Function} onViewCandidate       Handler to view candidate details
 *   @param {Function} onClearBadgeSort      Handler to clear badge sorting
 *   @param {Array}   selectedRows           IDs of selected candidates
 *   @param {Function} onSelectRow           Handler to select/deselect a row
 *   @param {boolean} showEntrepreneurial    Show entrepreneurial badge toggle
 *   @param {Object}  entrepreneurialScores  Entrepreneurial scores by candidate ID
 */
export default function CandidatesTable({
  candidates,
  anonymize,
  onToggleStar,
  onViewCandidate,
  onClearBadgeSort,
  selectedRows,
  onSelectRow,
  showEntrepreneurial,
  entrepreneurialScores,
}) {
  // State for sorting column and direction
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState("asc");

  // Compute sorted list if a column is selected for sorting
  const sortedCandidates = sortColumn
    ? [...candidates].sort((a, b) => {
        let aVal, bVal;
        switch (sortColumn) {
          case "selected":
            // Selected rows appear first
            aVal = selectedRows.includes(a.id) ? 0 : 1;
            bVal = selectedRows.includes(b.id) ? 0 : 1;
            break;

          case "starred":
            // Starred rows appear first
            aVal = a.starred ? 0 : 1;
            bVal = b.starred ? 0 : 1;
            break;

          case "uploadDate":
            // Newer uploads appear first
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
    <Table hover bordered responsive size="sm" className="sortable-table">
      <thead>
        <tr>
          {/* Selection column */}
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

          {/* Actions */}
          <th>Actions</th>

          {/* Candidate name */}
          <th className="col-candidate">Candidate</th>

          {/* Requirement badges */}
          <th>Badges</th>

          {/* Starred column */}
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
              onClearBadgeSort();
            }}
          >
            Star
            {sortColumn === "starred"
              ? sortDirection === "asc"
                ? " ▲"
                : " ▼"
              : ""}
          </th>

          {/* Upload date column */}
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
              onClearBadgeSort();
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
            {/* Select checkbox */}
            <td
              className="col-select"
              style={{ cursor: "pointer" }}
              onClick={() => onSelectRow(c.id)}
            >
              <Form.Check
                type="checkbox"
                checked={selectedRows.includes(c.id)}
                readOnly // avoid React warning
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectRow(c.id);
                }}
              />
            </td>

            {/* View action */}
            <td className="col-view">
              <button
                className="btn btn-sm btn-outline-primary"
                onClick={() => onViewCandidate(c.id)}
              >
                View
              </button>
            </td>

            {/* Candidate name (or anonymized ID) */}
            <td
              className="col-candidate"
              style={{ cursor: "pointer" }}
              onClick={() => onSelectRow(c.id)}
            >
              {anonymize ? `C${c.id.toString().padStart(7, "0")}` : c.name}
            </td>

            {/* Requirement badges */}
            <td className="col-badge">
              {Object.entries(c.scores || {}).map(([nick, entry]) => {
                const num = entry.score;
                const reason = entry.reason;

                let variant = "secondary";
                if (num <= 50) variant = "danger";
                else if (num <= 70) variant = "warning";
                else if (num <= 80) variant = "info";
                else variant = "success";

                let extraClass =
                  num <= 50
                    ? "badge-score-low"
                    : num <= 70
                    ? "badge-score-medium"
                    : num <= 80
                    ? "badge-score-high"
                    : "badge-score-veryhigh";

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
              {showEntrepreneurial &&
                (() => {
                  const {
                    uniqueness = 0,
                    variety = 0,
                    keywords = 0,
                    total = 0,
                  } = entrepreneurialScores[c.id] || {};

                  let variant = "secondary";
                  if (total <= 50) variant = "danger";
                  else if (total <= 70) variant = "warning";
                  else if (total <= 80) variant = "info";
                  else variant = "success";

                  let extraClass =
                    total <= 50
                      ? "badge-score-low"
                      : total <= 70
                      ? "badge-score-medium"
                      : total <= 80
                      ? "badge-score-high"
                      : "badge-score-veryhigh";

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
                      <Badge
                        pill
                        bg={variant}
                        className={`me-1 mb-1 ${extraClass}`}
                      >
                        Entrepreneurial {total.toFixed(1)}
                      </Badge>
                    </OverlayTrigger>
                  );
                })()}
            </td>

            {/* Star toggle */}
            <td
              className="col-star"
              style={{ textAlign: "center", cursor: "pointer" }}
              onClick={() => onToggleStar(c.id)}
            >
              {c.starred ? "★" : "☆"}
            </td>

            {/* Upload date */}
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

CandidatesTable.propTypes = {
  candidates: PropTypes.array.isRequired,
  anonymize: PropTypes.bool.isRequired,
  onToggleStar: PropTypes.func.isRequired,
  onViewCandidate: PropTypes.func.isRequired,
  onClearBadgeSort: PropTypes.func.isRequired,
  selectedRows: PropTypes.array.isRequired,
  onSelectRow: PropTypes.func.isRequired,
  showEntrepreneurial: PropTypes.bool.isRequired,
  entrepreneurialScores: PropTypes.object.isRequired,
};
