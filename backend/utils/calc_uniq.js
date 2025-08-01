// calc_uniq.js
const fs = require('fs');
const { TfIdf } = require('natural');
const cosine = require('compute-cosine-similarity');

if (process.argv.length < 3) {
  console.error('Usage: node calc_uniq.js <input.json>');
  process.exit(1);
}

const { thisProjects = [], otherProjects = [] } = JSON.parse(
  fs.readFileSync(process.argv[2], 'utf8')
);

// Build one “document” per candidate
const docs = [
  thisProjects.join('\n'),
  ...otherProjects.map(projList => projList.join('\n'))
];

// Compute TF-IDF
const tfidf = new TfIdf();
docs.forEach(doc => tfidf.addDocument(doc));

// Gather term→weight maps per doc
const termMaps = docs.map((_, idx) =>
  tfidf
    .listTerms(idx)
    .reduce((map, { term, tfidf: weight }) => {
      map[term] = weight;
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

// Convert sparse maps → dense arrays
const vectors = termMaps.map(map =>
  vocab.map(term => map[term] || 0)
);

// Compute cosine sims between doc0 and each other doc
const sims =
  vectors.length > 1
    ? vectors.slice(1).map(vec => cosine(vectors[0], vec))
    : [];

const meanSim = sims.length
  ? sims.reduce((s, v) => s + v, 0) / sims.length
  : 0;

// Uniqueness = (1 − meanSim) × 100
const uniq = Math.max(0, 1 - meanSim) * 100;
console.log(uniq.toFixed(2));
