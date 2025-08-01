## Resume Parser and Candidate Filtering Platform

An intuitive, full-stack web application designed to simplify and streamline candidate management by intelligently parsing resumes, scoring candidates against custom job requirements, and enabling efficient filtering and exporting. Leveraging advanced NLP and AI-based evaluation, this platform helps recruiters objectively identify top talent while ensuring fair and unbiased candidate reviews.

## Key Features

Resume Management:
- Create a job bin with the job's description & location.
- Upload, manage, and delete candidate resumes to the job.
- Resumes are parsed on upload, then the user can view the full-page parsed resumes.
- Resumes can be anonymized to prevent bias.

Responsive UI:
- Interactive, sortable candidate tables with real-time visual feedback.
- Fully responsive design using React-Bootstrap.

Advanced Candidate Filtering:
- Full-text keyword search with flexible "match any" or "match all" logic.
- Location-based filtering with city autocomplete and adjustable distance radius.
- GPA-based filters (minimum GPA or presence of GPA).

AI-Powered Requirement Scoring:
- Generate custom AI Smart Requirement badges scored via OpenAI.
- AI Badges give reasons for their score when moused over.
- Can sort candidates by AI badge score.
- AI badges can be saved for later.
- Likewise there is a premade badge (uses NLP, not AI) that highlights entrepreneurial candidates based on project uniqueness, variety, and keyword frequency.

Efficient Selection Workflow:
- Star/unstar candidates for quick reference.
- Tri-state "Select All" checkbox for streamlined bulk actions.
- Export candidate data directly to CSV format.

Privacy and Fairness:
- Anonymization of sensitive candidate information.
- AI Smart Requirements feature inherently ignores misspellings and detects synonyms (i.e. Visual Studio Code == VS Code).

## Technology Stack

Component            Technologies
---------            ------------
Backend              FastAPI, SQLAlchemy, Uvicorn
Frontend             React, Vite, React-Bootstrap, react-bootstrap-typeahead
Resume Parser        PyMuPDF, easyocr, spacy, dateparser, python-docx
Scoring & NLP        OpenAI API, natural (provides TfIdf), compute-cosine-similarity, custom NLP, geolib
CSV Export           PapaParse / File System Access API

## Prerequisites

Ensure the following dependencies are installed on your system:

- Python >= 3.9
- Node.js >= 16.x
- npm (comes with Node.js)
- Optional: Git (for version control)

## Getting Started

# Backend Setup:

1. From the project root:
cd backend
python -m venv venv

2. Activate the virtual environment:
# Windows
venv\Scripts\activate

# macOS/Linux
source venv/bin/activate

3. Install required Python packages:
pip install -r requirements.txt

4. Launch the API server:
uvicorn main:app --reload --port 8000

API server available at: http://localhost:8000

# Frontend Setup:

1. From the project root:
cd frontend
npm install
npm run dev

2. Open the frontend app at: http://localhost:5173 (or as indicated in your terminal output)

NOTE: For AI features to work, you must add a .env file to root/backend with your OpenAI key OPEN_AI_KEY=your_key_here. The app will work without the key, you just won't be able to use AI features.

## Project Structure

.
├── backend
│   ├── uploads                       - Folder for storing uploaded resumes
│   ├── utils                         - Contains utils for tfidf/cosine similarity
│   │   └── calc_uniq.jsx             - Calculates "Project Uniqueness" score with tfidf/cosine similarity (for non-AI Entrepreneurship badge)
│   │   └── calc_variety.jsx          - Calculates "Project Variety" score with tfidf/cosine similarity (for non-AI Entrepreneurship badge)
│   ├── main.py                       - FastAPI entrypoint and API endpoints
│   ├── models.py                     - Defines database models for jobs and candidates
│   └── resume_parser                 - Resume parsing and scoring logic
│
├── frontend
│   ├── src
│   │   ├── components                - Reusable React UI components
│   │   │   └── AppCandidates.jsx     - Main candidate management interface
│   │   │   └── CandidateTable.jsx    - Candidate table with sorting and badges
│   │   │   └── FilterPanel.jsx       - Panel with candidate filtering tools
│   │   │   └── LocationTypeAhead.jsx - Location autocomplete w/ validation
│   │   │   └── SaveBadgeModal.jsx    - Modal to save AI badges
│   │   │   └── SavedBadgesPanel.jsx  - Panel displaying saved AI badges
│   │   │   └── Toolbar.jsx           - Toolbar with Upload/Export/Delete buttons
│   │   ├── pages                     - Application pages and views
│   │   │   └── CandidatesPage.jsx    - Loads candidate view for selected job
│   │   │   └── JobsPage.jsx          - Job listing and creation interface
│   │   ├── App.css                   - Custom styles
│   │   └── App.jsx                   - Main app component w/ navbar & routing
│   │   └── index.css                 - Base theme
│   │   └── main.jsx                  - App entry point with routing setup
│   ├── index.html                    - HTML entry point for the web app
│
└── resumes.db                       - Database file

Usage Guide

# Step 1: Select a Job
Click "Create Job", fill in the information, then click "Save".

# Step 2: Upload, View, and Anonymize Resumes
Click the "Upload Resumes" button then select resumes to upload (.pdf, .docx, images, .txt)
Click "View" next to a candidate to view their resume.
Click the "Anonymize Candidates" checkbox to anonymize candidate data.

