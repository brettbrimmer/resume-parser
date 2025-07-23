// App.jsx
import React from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import { Navbar, Nav, Container } from "react-bootstrap";
import { Routes, Route, Link } from "react-router-dom";
import JobsPage from "./pages/JobsPage.jsx";
import CandidatesPage from "./pages/CandidatesPage.jsx";
import logo from "./images/resumeParserLogo.png";
import "./App.css";

function App() {
  return (
    <>
      {/* ─── Top Navbar ───────────────────────────────────────────── */}
      <Navbar bg="light" expand="lg" sticky="top" className="shadow-sm">
        <Container fluid className="justify-content-start">
          <Navbar.Brand as={Link} to="/">
            <img src={logo} height="20" alt="Resume Parser Logo" />
          </Navbar.Brand>
          <Nav>
            <Nav.Link as={Link} to="/jobs" className="ms-3 pt-3">
              View Jobs
            </Nav.Link>
          </Nav>
        </Container>
      </Navbar>

      {/* ─── Page Routing ─────────────────────────────────────────── */}
      <Routes>
        <Route path="/jobs"        element={<JobsPage />} />
        <Route path="/create"      element={<JobsPage createOnly />} />
        <Route path="/jobs/:jobId" element={<CandidatesPage />} />
        <Route path="*"            element={<JobsPage />} />
      </Routes>
    </>
  );
}

export default App;