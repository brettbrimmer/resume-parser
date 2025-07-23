// src/components/LocationTypeahead.jsx
import React, { useState, useMemo } from "react";
import { AsyncTypeahead } from "react-bootstrap-typeahead";
import cities from "cities.json";
import "react-bootstrap-typeahead/css/Typeahead.css";

// Pre-compute filtered list & bucket map once
const FILTERED = cities.filter((c) => c.country === "US" || c.country === "IN");
const CITY_LABELS = FILTERED.map((c) => `${c.name}, ${c.admin1}`);
const PREFIX_MAP = CITY_LABELS.reduce((map, label) => {
  const key = label.charAt(0).toLowerCase();
  (map[key] ||= []).push(label);
  return map;
}, {});

export default function LocationTypeahead({
  value,
  onChange,        // (newValue: string) => void
  isInvalid,       // boolean
  onValidate,      // (invalid: boolean) => void
  minLength = 2,   // you can override if desired
  delay = 200      // debounce ms
}) {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = (q) => {
    setLoading(true);
    const key = (q.charAt(0) || "").toLowerCase();
    const bucket = PREFIX_MAP[key] || CITY_LABELS;
    const matches = bucket
      .filter((lbl) => lbl.toLowerCase().startsWith(q.toLowerCase()))
      .slice(0, 10);
    setOptions(matches);
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
      onChange={(sel) => {
        const next = sel.length ? sel[0] : "";
        onChange(next);
        onValidate(false);
      }}
      onBlur={() => {
        if (!value.trim()) return onValidate(false);
        onValidate(!CITY_LABELS.includes(value));
      }}
      inputProps={{
        className: isInvalid ? "form-control-sm is-invalid" : "form-control-sm",
      }}
      renderMenuItemChildren={(opt) => <span>{opt}</span>}
      isClearable
    />
  );
}
