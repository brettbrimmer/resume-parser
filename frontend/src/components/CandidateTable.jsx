import * as React from "react";
import { useState } from "react";
import {
  Table,
  Badge,
  OverlayTrigger,
  Tooltip,
  Form,
  Button,
} from "react-bootstrap";
import { ThreeDots } from "react-bootstrap-icons";
import PropTypes from "prop-types";

export default function CandidatesTable({
  candidates,
  anonymize,
  onToggleStar,
  onViewCandidate,
  onSortByBadge,
  badgeRequirements = {},
  setBadgeToSave,       // ( { title, reqText } ) => void
  setShowSaveModal,     // (bool) => void
  onClearBadgeSort,
  selectedRows,
  onSelectRow,
  showEntrepreneurial,
  entrepreneurialScores,
}) {
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState("asc");

  // derive the header order from your requirements map
  // this will be ['FirstReq', 'SecondReq', ...]
  const badgeOrder = Object.keys(badgeRequirements || {})

  // now you can safely badgeOrder.map(...) below

  // compute sortedCandidates...
  const sortedCandidates = sortColumn
    ? [...candidates].sort((a, b) => {
        // your existing switch on sortColumn…
        let aVal = 0,
          bVal = 0;
        if (sortColumn === "selected") {
          aVal = selectedRows.includes(a.id) ? 0 : 1;
          bVal = selectedRows.includes(b.id) ? 0 : 1;
        } else if (sortColumn === "starred") {
          aVal = a.starred ? 0 : 1;
          bVal = b.starred ? 0 : 1;
        } else if (sortColumn === "uploadDate") {
          aVal = a.upload_date ? new Date(a.upload_date).getTime() : 0;
          bVal = b.upload_date ? new Date(b.upload_date).getTime() : 0;
        }
        return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
      })
    : candidates;

  return (
    <Table hover bordered responsive size="sm" className="sortable-table">
      <thead>
        <tr>
          {/* -- select */}
          <th
            className="col-select sortable-header"
            style={{ cursor: "pointer" }}
            onClick={() => {
              const nextCol = sortColumn !== "selected" ? "selected" : null;
              const nextDir =
                sortColumn !== "selected" ? "asc" : sortDirection === "asc" ? "desc" : "asc";
              setSortColumn(nextCol);
              setSortDirection(nextDir);
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

          {/* -- actions */}
          <th>Actions</th>

          {/* -- name */}
          <th className="col-candidate">Candidate</th>

          {/* -- badges header */}
          {/* -- single Badges header */}
          <th className="col-badge text-nowrap">
            Badges
          </th>

          {/* -- starred */}
          <th
            className="col-star sortable-header"
            style={{ cursor: "pointer" }}
            onClick={() => {
              const nextCol = sortColumn !== "starred" ? "starred" : null;
              const nextDir =
                sortColumn !== "starred" ? "asc" : sortDirection === "asc" ? "desc" : "asc";
              setSortColumn(nextCol);
              setSortDirection(nextDir);
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

          {/* -- upload date */}
          <th
            className="col-upload-date sortable-header"
            style={{ cursor: "pointer" }}
            onClick={() => {
              const nextCol = sortColumn !== "uploadDate" ? "uploadDate" : null;
              const nextDir =
                sortColumn !== "uploadDate" ? "asc" : sortDirection === "asc" ? "desc" : "asc";
              setSortColumn(nextCol);
              setSortDirection(nextDir);
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
            {/* -- checkbox */}
            <td
              className="col-select"
              style={{ cursor: "pointer" }}
              onClick={() => onSelectRow(c.id)}
            >
              <Form.Check
                type="checkbox"
                checked={selectedRows.includes(c.id)}
                readOnly
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectRow(c.id);
                }}
              />
            </td>

            {/* -- view button */}
            <td className="col-view">
              <button
                className="btn btn-sm btn-outline-primary"
                onClick={() => onViewCandidate(c.id)}
              >
                <i className="bi bi-eye"> </i>
                View
              </button>
            </td>

            {/* -- name */}
            <td
              className="col-candidate"
              style={{ cursor: "pointer" }}
              onClick={() => onSelectRow(c.id)}
            >
              {anonymize
                ? `C${c.id.toString().padStart(7, "0")}`
                : c.name}
            </td>

            {/* -- single unified badges cell */}
            <td className="col-badge text-nowrap">
              {Object.entries(c.scores || {}).map(([nick, { score, reason }]) => {
                if (score <= 0) return null;
                const extraClass =
                  score <= 50
                    ? "badge-score-low"
                    : score <= 70
                    ? "badge-score-medium"
                    : score <= 80
                    ? "badge-score-high"
                    : "badge-score-veryhigh";
                return (
                  <OverlayTrigger
                    key={nick}
                    container={document.body}
                    placement="bottom"
                    transition={false}
                    flip={false}
                    delay={{ show: 0, hide: 0 }}
                    overlay={<Tooltip id={`tt-${nick}`}>{reason}</Tooltip>}
                  >
                    <span
                      className={`badge badge-pill ${extraClass} me-1 mb-1`}
                      style={{ cursor: "pointer", padding: "0.35em 0.65em" }}
                      onClick={() => onSortByBadge(nick)}
                    >
                      {nick} {score.toFixed(1)}
                    </span>
                  </OverlayTrigger>
                );
              })}

              {showEntrepreneurial &&
                (() => {
                  const {
                    uniqueness = 0,
                    variety = 0,
                    keywords = 0,
                    total = 0,
                  } = entrepreneurialScores[c.id] || {};
                  if (total <= 0) return null;
                  const variant =
                    total <= 50
                      ? "danger"
                      : total <= 70
                      ? "warning"
                      : total <= 80
                      ? "info"
                      : "success";
                  const extraClass =
                    total <= 50
                      ? "badge-score-low"
                      : total <= 70
                      ? "badge-score-medium"
                      : total <= 80
                      ? "badge-score-high"
                      : "badge-score-veryhigh";
                  return (
                    <OverlayTrigger
                      container={document.body}
                      placement="bottom"
                      transition={false}
                      flip={false}
                      delay={{ show: 0, hide: 0 }}
                      overlay={
                        <Tooltip id="tt-entrepreneurial">
                          {`• Project Uniqueness: ${uniqueness}/33
 • Project Variety: ${variety}/33
 • Keywords: ${keywords}/33`}
                        </Tooltip>
                      }
                    >
                      <Badge
                        pill
                        bg={variant}
                        className={`me-1 mb-1 ${extraClass}`}
                      >
                        _Entrepreneurial {total.toFixed(1)}
                      </Badge>
                    </OverlayTrigger>
                  );
                })()}
              </td>

            {/* -- star */}
            <td
              className="col-star"
              style={{ textAlign: "center", cursor: "pointer" }}
              onClick={() => onToggleStar(c.id)}
            >
              {c.starred ? "★" : "☆"}
            </td>

            {/* -- upload date */}
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
  onSortByBadge: PropTypes.func.isRequired,
  badgeRequirements: PropTypes.objectOf(PropTypes.string).isRequired,
  setBadgeToSave: PropTypes.func.isRequired,
  setShowSaveModal: PropTypes.func.isRequired,
  onClearBadgeSort: PropTypes.func.isRequired,
  selectedRows: PropTypes.array.isRequired,
  onSelectRow: PropTypes.func.isRequired,
  showEntrepreneurial: PropTypes.bool.isRequired,
  entrepreneurialScores: PropTypes.object.isRequired
};