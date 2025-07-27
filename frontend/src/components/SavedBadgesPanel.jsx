// src/components/Filters/SavedBadgesPanel.jsx
import React from "react";
import { Card, Badge, OverlayTrigger, Tooltip } from "react-bootstrap";

export default function SavedBadgesPanel({ badges, onApplyBadge }) {
  if (badges.length === 0) {
    return (
      <Card className="mb-4">
        <Card.Header as="h6">Saved Badges</Card.Header>
        <Card.Body>
          <small className="text-muted">No badges saved yet.</small>
        </Card.Body>
      </Card>
    );
  }

  return (
    <Card className="mb-4">
      <Card.Header as="h6">Saved Badges</Card.Header>
      <Card.Body>
        {badges.map((b) => (
          <OverlayTrigger
            key={b.id}
            placement="top"
            overlay={<Tooltip>{b.reqText}</Tooltip>}
          >
            <Badge
              bg="secondary"
              className="me-2 mb-2"
              style={{ cursor: "pointer" }}
              onClick={() => onApplyBadge(b)}
            >
              {b.title}
            </Badge>
          </OverlayTrigger>
        ))}
      </Card.Body>
    </Card>
  );
}
