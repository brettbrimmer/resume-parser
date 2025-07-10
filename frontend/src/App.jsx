import React, { useState } from 'react';
import './App.css';      // make sure you have this file too

function App() {
  // FILTER STATES
  const [searchTerm, setSearchTerm] = useState('');
  const [requireAll, setRequireAll] = useState(false);
  const [filters, setFilters] = useState({ AI: false, ML: false, SE: false });
  const [minGPA, setMinGPA] = useState('2.0');
  const [distance, setDistance] = useState('10');
  const [location, setLocation] = useState('Tempe, AZ');

  // SAMPLE CANDIDATES
  const initialCandidates = [
    { id: 1, date: '2025-07-09', score: 85, starred: false },
    { id: 2, date: '2025-07-08', score: 92, starred: true },
    { id: 3, date: '2025-07-07', score: 78, starred: false },
  ];
  const [candidates, setCandidates] = useState(initialCandidates);

  // Toggle star on a candidate
  const toggleStar = (id) => {
    setCandidates(prev =>
      prev.map(c => (c.id === id ? { ...c, starred: !c.starred } : c))
    );
  };

  return (
    <div className="app-container">
      {/* Sidebar Filters */}
      <div className="sidebar">
        <h3>Filters</h3>

        <div>
          <label>Search Resumes:</label><br/>
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="e.g. React, Python..."
          />
        </div>

        <div>
          <input
            type="checkbox" id="requireAll"
            checked={requireAll}
            onChange={e => setRequireAll(e.target.checked)}
          />
          <label htmlFor="requireAll"> Require all search terms</label>
        </div>

        {['AI','ML','SE'].map(key => (
          <div key={key}>
            <input
              type="checkbox" id={key}
              checked={filters[key]}
              onChange={e => setFilters(f => ({ ...f, [key]: e.target.checked }))}
            />
            <label htmlFor={key}>
              {key === 'AI' ? ' AI'
                : key === 'ML' ? ' Machine Learning'
                : ' Software Engineer'}
            </label>
          </div>
        ))}

        <div>
          <label>GPA at least</label><br/>
          <select value={minGPA} onChange={e => setMinGPA(e.target.value)}>
            <option>2.0</option><option>3.0</option><option>4.0</option>
          </select>
        </div>

        <div>
          <label>Within</label><br/>
          <select value={distance} onChange={e => setDistance(e.target.value)}>
            <option>10</option><option>25</option><option>50</option><option>100</option>
          </select>
          <span> miles of </span>
          <select value={location} onChange={e => setLocation(e.target.value)}>
            <option>Tempe, AZ</option>
            <option>Phoenix, AZ</option>
            <option>Chicago, IL</option>
          </select>
        </div>
      </div>

      {/* Main Panel */}
      <div className="main">
        <div className="toolbar">
          <button onClick={() => alert('Upload clicked')}>Upload Resumes</button>
          <button onClick={() => alert('Export clicked')}>Export Starred</button>
          <button onClick={() => alert('Add clicked')}>Add Candidate</button>
        </div>

        <table className="candidates-table">
          <thead>
            <tr>
              <th>Star</th>
              <th>Applicant ID</th>
              <th>Application Date</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
            {candidates.map(c => (
              <tr key={c.id}>
                <td onClick={() => toggleStar(c.id)} style={{ cursor: 'pointer', textAlign: 'center' }}>
                  {c.starred ? '★' : '☆'}
                </td>
                <td>{c.id}</td>
                <td>{c.date}</td>
                <td>{c.score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default App;