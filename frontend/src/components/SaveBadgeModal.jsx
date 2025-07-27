// src/components/Filters/SaveBadgeModal.jsx
import React, { useState, useEffect } from "react";
import { Modal, Button, Form } from "react-bootstrap";

export default function SaveBadgeModal({ show, onHide, title, reqText, onSave }) {
  const [badgeTitle, setBadgeTitle] = useState("");

  // pre-fill title when opening
  useEffect(() => {
    if (show) setBadgeTitle(title || "");
  }, [show, title]);

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>Save Requirement as Badge</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form.Group controlId="saveBadgeTitle">
          <Form.Label>Badge Name</Form.Label>
          <Form.Control
            type="text"
            value={badgeTitle}
            onChange={(e) => setBadgeTitle(e.target.value)}
          />
        </Form.Group>
        <Form.Group controlId="saveBadgeReq" className="mt-3">
          <Form.Label>Requirement</Form.Label>
          <Form.Control as="textarea" rows={3} readOnly value={reqText} />
        </Form.Group>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>Cancel</Button>
        <Button
          variant="primary"
          disabled={!badgeTitle.trim()}
          onClick={() => onSave({ title: badgeTitle, reqText })}
        >
          Save Badge
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
