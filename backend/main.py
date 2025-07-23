# main.py
from pathlib import Path
from dotenv import load_dotenv

import os
import json
import shutil
import re

import openai
from fastapi import FastAPI, UploadFile, File, Depends, HTTPException, Query
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend import models
from backend.database import SessionLocal, engine
from backend.resume_parser import parse_resume

from datetime import datetime, timezone

from typing import List, Optional

def anonymize_text(
    full_text: str,
    name: Optional[str],
    email: Optional[str],
    phone: Optional[str],
    location: Optional[str],
) -> str:
    """
    Remove name, email, phone and location from full_text by replacing
    any exact matches (case-insensitive) with [REDACTED].
    """
    clean = full_text or ""
    for val in (name, email, phone, location):
        if not val:
            continue
        # escape special chars, redact all occurrences
        clean = re.sub(re.escape(val), "[REDACTED]", clean, flags=re.IGNORECASE)
    return clean

# ————————————————————————————————
# 0. Load env + set OpenAI key
# ————————————————————————————————
# Point to backend/.env
env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(env_path)

openai.api_key = os.getenv("OPENAI_API_KEY")
if not openai.api_key:
    raise RuntimeError(
        "OPENAI_API_KEY not found! Ensure /backend/.env exists and is git-ignored."
    )

# ————————————————————————————————
# 1. Create app + CORS
# ————————————————————————————————
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)


# ————————————————————————————————
# 1. DB setup & static‐files mount
# ————————————————————————————————
models.Base.metadata.create_all(bind=engine)

# ensure uploads lives under backend/uploads
BASE_DIR   = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# serve those files at /uploads/…
app.mount(
    "/uploads",
    StaticFiles(directory=str(UPLOAD_DIR)),
    name="uploads",
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ————————————————————————————————
# 2. Text extraction helper
# ————————————————————————————————
def extract_text(path: str) -> str:
    from backend.resume_parser import parseFileAtPathToText
    try:
        text = parseFileAtPathToText(path)
        print(f"Parsed text for {os.path.basename(path)}: {text[:60]}…")
        return text
    except Exception as e:
        print("Parser error:", e)
        return ""

# ————————————————————————————————
# 3. Upload endpoint
# ————————————————————————————————
@app.post("/api/upload")
async def upload(
    files: list[UploadFile] = File(...),
    jobId: int = Query(..., alias="jobId"),
    db: Session = Depends(get_db)
):
    saved = []
    for f in files:
        # save into backend/uploads/
        path = UPLOAD_DIR / f.filename
        with open(path, "wb") as out:
            shutil.copyfileobj(f.file, out)

        # use parse_resume to get text + structured fields
        parsed = parse_resume(str(path))
        meta   = { "filename": f.filename, "size": os.path.getsize(path) }

        candidate = models.Candidate(
            filename             = f.filename,
            parsed_data          = json.dumps(meta),
            text                 = parsed["text"],
            name                 = parsed["name"],
            location             = parsed["location"],
            email                = parsed.get("email"),
            phone                = parsed.get("phone"),
            gpa                  = parsed["gpa"],
            degrees_earned       = parsed["degrees_earned"],
            degrees_in_progress  = parsed["degrees_in_progress"],
            projects             = parsed.get("projects", []),
            experience           = parsed.get("experience", []),
            scores               = {},
            skills              = parsed.get("skills", []),
            upload_date          = datetime.now(timezone.utc),
            job_id               = jobId
        )
        db.add(candidate)
        db.commit()
        db.refresh(candidate)
        saved.append({"id": candidate.id, **meta})

    return saved

# ————————————————————————————————
# 4. List & get endpoints
# ————————————————————————————————
@app.get("/api/candidates")
def list_candidates(
    jobId: Optional[int] = Query(None, alias="jobId"),
    db: Session = Depends(get_db),
):
    # start with all candidates
    q = db.query(models.Candidate)

    # if the client passed ?jobId=…, filter on that column
    if jobId is not None:
        q = q.filter(models.Candidate.job_id == jobId)

    rows = q.all()
    return [
        {
            "id":                   r.id,
            **json.loads(r.parsed_data),
            "text":                 r.text,
            "name":                 r.name,
            "location":             r.location,
            "email":                r.email,
            "phone":                r.phone,
            "gpa":                  r.gpa,
            "degrees_earned":       r.degrees_earned,
            "degrees_in_progress":  r.degrees_in_progress,
            "projects":             r.projects,
            "experience":           r.experience,
            "scores":               r.scores,
            "skills":               r.skills,
            "upload_date":          r.upload_date.isoformat(),
        }
        for r in rows
    ]

class DeleteCandidatesRequest(BaseModel):
    ids: List[int]

@app.delete("/api/candidates")
async def delete_candidates(
    req: DeleteCandidatesRequest,
    db: Session = Depends(get_db),
):
    deleted = []
    for cid in req.ids:
        # 1) look up the candidate row
        cand = db.query(models.Candidate).get(cid)
        if not cand:
            continue

        # 2) delete the actual file by its real filename
        file_path = UPLOAD_DIR / cand.filename
        if file_path.exists():
            file_path.unlink()

        # 3) delete the DB row
        db.delete(cand)
        deleted.append(cid)

    # 4) commit everything
    db.commit()
    return {"deleted": deleted}

@app.get("/api/candidates/{cand_id}")
def get_candidate(cand_id: int, db: Session = Depends(get_db)):
    c = db.query(models.Candidate).get(cand_id)
    if not c:
        raise HTTPException(404, "Not found")
    # start with your filename+size meta
    data = { **json.loads(c.parsed_data) }

    # add every field you need
    data.update({
      "id":                   c.id,
      "text":                 c.text,
      "name":                 c.name,
      "location":             c.location,
      "email":                c.email,
      "phone":                c.phone,
      "gpa":                  c.gpa,
      "degrees_earned":       c.degrees_earned,
      "degrees_in_progress":  c.degrees_in_progress,
      "projects":             c.projects,
      "experience":           c.experience,
      "scores":               c.scores,
      "skills":               c.skills,
      "resume_url":           f"/uploads/{c.filename}",
      "upload_date":          c.upload_date.isoformat()
    })

    return data

# ──────────────────────────────────────────────────────────────────
# Jobs endpoints
# ──────────────────────────────────────────────────────────────────

class JobCreate(BaseModel):
    title: str
    description: Optional[str] = None

@app.get("/api/jobs")
def list_jobs(db: Session = Depends(get_db)):
    rows = db.query(models.Job).order_by(models.Job.created_at.desc()).all()
    return [
        {
            "id":          j.id,
            "title":       j.title,
            "description": j.description,
            "created_at":  j.created_at.isoformat(),
        }
        for j in rows
    ]
@app.post("/api/jobs")
def create_job(job: JobCreate, db: Session = Depends(get_db)):
    new_job = models.Job(
        title       = job.title,
        description = job.description,
    )
    db.add(new_job)
    db.commit()
    db.refresh(new_job)
    return {
        "id":          new_job.id,
        "title":       new_job.title,
        "description": new_job.description,
        "created_at":  new_job.created_at.isoformat(),
    }

# ————————————————————————————————
# 5. OpenAI scoring flow
# ————————————————————————————————
class ReqModel(BaseModel):
    requirements: list[str]

import re

async def generate_nicknames(reqs: list[str]) -> dict[str, str]:
    prompt = (
        "You are a JSON generator. Return ONLY a JSON array of objects "
        "with keys text (original requirement) and nickname (as short a name as logically possible, in Title Casing).\n\n"
        "Each requirement should correspond to one line of text ended by a newline or eof. Do not split a single line of text into multiple requirements.\n\n"
        "Requirements:\n" + "\n".join(f"{i+1}. {r}" for i, r in enumerate(reqs))
    )
    resp = openai.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role":"user", "content": prompt}],
        temperature=0.0,
        max_tokens=200,
    )

    raw = resp.choices[0].message.content
    print("🔍 raw nickname reply:", repr(raw))

    # strip markdown code fences if present
    # this will turn ```json\n[ ... ]\n``` into just the JSON array
    cleaned = re.sub(r"^```(?:json)?\n", "", raw)
    cleaned = re.sub(r"\n```$", "", cleaned)
    print("🧹 cleaned nickname reply:", repr(cleaned))

    try:
        arr = json.loads(cleaned)
    except Exception as e:
        print("❗ JSON parse failed:", e)
        # fallback: map each requirement to itself
        return {r: r for r in reqs}

    return {item["text"]: item["nickname"] for item in arr}


