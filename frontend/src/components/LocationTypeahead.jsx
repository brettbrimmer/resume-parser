// src/components/LocationTypeahead.jsx

import React, { useState } from 'react';
import { AsyncTypeahead } from 'react-bootstrap-typeahead';
import cities from 'cities.json';
import 'react-bootstrap-typeahead/css/Typeahead.css';

/**
 * LocationTypeahead
 *
 * Provides an asynchronous city selection input with client-side filtering.
 * Optimized for performance by using prefix-based bucketing.
 *
 * @param {Object} props
 * @param {string} props.value - The currently selected city value.
 * @param {function(string): void} props.onChange - Callback to update selected city.
 * @param {boolean} props.isInvalid - Indicates whether the current input is invalid.
 * @param {function(boolean): void} props.onValidate - Callback to update validation state.
 * @param {number} [props.minLength=2] - Minimum characters required to trigger search.
 * @param {number} [props.delay=200] - Debounce delay in milliseconds for search input.
 * @returns {JSX.Element} The typeahead component.
 */

// Pre-filter valid cities and build a prefix map for efficient lookup
const US_IN_CITIES = cities.filter(({ country }) => country === 'US' || country === 'IN');
const CITY_LABELS = US_IN_CITIES.map(({ name, admin1 }) => `${name}, ${admin1}`);
const PREFIX_MAP = CITY_LABELS.reduce((acc, label) => {
  const key = label.charAt(0).toLowerCase();
  acc[key] ||= [];
  acc[key].push(label);
  return acc;
}, {});

export default function LocationTypeahead({
  value,
  onChange,
  isInvalid,
  onValidate,
  minLength = 2,
  delay = 200,
}) {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = (query) => {
    setLoading(true);
    const key = query.charAt(0).toLowerCase();
    const bucket = PREFIX_MAP[key] || CITY_LABELS;
    const results = bucket
      .filter((label) => label.toLowerCase().startsWith(query.toLowerCase()))
      .slice(0, 10);
    setOptions(results);
    setLoading(false);
  };

  return (
    <AsyncTypeahead
      id="location-typeahead"
      isLoading={loading}
      minLength={minLength}
      delay={delay}
      onSearch={handleSearch}
      options={options}
      placeholder="Enter city, state"
      flip
      selected={value ? [value] : []}
      onChange={(selected) => {
        const nextValue = selected.length ? selected[0] : '';
        onChange(nextValue);
        onValidate(false);
      }}
      onBlur={() => {
        if (!value.trim()) {
          onValidate(false);
          return;
        }
        const isValid = CITY_LABELS.includes(value);
        onValidate(!isValid);
      }}
      inputProps={{
        className: isInvalid ? 'form-control-sm is-invalid' : 'form-control-sm',
      }}
      renderMenuItemChildren={(option) => <span>{option}</span>}
      isClearable
    />
  );
}
