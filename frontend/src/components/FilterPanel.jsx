// src/components/Filters/FilterPanel.jsx
import React from "react";
import { Card, Form, Button, Spinner } from "react-bootstrap";
import { AsyncTypeahead } from "react-bootstrap-typeahead";

/**
 * FilterPanel
 *
 * Renders search, location/distance, and GPA filters.
 *
 * Props:
 * - searchTerm, onSearchChange
 * - requireAll, onRequireAllChange
 * - distance, onDistanceChange, distanceError
 * - location, onLocationChange, onLocationBlur, locationError
 * - cityOptionsAsync, cityLoading, onCitySearch
 */
export default function FilterPanel({
  searchTerm,
  onSearchChange,
  requireAll,
  onRequireAllChange,

  distance,
  onDistanceChange,
  distanceError,

  location,
  onLocationChange,
  onLocationBlur,
  locationError,

  cityOptionsAsync,
  cityLoading,
  onCitySearch,
  cityOptions,

  // GPA filter props
  gpaListed,
  onGpaListedChange,
  minGpaText,
  onMinGpaTextChange,
  gpaError,

  // the four props for the Requirements box
  reqText,
  onReqTextChange,
  isApplyingReq,
  onApplyRequirements,
  showEntrepreneurial,
  onShowEntrepreneurialChange,
}) {
  return (
    <Card className="mb-4">
      <Card.Header as="h5">Filters</Card.Header>
      <Card.Body>
        <Form>
          {/* Search */}
          <Form.Group controlId="searchResumes" className="mb-3">
            <Form.Label>Search Resumes</Form.Label>
            <Form.Control
              type="text"
              placeholder="e.g. React, Python…"
              value={searchTerm}
              onChange={onSearchChange}
            />
            <Form.Check
              type="checkbox"
              label="Require all search terms"
              className="mt-2"
              checked={requireAll}
              onChange={onRequireAllChange}
            />
          </Form.Group>

          <hr />

          {/* Location & Distance */}
          <Form.Group
            controlId="locationFilter"
            className="mb-3 d-flex flex-wrap align-items-center"
          >
            <Form.Label className="me-2 mb-0">Within</Form.Label>
            <Form.Control
              type="text"
              size="sm"
              className="w-auto me-2 mb-1"
              placeholder="Miles"
              value={distance}
              onChange={onDistanceChange}
              isInvalid={distanceError}
              style={{ maxWidth: "4rem" }}
            />
            <Form.Control.Feedback type="invalid">
              Enter a whole number
            </Form.Control.Feedback>
            <span className="mx-2">miles of</span>

            <div style={{ flex: "1 1 auto", minWidth: "10rem" }}>
              <AsyncTypeahead
                id="city-async-typeahead"
                isLoading={cityLoading}
                minLength={2}
                delay={200}
                onSearch={onCitySearch}
                options={cityOptionsAsync}
                placeholder="Enter city, state"
                flip
                selected={location ? [location] : []}
                onChange={onLocationChange}
                onBlur={onLocationBlur}
                inputProps={{
                  className: locationError
                    ? "form-control-sm is-invalid"
                    : "form-control-sm",
                }}
                renderMenuItemChildren={(opt) => <span>{opt}</span>}
              />
              {locationError && (
                <div className="invalid-feedback d-block">
                  Please select a valid city (e.g. “Tempe, AZ”)
                </div>
              )}
            </div>
          </Form.Group>

          <hr />

          {/* GPA */}
          <Form.Group controlId="gpaFilter" className="mb-3">
            <Form.Check
              type="checkbox"
              label="Has GPA Listed"
              checked={gpaListed}
              onChange={onGpaListedChange}
            />
            <div className="d-flex align-items-center mt-2">
              <Form.Label className="me-2 mb-0">Min GPA</Form.Label>
              <Form.Control
                type="text"
                placeholder="e.g. 3.5"
                value={minGpaText}
                onChange={onMinGpaTextChange}
                size="sm"
                isInvalid={gpaError}
                className="w-auto"
                style={{ maxWidth: "6rem" }}
              />
              <Form.Control.Feedback type="invalid">
                0–4, up to 2 decimals
              </Form.Control.Feedback>
            </div>
          </Form.Group>

          {/* ─── Requirements ─────────────────────────────────── */}
          <hr />
          <Form.Group controlId="requirements" className="mb-3">
            <Form.Label>Requirement</Form.Label>
            <Form.Control
              as="textarea"
              rows={5}
              placeholder="Enter a detailed requirement…"
              value={reqText}
              onChange={onReqTextChange}
            />
          </Form.Group>
          <div className="d-grid mb-3">
            <Button
              onClick={onApplyRequirements}
              disabled={isApplyingReq}
              variant={isApplyingReq ? "warning" : "primary"}
              className={isApplyingReq ? "btn-pulse" : ""}
            >
              {isApplyingReq && (
                <Spinner
                  as="span"
                  animation="border"
                  size="sm"
                  role="status"
                  aria-hidden="true"
                  className="me-2"
                />
              )}
              {isApplyingReq ? "Applying…" : "Add Requirement"}
            </Button>
          </div>

          {/* ─── Entrepreneurial Toggle ──────────────────────── */}
          <hr />
          <Form.Group controlId="entrepreneurialToggle" className="mb-3">
            <Form.Check
              type="checkbox"
              label="Premade Badges"
              checked={showEntrepreneurial}
              onChange={onShowEntrepreneurialChange}
            />
          </Form.Group>
        </Form>
      </Card.Body>
    </Card>
  );
}
