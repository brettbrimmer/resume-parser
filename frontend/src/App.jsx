import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  // ─── Filter States ──────────────────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState('');
  const [requireAll, setRequireAll] = useState(false);
  const [filters, setFilters] = useState({ AI: false, ML: false, SE: false });
  const [minGPA, setMinGPA] = useState('2.0');
  const [distance, setDistance] = useState('10');
  const [location, setLocation] = useState('Tempe, AZ');

  // ─── Upload & Data States ───────────────────────────────────────────────────
  const [files, setFiles] = useState([]);
  const [candidates, setCandidates] = useState([]);

  // Fetch parsed candidates on mount
  useEffect(() => {
    fetchCandidates();
  }, []);

  const fetchCandidates = async () => {
    try {
      const res = await axios.get('/api/candidates');
      // Initialize `starred` flag on each record
      setCandidates(res.data.map(c => ({ ...c, starred: false })));
    } catch (err) {
      console.error('Error fetching candidates:', err);
    }
  };

  // File selection handler
  const onFileChange = e => setFiles(e.target.files);

  // Upload to backend, then refresh list
  const uploadResumes = async () => {
    if (!files.length) return alert('Select at least one file!');
    const form = new FormData();
    Array.from(files).forEach(f => form.append('files', f));

    try {
      await axios.post('/api/upload', form);
      fetchCandidates();
    } catch (err) {
      console.error('Upload failed:', err);
      alert('Upload failed. Check console.');
    }
  };

  // Toggle star on a candidate
  const toggleStar = id => {
    setCandidates(prev =>
      prev.map(c => (c.id === id ? { ...c, starred: !c.starred } : c))
    );
  };

  // Client-side filtering (basic example)
  const displayed = candidates.filter(c => {
    // 1) Search term on filename
    if (searchTerm) {
      const match = c.filename.toLowerCase().includes(searchTerm.toLowerCase());
      if (!match) return false;
    }

    // 2) Specialization filters (stubbed as always true for now)
    if (requireAll && Object.values(filters).some(v => v)) {
      // TODO: implement “must match all checked filters”
    } else if (Object.values(filters).some(v => v)) {
      // TODO: implement “match any checked filter”
    }

    // 3) GPA, distance, location filters would go here

    return true;
  });

  return (
    <div className="app-container">
      {/* ─── Sidebar Filters ───────────────────────────────────────────────────── */}
      <div className="sidebar">
        <h3>Filters</h3>

        <div>
          <label>Search Resumes:</label><br />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="e.g. React, Python..."
          />
        </div>

        <div>
          <input
            type="checkbox"
            id="requireAll"
            checked={requireAll}
            onChange={e => setRequireAll(e.target.checked)}
          />
          <label htmlFor="requireAll"> Require all search terms</label>
        </div>

        {['AI', 'ML', 'SE'].map(key => (
          <div key={key}>
            <input
              type="checkbox"
              id={key}
              checked={filters[key]}
              onChange={e => setFilters(f => ({ ...f, [key]: e.target.checked }))}
            />
            <label htmlFor={key}>
              {key === 'AI'
                ? ' AI'
                : key === 'ML'
                ? ' Machine Learning'
                : ' Software Engineer'}
            </label>
          </div>
        ))}

        <div>
          <label>GPA at least</label><br />
          <select value={minGPA} onChange={e => setMinGPA(e.target.value)}>
            <option>2.0</option>
            <option>3.0</option>
            <option>4.0</option>
          </select>
        </div>

        <div>
          <label>Within</label><br />
          <select value={distance} onChange={e => setDistance(e.target.value)}>
            <option>10</option>
            <option>25</option>
            <option>50</option>
            <option>100</option>
          </select>
          <span> miles of </span>
          <select value={location} onChange={e => setLocation(e.target.value)}>
            <option>Tempe, AZ</option>
            <option>Phoenix, AZ</option>
            <option>Chicago, IL</option>
          </select>
        </div>
      </div>

      {/* ─── Main Panel ─────────────────────────────────────────────────────────── */}
      <div className="main">
        <div className="toolbar">
          <input type="file" multiple onChange={onFileChange} />
          <button onClick={uploadResumes}>Upload Resumes</button>
          <button
            onClick={() => {
              const starred = candidates.filter(c => c.starred);
              alert(`Exporting ${starred.length} candidates`);
            }}
          >
            Export Starred
          </button>
        </div>

        <table className="candidates-table">
          <thead>
            <tr>
              <th>Star</th>
              <th>ID</th>
              <th>Filename</th>
              <th>Size (bytes)</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {displayed.map(c => (
              <tr key={c.id}>
                <td
                  onClick={() => toggleStar(c.id)}
                  style={{ cursor: 'pointer', textAlign: 'center' }}
                >
                  {c.starred ? '★' : '☆'}
                </td>
                <td>{c.id}</td>
                <td>{c.filename}</td>
                <td>{c.size}</td>
                <td>
                  <button
                    onClick={() =>
                      window.open(`/api/candidates/${c.id}`, '_blank')
                    }
                  >
                    View Candidate
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default App;
