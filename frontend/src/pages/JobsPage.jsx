// src/pages/JobsPage.jsx
import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { Table, Button, Modal, Form } from "react-bootstrap";
import { useNavigate } from "react-router-dom";

export default function JobsPage({ createOnly = false }) {
  const [jobs, setJobs]               = useState([]);
  const [showModal, setShowModal]     = useState(createOnly);
  const [title, setTitle]             = useState("");
  const [description, setDescription] = useState("");
  const navigate                      = useNavigate();

  // wrap fetchJobs in useCallback so we can safely list it in deps
  const fetchJobs = useCallback(async () => {
    try {
      const { data } = await axios.get("/api/jobs");
      setJobs(data);
    } catch (err) {
      console.error("Failed loading jobs:", err);
    }
  }, []);

  // fetch on mount (unless createOnly)
  useEffect(() => {
    if (!createOnly) {
      fetchJobs();
    }
  }, [createOnly, fetchJobs]);

  // open modal and reset fields
  const openModal = () => {
    setTitle("");
    setDescription("");
    setShowModal(true);
  };

  async function handleCreate() {
    if (!title.trim()) return alert("Job title is required");
    try {
      const { data: job } = await axios.post("/api/jobs", {
        title,
        description,
      });
      setShowModal(false);
      // clear form fields
      setTitle("");
      setDescription("");
      // navigate into the new job’s candidate page
      navigate(`/jobs/${job.id}`);
    } catch (err) {
      console.error("Create job failed:", err);
      alert("Could not create job");
    }
  }

  return (
    <div className="container py-4">
      <div className="d-flex mb-3">
        <h2 className="me-auto">Jobs</h2>
        <Button onClick={openModal}>Create Job</Button>
      </div>

      <Table
        className="job-table"
        hover
        bordered
        size="sm"
      >
        <thead>
          <tr>
            <th className="col-job-id">Job ID</th>
            <th className="col-job-view">View</th>
            <th className="col-job-title">Job Title</th>
            <th className="col-job-description">Description</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr key={job.id}>
              <td className="col-job-id">{job.id}</td>
              <td className="col-job-view">
                <Button
                  size="sm"
                  onClick={() => navigate(`/jobs/${job.id}`)}
                >
                  View
                </Button>
              </td>
              <td className="col-job-title">{job.title}</td>
              <td className="col-job-description">{job.description}</td>
            </tr>
          ))}
        </tbody>
      </Table>

      <Modal show={showModal} onHide={() => setShowModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Create Job</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group className="mb-3">
            <Form.Label>Job Title</Form.Label>
            <Form.Control
              placeholder="Enter a short, descriptive title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Form.Group>
          <Form.Group>
            <Form.Label>Description</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              placeholder="Describe the role, responsibilities, etc."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate}>Save</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