async def score_requirement(req: str, resume: str) -> float:
    prompt = (
        f"Rate 0–100 how well this resume meets the requirement:\n\n"
        f"Requirement: {req}\n\nResume text:\n{resume}\n\n"
        "Return ONLY the number."
    )
    resp = openai.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role":"user", "content": prompt}],
        temperature=0.0,
        max_tokens=5,
    )
    try:
        return float(resp.choices[0].message.content.strip())
    except Exception:
        return 0.0
    
# ─── New: return a one‐sentence justification from OpenAI ────────────
async def explain_requirement(req: str, resume: str) -> str:
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

    # If the resume contains **no clear supporting evidence at all**, reply with exactly:
    #    **No relevant evidence found.**

    # if("Brett" in resume):
    # print(f"The resume provided was this one: {resume}")

    resp = openai.chat.completions.create(
        model="gpt-4o-mini",
        # model="gpt-4",
        messages=[{"role":"user", "content": prompt}],
        temperature=0.0,
        max_tokens=400,
    )

    return resp.choices[0].message.content.strip()

@app.post("/api/requirements")
async def process_requirements(
    body: ReqModel,
    db: Session = Depends(get_db)
):
    try:
        reqs = body.requirements
        if not reqs:
            raise HTTPException(400, "No requirements provided")

        mapping = await generate_nicknames(reqs)

        rows = db.query(models.Candidate).all()

        # build output list with both score & reason for each req
        output = []
        for c in rows:
            # redact PII using the parsed model fields
            anonymizedResume = anonymize_text(
                c.text,
                c.name,
                c.email,
                c.phone,
                c.location,
            )
            print(f"Anonymized resume: {anonymizedResume}")
            per_req: dict[str, dict] = {}
            for jobRequirement, nick in mapping.items():
                score  = await score_requirement(jobRequirement, anonymizedResume)
                reason = await explain_requirement(jobRequirement, anonymizedResume)

                per_req[nick] = { "score": score, "reason": reason }
                c.scores[nick] = score    # still persist numeric score only

            output.append({ "id": c.id, "results": per_req })

        db.commit()
        return {
            "mapping": mapping,
            "candidates": output
        }

    except Exception as e:
        import traceback
        print("Error in /api/requirements:", e)
        traceback.print_exc()
        raise
