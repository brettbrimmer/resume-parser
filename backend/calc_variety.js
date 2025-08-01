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
  console.log('0.00');
  process.exit(0);
}

// Build TF-IDF over each project
const tfidf = new TfIdf();
projects.forEach(proj => tfidf.addDocument(proj));

// Build term→weight maps per project
const termMaps = projects.map((_, idx) =>
  tfidf
    .listTerms(idx)
    .reduce((map, { term, tfidfWeight }) => {
      map[term] = tfidfWeight;
      return map;
    }, {})
);

// Global vocabulary
const vocab = Object.keys(
  termMaps.reduce((acc, m) => {
    Object.keys(m).forEach(t => (acc[t] = true));
    return acc;
  }, {})
);

// Convert each term-map into a dense vector
const vectors = termMaps.map(m =>
  vocab.map(term => m[term] || 0)
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
