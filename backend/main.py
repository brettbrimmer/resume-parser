from pathlib import Path
from dotenv import load_dotenv

import os
import json
import shutil
import re

import openai
from fastapi import FastAPI, UploadFile, File, Depends, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend import models
from backend.database import SessionLocal, engine

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
os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

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
    db: Session = Depends(get_db)
):
    saved = []
    for f in files:
        path = f"uploads/{f.filename}"
        with open(path, "wb") as out:
            shutil.copyfileobj(f.file, out)

        full_text = extract_text(path)
        meta = { "filename": f.filename, "size": os.path.getsize(path) }
        candidate = models.Candidate(
            filename=f.filename,
            parsed_data=json.dumps(meta),
            text=full_text,
            scores={}
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
def list_candidates(db: Session = Depends(get_db)):
    rows = db.query(models.Candidate).all()
    return [
        {
            "id":   r.id,
            **json.loads(r.parsed_data),  # filename + size
            "text": r.text               # <-- include parsed resume body
        }
        for r in rows
    ]

@app.get("/api/candidates/{cand_id}")
def get_candidate(cand_id: int, db: Session = Depends(get_db)):
    c = db.query(models.Candidate).get(cand_id)
    if not c:
        raise HTTPException(404, "Not found")
    data = json.loads(c.parsed_data)
    data["resume_url"] = f"/uploads/{c.filename}"
    return data

# ————————————————————————————————
# 5. OpenAI scoring flow
# ————————————————————————————————
class ReqModel(BaseModel):
    requirements: list[str]

import re

async def generate_nicknames(reqs: list[str]) -> dict[str, str]:
    prompt = (
        "You are a JSON generator. Return ONLY a JSON array of objects "
        "with keys text (original requirement) and nickname (short name).\n\n"
        "Each requirement should correspond to one line of text. Do not split a single line of text into multiple requirements.\n\n"
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

        Respond with 1 to 3 bullet points. Each bullet must describe a **distinct, literal piece of evidence** from the resume that directly supports the requirement.

        If only 1 or 2 real examples exist, output only those. **Do not create extra bullets** unless the resume gives clear, separate evidence. Do not pad with generic or tangential information.

        Each bullet must be concise (15 words or fewer), avoid interpretation or summarizing, and must not mention names, pronouns, or the word “resume”.

        If the resume contains **no clear supporting evidence at all**, reply with exactly:
        **No relevant evidence found.**

        Here is the resume: {resume}
        """
    )

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
            per_req: dict[str, dict] = {}
            for original, nick in mapping.items():
                score  = await score_requirement(original, c.text or "")
                reason = await explain_requirement(original, c.text or "")

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
