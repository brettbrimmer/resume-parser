// calc_variety.js
const fs = require('fs');
const { TfIdf } = require('natural');
const cosine = require('compute-cosine-similarity');

if (process.argv.length < 3) {
  console.error('Usage: node calc_variety.js <input.json>');
  process.exit(1);
}

// Load & sanitize input
const raw = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const projects = Array.isArray(raw.projects)
  ? raw.projects.filter(p => typeof p === 'string' && p.trim().length > 0)
  : [];

// If 0 or 1 valid project → no variety
if (projects.length <= 1) {
  process.exit(0);
}

// Smoothed tf-idf

// raw term-frequency map per project
function tokenize(text) {
  return text.toLowerCase().match(/\b\w+\b/g) || [];
}
const termMaps = projects.map(proj => {
  const m = {};
  tokenize(proj).forEach(t => {
    m[t] = (m[t] || 0) + 1;
  });
  return m;
});

// document frequency per term
const df = {};
termMaps.forEach(m =>
  Object.keys(m).forEach(t => { df[t] = (df[t] || 0) + 1; })
);
const vocab = Object.keys(df);
const N = termMaps.length;

// smoothed idf and build TF-IDF vectors
// idf(t) = log(1 + N/df(t))
const idf = {};
vocab.forEach(t => {
  idf[t] = Math.log(1 + N / df[t]);
});
const vectors = termMaps.map(m =>
  vocab.map(t => (m[t] || 0) * idf[t])
);

// Compute all pairwise cosine similarities, skipping any NaN
let sumSim = 0;
let count = 0;
for (let i = 0; i < vectors.length; i++) {
  for (let j = i + 1; j < vectors.length; j++) {
    const sim = cosine(vectors[i], vectors[j]);
    if (Number.isFinite(sim)) {
      sumSim += sim;
      count++;
    }
  }
}

// Compute variety = (1 − meanSim) × 100, guarding against NaN
const meanSim = count ? sumSim / count : 0;
const safeMean = Number.isFinite(meanSim) ? meanSim : 0;
const variety = Math.max(0, 1 - safeMean) * 100;

// Print final score with two decimals
console.log(variety.toFixed(2));