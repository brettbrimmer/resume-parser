import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  // --- Filter States (unchanged) ---
  const [searchTerm, setSearchTerm] = useState('');
  const [requireAll, setRequireAll] = useState(false);
  const [filters, setFilters] = useState({ AI: false, ML: false, SE: false });
  const [minGPA, setMinGPA] = useState('2.0');
  const [distance, setDistance] = useState('10');
  const [location, setLocation] = useState('Tempe, AZ');

  // --- Upload & Data States ---
  const [files, setFiles] = useState([]);
  const [candidates, setCandidates] = useState([]);

  // Fetch parsed candidates on load
  useEffect(() => {
    fetchCandidates();
  }, []);

  const fetchCandidates = async () => {
    try {
      const res = await axios.get('/api/candidates');
      setCandidates(res.data);
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
    }
  };

  // (Optional) Client‐side filtering
  const displayed = candidates.filter(c => {
    // You can hook in searchTerm, filters, GPA, etc.
    return true;
  });

  return (
    <div className="app-container">
      {/* Sidebar Filters */}
      <div className="sidebar">
        <h3>Filters</h3>
        {/* …your existing filter UI here… */}
      </div>

      {/* Main Panel */}
      <div className="main">
        {/* Upload Toolbar */}
        <div className="toolbar">
          <input type="file" multiple onChange={onFileChange} />
          <button onClick={uploadResumes}>Upload Resumes</button>
          <button onClick={() => window.alert('Export not implemented yet')}>
            Export Starred
          </button>
        </div>

        {/* Candidates Table */}
        <table className="candidates-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Filename</th>
              <th>Size (bytes)</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {displayed.map(c => (
              <tr key={c.id}>
                <td>{c.id}</td>
                <td>{c.filename}</td>
                <td>{c.size}</td>
                <td>
                  <button
                    onClick={() => window.open(`/api/candidates/${c.id}`, '_blank')}
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
