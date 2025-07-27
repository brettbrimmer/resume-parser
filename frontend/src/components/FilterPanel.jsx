// FilterPanel.jsx

import React, { memo } from "react";
import { Card, Form, Button, Spinner } from "react-bootstrap";
import { AsyncTypeahead } from "react-bootstrap-typeahead";
import classNames from "classnames";

/**
 * FilterPanel
 *
 * Provides user interface controls for filtering candidates by:
 *   • Search keywords (with optional “require all” constraint)
 *   • Location radius in miles from a selected city
 *   • GPA presence and minimum GPA value
 *   • Free-form requirement text
 *   • Entrepreneurial badge toggle
 *
 * @param {string} searchTerm                      Current search text
 * @param {() => void} onSearchChange              Handler for search input changes
 * @param {boolean} requireAll                     Flag to require all search terms
 * @param {() => void} onRequireAllChange          Handler to toggle requireAll
 * @param {string} distance                        Distance in miles
 * @param {() => void} onDistanceChange            Handler for distance input
 * @param {boolean} distanceError                  Flag indicating invalid distance
 * @param {string} location                        Selected city (formatted as “City, ST”)
 * @param {() => void} onLocationChange            Handler for city selection
 * @param {() => void} onLocationBlur              Handler for typeahead blur event
 * @param {boolean} locationError                  Flag indicating invalid location
 * @param {string[]} cityOptionsAsync              Asynchronous city options
 * @param {boolean} cityLoading                    Loading indicator for city search
 * @param {() => void} onCitySearch                Callback for async city search
 * @param {boolean} gpaListed                      Filter for candidates with GPA listed
 * @param {() => void} onGpaListedChange           Handler to toggle gpaListed
 * @param {string} minGpaText                      Minimum GPA input text
 * @param {() => void} onMinGpaTextChange          Handler for minimum GPA input
 * @param {boolean} gpaError                       Flag indicating invalid GPA
 * @param {string} reqText                         Free-form requirement text
 * @param {() => void} onReqTextChange             Handler for requirement text
 * @param {boolean} isApplyingReq                  Spinner state for applying requirement
 * @param {() => void} onApplyRequirements         Handler for applying requirement
 * @param {boolean} showEntrepreneurial            Toggle for entrepreneurial badge filter
 * @param {() => void} onShowEntrepreneurialChange Handler for entrepreneurial toggle
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

  gpaListed,
  onGpaListedChange,
  minGpaText,
  onMinGpaTextChange,
  gpaError,

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
          {/* Search section */}
          <Form.Group controlId="searchResumes" className="mb-3">
            <Form.Label>Search Resumes</Form.Label>
            <Form.Control
              type="text"
              placeholder="e.g. React, Python…"
              value={searchTerm}
              onChange={onSearchChange}
            />
            {/* Option to require all search terms */}
            <Form.Check
              type="checkbox"
              label="Require all search terms"
              className="mt-2"
              checked={requireAll}
              onChange={onRequireAllChange}
            />
          </Form.Group>

          <hr />

          {/* Location and distance filter */}
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
                  className: classNames("form-control-sm", {
                    "is-invalid": locationError,
                  }),
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

          {/* GPA filter */}
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

          <hr />

          {/* Add Requirement */}
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
              onClick={() => onApplyRequirements()}
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

          <hr />

          {/* Entrepreneurial badge toggle */}
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
