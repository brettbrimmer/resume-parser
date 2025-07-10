import React from 'react';

export default function CandidatesTable({ candidates, onToggleStar }) {
  return (
    <table className="candidates-table">
      <thead>
        <tr>
          <th>Star</th><th>Applicant ID</th>
          <th>Date</th><th>Score</th>
        </tr>
      </thead>
      <tbody>
        {candidates.map((c) => (
          <tr key={c.id}>
            <td onClick={() => onToggleStar(c.id)}>
              {c.starred ? '★' : '☆'}
            </td>
            <td>{c.id}</td>
            <td>{c.date}</td>
            <td>{c.score}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}