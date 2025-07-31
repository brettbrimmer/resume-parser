// src/components/Filters/SaveBadgeModal.jsx

import React, { useState, useEffect } from 'react';
import { Modal, Button, Form } from 'react-bootstrap';

/**
 * SaveBadgeModal
 *
 * Renders a modal dialog that allows users to save a requirement as a reusable badge.
 * Automatically pre-fills the title field if provided.
 *
 * @param {Object} props
 * @param {boolean} props.show - Controls the visibility of the modal.
 * @param {function(): void} props.onHide - Callback to close the modal.
 * @param {string} [props.title] - Optional initial title for the badge.
 * @param {string} props.reqText - Requirement text to be saved with the badge.
 * @param {function(Object): void} props.onSave - Callback invoked with the saved badge data.
 * @returns {JSX.Element} Modal component for saving a badge.
 */
export default function SaveBadgeModal({ show, onHide, title, reqText, onSave }) {
  const [badgeTitle, setBadgeTitle] = useState('');

  useEffect(() => {
    if (show) {
      setBadgeTitle(title || '');
    }
  }, [show, title]);

  const handleSave = () => {
    onSave({ title: badgeTitle, reqText });
  };

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>Save Requirement as Badge</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form.Group controlId="badgeTitleInput">
          <Form.Label>Badge Name</Form.Label>
          <Form.Control
            type="text"
            value={badgeTitle}
            onChange={(e) => setBadgeTitle(e.target.value)}
          />
        </Form.Group>
        <Form.Group controlId="badgeRequirementDisplay" className="mt-3">
          <Form.Label>Requirement</Form.Label>
          <Form.Control as="textarea" rows={3} readOnly value={reqText} />
        </Form.Group>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleSave}
          disabled={!badgeTitle.trim()}
        >
          Save Badge
        </Button>
      </Modal.Footer>
    </Modal>
  );
}