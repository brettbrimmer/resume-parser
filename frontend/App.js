import React, { useState } from 'react';
import './App.css'; // Basic styles (you can create this file)

function App() {
  // FILTER STATES
  const [searchTerm, setSearchTerm] = useState('');
  const [requireAll, setRequireAll] = useState(false);
  const [filters, setFilters] = useState({
    AI: false,
    ML: false,
    SE: false,
  });
  const [minGPA, setMinGPA] = useState('2.0');
  const [distance, setDistance] = useState('10');
  const [location, setLocation] = useState('Tempe, AZ');

  // SAMPLE CANDIDATES DATA
  const initialCandidates = [
    { id: 1, date: '2025-07-09', score: 85, starred: false },
    { id: 2, date: '2025-07-08', score: 92, starred: true },
    { id: 3, date: '2025-07-07', score: 78, starred: false },
    // add more as needed
  ];
  const [candidates, setCandidates] = useState(initialCandidates);

  // Toggle star on a candidate
  const toggleStar = (id) => {
    setCandidates((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, starred: !c.starred } : c
      )
    );
  };

  return (
    <div className="app-container" style={{ display: 'flex', height: '100vh' }}>
      {/* SIDEBAR FILTER PANEL */}
      <div
        className="sidebar"
        style={{
          width: 280,
          padding: 16,
          borderRight: '1px solid #ddd',
          boxSizing: 'border-box',
        }}
      >
        <h3>Filters</h3>

        {/* Search Box */}
        <div style={{ marginBottom: 12 }}>
          <label>Search Resumes:</label><br />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="e.g. React, Python..."
            style={{ width: '100%' }}
          />
        </div>

        {/* Require All Terms Toggle */}
        <div style={{ marginBottom: 12 }}>
          <input
            type="checkbox"
            checked={requireAll}
            onChange={(e) => setRequireAll(e.target.checked)}
            id="requireAll"
          />
          <label htmlFor="requireAll"> Require all search terms</label>
        </div>

        {/* Topic Checkboxes */}
        <div style={{ marginBottom: 12 }}>
          <div>
            <input
              type="checkbox"
              id="ai"
              checked={filters.AI}
              onChange={(e) =>
                setFilters({ ...filters, AI: e.target.checked })
              }
            />
            <label htmlFor="ai"> AI</label>
          </div>
          <div>
            <input
              type="checkbox"
              id="ml"
              checked={filters.ML}
              onChange={(e) =>
                setFilters({ ...filters, ML: e.target.checked })
              }
            />
            <label htmlFor="ml"> Machine Learning</label>
          </div>
          <div>
            <input
              type="checkbox"
              id="se"
              checked={filters.SE}
              onChange={(e) =>
                setFilters({ ...filters, SE: e.target.checked })
              }
            />
            <label htmlFor="se"> Software Engineer</label>
          </div>
        </div>

        {/* GPA Filter */}
        <div style={{ marginBottom: 12 }}>
          <label>GPA at least</label><br />
          <select
            value={minGPA}
            onChange={(e) => setMinGPA(e.target.value)}
          >
            <option>2.0</option>
            <option>3.0</option>
            <option>4.0</option>
          </select>
        </div>

        {/* Distance & Location Filter */}
        <div style={{ marginBottom: 12 }}>
          <label>Within</label><br />
          <select
            value={distance}
            onChange={(e) => setDistance(e.target.value)}
          >
            <option>10</option>
            <option>25</option>
            <option>50</option>
            <option>100</option>
          </select>
          <span> miles of </span>
          <select
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          >
            <option>Tempe, AZ</option>
            <option>Phoenix, AZ</option>
            <option>Chicago, IL</option>
            {/* Add your company locations here */}
          </select>
        </div>
      </div>

      {/* MAIN PANEL: TOOLBAR + TABLE */}
      <div
        className="main"
        style={{
          flex: 1,
          padding: 16,
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* TOOLBAR */}
        <div
          className="toolbar"
          style={{
            marginBottom: 16,
            display: 'flex',
            gap: 8,
          }}
        >
          <button onClick={() => alert('Upload clicked')}>
            Upload Resumes
          </button>
          <button onClick={() => alert('Export clicked')}>
            Export Starred
          </button>
          <button onClick={() => alert('Add Candidate clicked')}>
            Add Candidate
          </button>
        </div>

        {/* TABLE */}
        <table
          className="candidates-table"
          style={{
            width: '100%',
            borderCollapse: 'collapse',
          }}
        >
          <thead>
            <tr>
              <th>Star</th>
              <th>Applicant ID</th>
              <th>Application Date</th>
              <th>Score</th>
              {/* add more headers here */}
            </tr>
          </thead>
          <tbody>
            {candidates.map((c) => (
              <tr key={c.id}>
                <td
                  style={{ textAlign: 'center', cursor: 'pointer' }}
                  onClick={() => toggleStar(c.id)}
                >
                  {c.starred ? '★' : '☆'}
                </td>
                <td>{c.id}</td>
                <td>{c.date}</td>
                <td>{c.score}</td>
                {/* more columns here */}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default App;