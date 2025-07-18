import React from "react";
import { Table, Badge, OverlayTrigger, Tooltip } from "react-bootstrap";

export default function CandidatesTable({
  candidates,
  nicknames,
  onToggleStar,
  onViewCandidate
}) {
  return (
    <Table striped hover bordered responsive size="sm">
      <thead>
        <tr>
          <th>Star</th>
          <th>ID</th>
          <th>Filename</th>
          <th>Size</th>
          {nicknames.map((n) => (
            <th key={n}>{n}</th>
          ))}
          <th>Badges</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {candidates.map((c) => (
          <tr key={c.id}>
            <td
              style={{ textAlign: "center", cursor: "pointer" }}
              onClick={() => onToggleStar(c.id)}
            >
              {c.starred ? "★" : "☆"}
            </td>
            <td>{c.id}</td>
            <td>{c.filename}</td>
            <td>{c.size}</td>
            {nicknames.map((n) => (
              <td key={n}>
                {c.scores?.[n]?.score != null
                  ? c.scores[n].score.toFixed(1)
                  : "-"}
              </td>
            ))}
            <td>
              {Object.entries(c.scores || {}).map(([nick, entry]) => {
                const num = entry.score;
                const reason = entry.reason;
                let variant = "secondary";
                if (num <= 50) variant = "danger";
                else if (num <= 70) variant = "warning";
                else if (num <= 80) variant = "info";
                else variant = "success";

                return (
                  <OverlayTrigger
                    key={nick}
                    placement="bottom"
                    flipe={false}
                    delay={{ show: 0, hide: 0 }}
                    overlay={<Tooltip id={`tt-${nick}`}>{reason}</Tooltip>}
                  >
                    <Badge pill bg={variant} className="me-1 mb-1">
                      {nick} {num.toFixed(1)}
                    </Badge>
                  </OverlayTrigger>
                );
              })}
            </td>
            <td>
              <button
                className="btn btn-sm btn-outline-primary"
                onClick={() => onViewCandidate(c.id)}
              >
                View
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
