// src/components/Filters/SavedBadgesPanel.jsx

import React from 'react';
import { Card, Badge, OverlayTrigger, Tooltip } from 'react-bootstrap';

/**
 * SavedBadgesPanel
 *
 * Displays a list of saved requirement badges with tooltips and click handlers.
 * If no badges are present, a placeholder message is shown instead.
 *
 * @param {Object} props
 * @param {Array<{ id: string|number, title: string, reqText: string }>} props.badges - List of saved badges.
 * @param {function(Object): void} props.onApplyBadge - Callback triggered when a badge is selected.
 * @returns {JSX.Element} Rendered panel of saved badges or an empty state message.
 */
export default function SavedBadgesPanel({ badges, onApplyBadge }) {
  const renderEmptyState = () => (
    <Card className="mb-4">
      <Card.Header as="h6">Saved Badges</Card.Header>
      <Card.Body>
        <small className="text-muted">No badges saved yet.</small>
      </Card.Body>
    </Card>
  );

  const renderBadges = () => (
    <Card className="mb-4">
      <Card.Header as="h6">Saved Badges</Card.Header>
      <Card.Body>
        {badges.map((badge) => (
          <OverlayTrigger
            key={badge.id}
            placement="top"
            overlay={<Tooltip>{badge.reqText}</Tooltip>}
          >
            <Badge
              bg="secondary"
              className="me-2 mb-2"
              style={{ cursor: 'pointer' }}
              onClick={() => onApplyBadge(badge)}
            >
              {badge.title}
            </Badge>
          </OverlayTrigger>
        ))}
      </Card.Body>
    </Card>
  );

  return badges.length === 0 ? renderEmptyState() : renderBadges();
}
