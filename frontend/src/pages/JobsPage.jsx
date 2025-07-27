// src/pages/JobsPage.jsx
import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import LocationTypeahead from "../components/LocationTypeahead";
import { Table, Button, Modal, Form } from "react-bootstrap";
import { useNavigate } from "react-router-dom";

export default function JobsPage({ createOnly = false }) {
  const [jobs, setJobs]               = useState([]);
  const [showModal, setShowModal]     = useState(createOnly);
  const [title, setTitle]             = useState("");
  const [description, setDescription] = useState("");
  // Location autocomplete state
  const [location, setLocation]           = useState("");
  const [locationError, setLocationError] = useState(false);
  // new state for description‐view modal
  const [showDescModal, setShowDescModal] = useState(false);
  const [activeJob, setActiveJob]         = useState(null);
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
      if (!location.trim() || locationError) {
      setLocationError(true);
      return;
    }
    const { data: job } = await axios.post("/api/jobs", {
      title,
      description,
      location,
    });
      setShowModal(false);
      // clear form fields
      setTitle("");
      setDescription("");
      // navigate into the new job’s candidate page
      // navigate(`/jobs/${job.id}`);
      // refresh the jobs list
      fetchJobs();
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
            <th className="col-job-location">Location</th>
            <th className="col-job-description">Description</th>
            <th className="col-job-view-description">View Description</th>
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
                  <i class="bi bi-eye"> </i>
                  View
                </Button>
              </td>
              <td className="col-job-title">{job.title}</td>
              <td className="col-job-location">{job.location}</td>
              <td className="col-job-description">
              {job.description.length > 70
                ? `${job.description.slice(0, 70)}...`
                : job.description}
            </td>
            <td className="col-job-view-description">
              <Button
                size="sm"
                variant="outline-primary"
                onClick={() => {
                  setActiveJob(job);
                  setShowDescModal(true);
                }}
              >
                <i class="bi bi-body-text"> </i>
                View Description
              </Button>
            </td>
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
            <Form.Label>View Description</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              placeholder="Describe the role, responsibilities, etc."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Location</Form.Label>
            <LocationTypeahead
              value={location}
              onChange={setLocation}
              isInvalid={locationError}
              onValidate={setLocationError}
            />
            <Form.Control.Feedback type="invalid">
              Please select a valid city (e.g. “Tempe, AZ”)
            </Form.Control.Feedback>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate}>Save</Button>
        </Modal.Footer>
      </Modal>

      {/* ——— Job Description Modal ——— */}
      <Modal
        show={showDescModal}
        onHide={() => setShowDescModal(false)}
      >
        <Modal.Header closeButton>
          <Modal.Title>{activeJob?.title}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {activeJob?.description}
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setShowDescModal(false)}
          >
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
