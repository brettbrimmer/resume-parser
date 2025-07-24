Features
Upload and delete multiple resumes
Full-text search with “match any” or “match all” toggle
Location filter using city autocomplete + distance slider
GPA presence and minimum GPA filters
Custom requirement badges powered by OpenAI scoring
Entrepreneurial badge based on project uniqueness, variety, and keyword hits
Star / unstar and tri-state “Select All” checkbox
Responsive, sortable candidate table with instant visual feedback
Export selected candidates to CSV
Anonymize candidate data for fair review
Full-page resume preview in a Bootstrap modal

Tech Stack
Backend: FastAPI, SQLAlchemy, Uvicorn
Frontend: React, Vite, React-Bootstrap, react-bootstrap-typeahead
Scoring & Parsing: string-similarity, custom NLP logic, geolib
CSV Export: PapaParse or File System Access API (fallback to Blob download)

Prerequisites
Node.js ≥16.x and npm
Python ≥3.9
(Optional) Git for version control

Getting Started

Backend:

cd backend
python -m venv venv
# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate
pip install -r requirements.txt

# Launch API server
uvicorn backend.main:app --reload --port 8000

# Frontend

cd frontend
npm install
npm run dev

Project Structure
backend/ – FastAPI app, models, routers, database migrations

frontend/

src/components/ – modular UI pieces (Filters, Toolbar, ResumeModal)

src/pages/AppCandidates.jsx – main page orchestrating state and layout

src/utils/ – scoring, text-distillation, geo-helpers

src/styles/ – global and component-scoped CSS

cities.json – US/India city list for distance filtering

Usage Overview
Select a Job – the header displays the job title and location.

Filter Candidates – use the sidebar to narrow by skills, GPA, location, and distance.

Apply Requirements – paste your job requirements and click “Add Requirement.”

Toggle Entrepreneurial – enable to surface candidates with entrepreneurial experience.

Star & Select – click stars or checkboxes; tri-state “Select All” adapts to 0/some/all.

View & Export – preview resumes in the modal, then export your top picks to CSV.








To run:

In terminal, cd to 'frontend'
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
npm install
npm run dev
Go to http://localhost:5173 or whatever link it gives you in the terminal.

In terminal, cd to 'backend'

cd backend
python -m venv venv
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
venv\Scripts\activate
pip install -r requirements.txt
cd .. // return to root
uvicorn backend.main:app --reload --port 8000
