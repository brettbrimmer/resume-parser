from pathlib import Path
from dotenv import load_dotenv
import os
import json
import shutil
import re
from datetime import datetime, timezone
from typing import List, Optional

import openai
from fastapi import FastAPI, UploadFile, File, Depends, HTTPException, Query, status
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session

import models
from database import SessionLocal, engine
from resume_parser import parse_resume


import subprocess
import tempfile
import json

def anonymize_text(
    full_text: str,
    name: Optional[str],
    email: Optional[str],
    phone: Optional[str],
    location: Optional[str],
) -> str:
    """
    Replaces personally identifiable information in the input text with a standard redaction label.

    Args:
        full_text (str): The input string to be anonymized.
        name (Optional[str]): Name to be redacted.
        email (Optional[str]): Email address to be redacted.
        phone (Optional[str]): Phone number to be redacted.
        location (Optional[str]): Location or address to be redacted.

    Returns:
        str: A redacted version of the input string with sensitive information replaced by [REDACTED].
    """
    clean = full_text or ""
    for value in (name, email, phone, location):
        if value:
            clean = re.sub(re.escape(value), "[REDACTED]", clean, flags=re.IGNORECASE)
    return clean

def calc_uniq_score(
    db: Session,
    this_candidate_id: int,
    this_projects: list[str],
) -> float:
    """
    Computes a 0–100 uniqueness score by
    TF-IDF (natural) + cosine-similarity (compute-cosine-similarity).
    """
    # 1) Load every other candidate’s projects
    rows = (
        db.query(models.Candidate.id, models.Candidate.projects)
          .filter(models.Candidate.id != this_candidate_id)
         .all()
    )
    other_projects = [r.projects or [] for r in rows]

    # 2) Dump into a temp JSON
    payload = {
        "thisProjects": this_projects,
        "otherProjects": other_projects,
    }
    with tempfile.NamedTemporaryFile(mode="w+", suffix=".json", delete=False) as tf:
        json.dump(payload, tf)
        tf.flush()
        tmp_path = tf.name

    # 3) Invoke Node helper
    try:
        result = subprocess.run(
            ["node", "utils/calc_uniq.js", tmp_path],
            capture_output=True,
            text=True,
            check=True
        )
        score = float(result.stdout.strip())
    except Exception as e:
        print("Uniqueness scoring failed:", e)
        score = 0.0

    return score

def calc_variety_score(this_projects: list[str]) -> float:
    """
    Computes a 0–100 variety score by comparing each project
    to every other in the same candidate via TF-IDF + cosine.
    """
    # 1) Dump candidate's own projects into temp JSON
    with tempfile.NamedTemporaryFile(mode="w+", suffix=".json", delete=False) as tf:
        json.dump({"projects": this_projects}, tf)
        tf.flush()
        tmp_path = tf.name

    # 2) Call Node helper
    try:
        result = subprocess.run(
            ["node", "utils/calc_variety.js", tmp_path],
            capture_output=True, text=True, check=True
        )
        score = float(result.stdout.strip())
    except Exception as e:
        print("Variety scoring failed:", e)
        score = 0.0

    return round(score, 2)

# Load environment variables from .env and configure OpenAI
env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(env_path)

# initialize OpenAI key (but don’t crash if missing)
openai.api_key = os.getenv("OPENAI_API_KEY")
has_openai_key = bool(openai.api_key)


# Initialize FastAPI application with CORS middleware
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

# expose key‐presence to frontend
@app.get("/api/config")
def get_config():
    return {"hasOpenAIKey": has_openai_key}

# Initialize database schema
models.Base.metadata.create_all(bind=engine)

# Configure and create upload directory
BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# Mount static files endpoint
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")