# Step 3: Filter Candidates
Use the left sidebar to filter candidates by keywords, geographical distance, and GPA.

# Step 4: (AI) Smart Requirements
Enter or paste job-specific requirements to generate OpenAI-scored badges for every candidate. (Uses anonymized resumes. In production should use OpenAI Azure for added security.) The AI chooses the badge nickname based on context (3 words max).

Example prompts:

"Is entrepreneurial. A candidate who is entrepreneurial might have personal projects that are not class projects. They might have started their own business, or some other organization. They might have uncommon or rare projects (i.e. projects that are not created from common online tutorials.)"

"The candidate has strong web development skills. A candidate with strong web development skills might have built responsive websites or full-stack web applications beyond course assignments. They may demonstrate experience with modern front-end frameworks (e.g. React, Vue, or Svelte) and back-end technologies (e.g. Node.js, Django, or Flask). They might mention designing RESTful or GraphQL APIs, deploying applications to cloud platforms, or integrating authentication and database services. Strong candidates may also show UI/UX consideration or mobile responsiveness, and may reference GitHub repositories, live demos, or freelance/client work."

# Step 5: Entrepreneurial Badge
This badge uses NLP, not AI, to rate a candidate's Entrepreneurship ability. Toggle "Entrepreneurial Badge" to prioritize innovative candidate projects. (Uses NLP instead of AI.)

# Step 6: Review and Select
Star promising candidates for quick identification.
Use checkboxes and the intuitive tri-state "Select All" for bulk actions.

# Step 7: Export
Preview full resumes in-app, then export selected candidates directly to CSV for external use.

## How It Works (Application Flow)

The application launch begins when the browser loads index.html. This file includes the compiled JavaScript and CSS assets produced by Vite. As soon as the assets arrive, main.jsx mounts the root `<App />` component into the DOM and initializes React Router.

Once mounted, the `<App />` component renders the global navigation bar and configures client-side routes for job management and candidate management. React Router directs the user to the JobsPage view by default, without triggering a full page reload.

On JobsPage, the component issues a GET request to `/api/jobs` to retrieve existing hiring bins and displays them in a sidebar. When a new job is created, the page sends a POST request to `/api/jobs`. The FastAPI backend records the job in the SQLite database and returns a unique job identifier. React updates its state and inserts the new job into the table.

Selecting a job by clicking "View" enables the resume upload interface. Uploaded files are streamed to `/api/upload?jobId=<id>`. FastAPI saves each raw file to disk and invokes the resume parsing module. PDFs are handled by PyMuPDF, DOCX files by python-docx, images by easyocr, and spaCy together with dateparser extract structured sections and dates. The parsed JSON output is stored under the job identifier in the database.

Navigating to the CandidatesPage triggers a GET request to `/api/candidates?jobId=<id>`. The backend responds with an array of candidate records containing contact details, GPA, parsed sections, and any precomputed badge scores. The frontend renders these records in an interactive table that supports sorting, pagination, and real-time filtering by keyword, location radius, or GPA threshold.

When AI Smart Requirements are entered, CandidatesPage packages the anonymized resume texts and sends them to `/api/requirements?jobId=<id>`. FastAPI calls the OpenAI API to generate concise badge names, assign each candidate a match score from 0 to 100, and produce supporting evidence snippets. The response updates the table with AI-powered badges that can be hovered for rationale, sorted by score, and saved for reuse.

Separately, when resumes are uploaded, the Entrepreneurial badge (not AI) is computed locally in the browser. (This is for the badge that appears when you click the "Pre-made Badges" checkbox, this is not for the AI badges.) A TF-IDF vectorization and cosine-similarity routine evaluates each candidate’s project descriptions for uniqueness and variety. The resulting metric is mapped onto a 0–33 point entrepreneurial badge, eliminating external API dependencies for that feature.

Throughout every interaction, React hooks and context manage the application state - tracking active filters, starred candidates, anonymization settings, and badge configurations. Each user action invokes either a RESTful API endpoint or a client-side computation, and the UI re-renders automatically. This explicit, end-to-end data flow - from user input through backend processing to UI rendering - ensures the system remains maintainable, testable, and extensible.

## Next Steps

-QA testing for multiple resume formats.
-Additional fallback logic in resume_parser.py for multiple resume formats.
-Detection of additional section headers and aliases (EXTRACURRICULAR ACTIVIES, LEADERSHIP & ACTIVITIES, etc.)
-Additional synonym and misspelling detection. These are inherent in the AI Smart Requirements feature but could be added for resume parsing. Might be preferable to have AI perform this task so that the words are changed based on context, and not just string similarity. (For example a non-AI feature might correct "git" to "get".)
-The AI badge scoring and details prompts in main.py could be improved. Right now it's very good at scoring and giving details for high and low-scoring resumes, but sometimes for mid-scoring resumes the score and details don't match as well.
-Currently a newline in the "Add Requirements" box will create an additional requirement, this aspect could be removed.
-CSV export sometimes doesn't fill in all fields.
-Post-parse resume editing could be added.
-Plenty of small improvements could be added like more filters, deleting badges and saved badges, report generation, etc.
-Resume upload delay could be slightly improved if the "_Entrepreneurship" badge was removed. This badge uses NLP to assign a score to candidates based on Entrepreneurship ability, but the "AI Smart Requirements" search does it just as well, and gives reasons for its scoring. So this feature could be deprecated to improve resume upload speed. Would make a difference on large batches of resumes.