def get_db():
    """
    Dependency for acquiring a database session. Automatically handles cleanup.

    Yields:
        Session: SQLAlchemy database session.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def extract_text(path: str) -> str:
    """
    Extracts raw text content from a file using the resume parser.

    Args:
        path (str): Absolute path to the file to be parsed.

    Returns:
        str: Extracted text from the file, or an empty string if parsing fails.
    """
    from resume_parser import parseFileAtPathToText

    try:
        text = parseFileAtPathToText(path)
        print(f"Parsed text for {os.path.basename(path)}: {text[:60]}…")
        return text
    except Exception as e:
        print("Parser error:", e)
        return ""


@app.post("/api/upload")
async def upload_resumes(
    files: List[UploadFile] = File(...),
    job_id: int = Query(..., alias="jobId"),
    db: Session = Depends(get_db)
):
    """
    Uploads resume files, parses them, stores extracted data in the database,
    and returns metadata for each successfully saved candidate.

    Args:
        files (List[UploadFile]): List of uploaded resume files.
        job_id (int): Identifier of the job to associate candidates with.
        db (Session): Active database session provided by dependency injection.

    Returns:
        List[dict]: List of metadata dictionaries for each processed candidate, including candidate ID and file metadata.
    """
    saved_candidates = []

    for uploaded_file in files:
        destination_path = UPLOAD_DIR / uploaded_file.filename

        with open(destination_path, "wb") as file_out:
            shutil.copyfileobj(uploaded_file.file, file_out)

        parsed_data = parse_resume(str(destination_path))
        file_metadata = {
            "filename": uploaded_file.filename,
            "size": os.path.getsize(destination_path)
        }

        candidate = models.Candidate(
            filename=uploaded_file.filename,
            parsed_data=json.dumps(file_metadata),
            text=parsed_data["text"],
            name=parsed_data["name"],
            location=parsed_data["location"],
            email=parsed_data.get("email"),
            phone=parsed_data.get("phone"),
            gpa=parsed_data["gpa"],
            degrees_earned=parsed_data["degrees_earned"],
            degrees_in_progress=parsed_data["degrees_in_progress"],
            projects=parsed_data.get("projects", []),
            experience=parsed_data.get("experience", []),
            skills=parsed_data.get("skills", []),
            scores={},
            upload_date=datetime.now(timezone.utc),
            job_id=job_id,
            project_uniqueness=0,
            project_variety=0
        )

        db.add(candidate)
        db.commit()
        db.refresh(candidate)

        # now that candidate.id exists, recompute uniqueness
        uniq = calc_uniq_score(db, candidate.id, candidate.projects)
        candidate.project_uniqueness = uniq
        db.commit()
        db.refresh(candidate)

        # Compute variety across this candidate's own projects
        variety = calc_variety_score(candidate.projects or [])
        candidate.project_variety = variety
        db.commit()
        db.refresh(candidate)

        saved_candidates.append({"id": candidate.id, **file_metadata})

    return saved_candidates

from fastapi import Response


@app.get("/api/candidates")
def list_candidates(
    job_id: Optional[int] = Query(None, alias="jobId"),
    db: Session = Depends(get_db),
):
    """
    Retrieves a list of candidates, optionally filtered by job ID.

    Args:
        job_id (Optional[int]): If provided, filters candidates by associated job ID.
        db (Session): Active database session provided by dependency injection.

    Returns:
        List[dict]: List of dictionaries containing candidate details.
    """
    query = db.query(models.Candidate)

    if job_id is not None:
        query = query.filter(models.Candidate.job_id == job_id)

    candidates = query.all()

    return [
        {
            "id": candidate.id,
            **json.loads(candidate.parsed_data),
            "text": candidate.text,
            "name": candidate.name,
            "location": candidate.location,
            "email": candidate.email,
            "phone": candidate.phone,
            "gpa": candidate.gpa,
            "degrees_earned": candidate.degrees_earned,
            "degrees_in_progress": candidate.degrees_in_progress,
            "projects": candidate.projects,
            "experience": candidate.experience,
            "scores": candidate.scores,
            "skills": candidate.skills,
            "upload_date": candidate.upload_date.isoformat(),
            "project_uniqueness": candidate.project_uniqueness,
            "project_variety":   candidate.project_variety,
        }
        for candidate in candidates
    ]


class DeleteCandidatesRequest(BaseModel):
    ids: List[int]


@app.delete("/api/candidates")
async def delete_candidates(
    request: DeleteCandidatesRequest,
    db: Session = Depends(get_db),
):
    """
    Deletes candidates by their unique IDs. Also removes their associated resume files.

    Args:
        request (DeleteCandidatesRequest): Object containing a list of candidate IDs to delete.
        db (Session): Active database session provided by dependency injection.

    Returns:
        dict: Dictionary containing the list of successfully deleted candidate IDs.
    """
    deleted_ids = []

    for candidate_id in request.ids:
        candidate = db.query(models.Candidate).get(candidate_id)
        if not candidate:
            continue

        resume_path = UPLOAD_DIR / candidate.filename
        if resume_path.exists():
            resume_path.unlink()

        db.delete(candidate)
        deleted_ids.append(candidate_id)

    db.commit()
    return {"deleted": deleted_ids}


@app.get("/api/candidates/{candidate_id}")
def get_candidate(candidate_id: int, db: Session = Depends(get_db)):
    """
    Retrieves a specific candidate by ID, including all parsed resume data and metadata.

    Args:
        candidate_id (int): The unique identifier of the candidate to retrieve.
        db (Session): Active database session provided by dependency injection.

    Returns:
        dict: Dictionary of the candidate's information including resume metadata, parsed text, and structured data.

    Raises:
        HTTPException: If the candidate does not exist.
    """
    candidate = db.query(models.Candidate).get(candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    candidate_data = json.loads(candidate.parsed_data)
    candidate_data.update({
        "id": candidate.id,
        "text": candidate.text,
        "name": candidate.name,
        "location": candidate.location,
        "email": candidate.email,
        "phone": candidate.phone,
        "gpa": candidate.gpa,
        "degrees_earned": candidate.degrees_earned,
        "degrees_in_progress": candidate.degrees_in_progress,
        "projects": candidate.projects,
        "experience": candidate.experience,
        "scores": candidate.scores,
        "skills": candidate.skills,
        "resume_url": f"/uploads/{candidate.filename}",
        "upload_date": candidate.upload_date.isoformat(),
        "project_uniqueness": candidate.project_uniqueness,
        "project_variety":   candidate.project_variety,
    })

    return candidate_data
from typing import List


class JobCreate(BaseModel):
    title: str
    description: Optional[str] = None
    location: str


@app.get("/api/jobs")
def list_jobs(db: Session = Depends(get_db)):
    """
    Retrieves all job postings ordered by creation date (newest first).

    Args:
        db (Session): Active database session provided by dependency injection.

    Returns:
        List[dict]: List of job records with relevant metadata.
    """
    jobs = db.query(models.Job).order_by(models.Job.created_at.desc()).all()

    return [
        {
            "id": job.id,
            "title": job.title,
            "location": job.location,
            "description": job.description,
            "created_at": job.created_at.isoformat(),
        }
        for job in jobs
    ]


@app.post("/api/jobs")
def create_job(job: JobCreate, db: Session = Depends(get_db)):
    """
    Creates a new job posting in the database.

    Args:
        job (JobCreate): Job creation payload including title, location, and optional description.
        db (Session): Active database session provided by dependency injection.

    Returns:
        dict: Dictionary containing the newly created job record.
    """
    new_job = models.Job(
        title=job.title,
        description=job.description,
        location=job.location
    )

    db.add(new_job)
    db.commit()
    db.refresh(new_job)

    return {
        "id": new_job.id,
        "title": new_job.title,
        "location": new_job.location,
        "description": new_job.description,
        "created_at": new_job.created_at.isoformat(),
    }


# Badge schemas for serialization/deserialization
class BadgeBase(BaseModel):
    title: str
    reqText: str


class BadgeCreate(BadgeBase):
    pass


class Badge(BadgeBase):
    id: int
    created_at: datetime

    class Config:
        orm_mode = True


@app.get("/api/badges", response_model=List[Badge])
def read_badges(db: Session = Depends(get_db)):
    """
    Retrieves all badges from the database.

    Args:
        db (Session): Active database session provided by dependency injection.

    Returns:
        List[Badge]: List of badge objects conforming to the Badge response model.
    """
    return db.query(models.Badge).all()


@app.post("/api/badges", response_model=Badge, status_code=status.HTTP_201_CREATED)
def create_badge(badge: BadgeCreate, db: Session = Depends(get_db)):
    """
    Creates a new badge entry in the database.

    Args:
        badge (BadgeCreate): Badge creation payload including title and requirement text.
        db (Session): Active database session provided by dependency injection.

    Returns:
        Badge: The newly created badge record.
    """
    new_badge = models.Badge(
        title=badge.title,
        reqText=badge.reqText
    )

    db.add(new_badge)
    db.commit()
    db.refresh(new_badge)

    return new_badge

def create_badge(
    badge: BadgeCreate,
    db: Session = Depends(get_db),
):
    """
    Persists a new badge entry in the database.

    Args:
        badge (BadgeCreate): Badge creation payload including title and requirement text.
        db (Session): Active database session provided by dependency injection.

    Returns:
        models.Badge: The newly created badge ORM object.
    """
    db_badge = models.Badge(
        title=badge.title,
        reqText=badge.reqText
    )

    db.add(db_badge)
    db.commit()
    db.refresh(db_badge)

    return db_badge


class ReqModel(BaseModel):
    requirements: List[str]


async def generate_nicknames(reqs: List[str]) -> dict[str, str]:
    """
    Generates short, human-readable nicknames for a list of requirement strings using OpenAI.

    Args:
        reqs (List[str]): A list of full-text requirement strings.

    Returns:
        dict[str, str]: Mapping of full requirement text to generated nicknames.
    """
    prompt = (
        "You are a JSON generator. Return ONLY a JSON array of objects "
        "with keys text (original requirement) and nickname (as short a name as logically possible, in Title Casing).\n\n"
        "Each requirement should correspond to one line of text ended by a newline or eof. Do not split a single line of text into multiple requirements.\n\n"
        "Requirements:\n" + "\n".join(f"{i + 1}. {r}" for i, r in enumerate(reqs))
    )

    response = openai.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.0,
        max_tokens=200,
    )

    raw_output = response.choices[0].message.content
    print("🔍 raw nickname reply:", repr(raw_output))

    # Strip optional markdown code fences
    cleaned_output = re.sub(r"^```(?:json)?\n", "", raw_output)
    cleaned_output = re.sub(r"\n```$", "", cleaned_output)
    print("cleaned nickname reply:", repr(cleaned_output))

    try:
        parsed = json.loads(cleaned_output)
    except Exception as e:
        print("JSON parse failed:", e)
        return {r: r for r in reqs}

    return {item["text"]: item["nickname"] for item in parsed}


async def score_requirement(req: str, resume: str) -> float:
    """
    Scores how well a resume satisfies a single job requirement using OpenAI.

    Args:
        req (str): Job requirement.
        resume (str): Raw resume text.

    Returns:
        float: Score between 0–100 representing match quality. Returns 0.0 if evaluation fails.
    """
    prompt = (
        f"Rate 0–100 how well this resume meets the requirement:\n\n"
        f"Requirement: {req}\n\nResume text:\n{resume}\n\n"
        "Return ONLY the number."
    )

    response = openai.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.0,
        max_tokens=5,
    )

    try:
        return float(response.choices[0].message.content.strip())
    except Exception:
        return 0.0


async def explain_requirement(req: str, resume: str) -> str:
    """
    Returns factual, evidence-based bullet points explaining how a resume does or does not satisfy a requirement.

    Args:
        req (str): The job requirement being evaluated.
        resume (str): The full resume text.

    Returns:
        str: A string of 1 to 3 bullet points citing direct evidence from the resume, or reasons for lack thereof.
    """
    prompt = (
        f"""
        You are evaluating a resume against this job requirement: {req}

        Your output must contain only direct, factual evidence that clearly supports the requirement — nothing else.

        Respond with 1 to 3 bullet points (use the • symbol). Each bullet must describe a **distinct, literal piece of evidence** from the resume that directly supports the requirement.

        Do not hallucinate anything, only use what's on the resume.

        If only 1 or 2 real examples exist, output only those. **Do not create extra bullets** unless the resume gives clear, separate evidence. Do not pad with generic or tangential information. If there is a legitimate 3rd example, don't be afraid to use it.

        Each bullet must be concise (15 words or fewer), avoid interpretation or summarizing, and must not mention names, pronouns, or the word “resume”.

        If the evidence contains little or no supporting evidence, analyze the resume and respond with 1 to 3 bullet points (use the • symbol). Each bullet must describe a **distinct, literal reason** why there is a lack of evidence from this resume.

        Here is the resume: {resume}
        """
    )

    response = openai.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.0,
        max_tokens=400,
    )

    return response.choices[0].message.content.strip()

@app.post("/api/requirements")
async def process_requirements(
    body: ReqModel,
    job_id: int = Query(..., alias="jobId", description="Only score resumes for this job"),
    db: Session = Depends(get_db)
):
    # fail early if no key configured
    if not has_openai_key:
        raise HTTPException(status_code=503, detail="OpenAI API key not configured.")

    """
    Processes a list of job requirements and scores all candidates for a given job
    using OpenAI. Also generates concise explanations for each score.

    Args:
        body (ReqModel): Request body containing a list of requirement strings.
        job_id (int): Job ID to filter candidates to be scored.
        db (Session): Active database session provided by dependency injection.

    Returns:
        dict: A mapping of requirements to nicknames and a list of candidate results,
              each with scores and explanations per requirement.

    Raises:
        HTTPException: If no requirements are provided.
    """
    try:
        requirements = body.requirements
        if not requirements:
            raise HTTPException(status_code=400, detail="No requirements provided")

        nickname_map = await generate_nicknames(requirements)

        candidates = (
            db.query(models.Candidate)
              .filter(models.Candidate.job_id == job_id)
              .all()
        )

        results = []

        for candidate in candidates:
            anonymized_resume = anonymize_text(
                candidate.text,
                candidate.name,
                candidate.email,
                candidate.phone,
                candidate.location,
            )
            print(f"Anonymized resume: {anonymized_resume}")

            requirement_scores: dict[str, dict] = {}

            for requirement, nickname in nickname_map.items():
                score = await score_requirement(requirement, anonymized_resume)
                reason = await explain_requirement(requirement, anonymized_resume)

                requirement_scores[nickname] = {
                    "score": score,
                    "reason": reason
                }

                candidate.scores[nickname] = score  # persist score only

            results.append({
                "id": candidate.id,
                "results": requirement_scores
            })

        db.commit()

        return {
            "mapping": nickname_map,
            "candidates": results
        }

    except Exception as e:
        import traceback
        print("Error in /api/requirements:", e)
        traceback.print_exc()
        raise
