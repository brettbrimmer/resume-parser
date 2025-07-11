import os, json, shutil
from fastapi import FastAPI, UploadFile, File, Depends, HTTPException
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from backend import models
from backend.database import SessionLocal
from backend.database import engine


# Ensure DB + upload folder exist
models.Base.metadata.create_all(bind=engine)
os.makedirs("uploads", exist_ok=True)

app = FastAPI()
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.post("/api/upload")
async def upload(files: list[UploadFile] = File(...), db: Session = Depends(get_db)):
    saved = []
    for f in files:
        path = f"uploads/{f.filename}"
        with open(path, "wb") as out:
            shutil.copyfileobj(f.file, out)
        # Dummy parse: we just record filename + size
        parsed = {"filename": f.filename, "size": os.path.getsize(path)}
        candidate = models.Candidate(
            filename=f.filename,
            parsed_data=json.dumps(parsed)
        )
        db.add(candidate)
        db.commit()
        db.refresh(candidate)
        saved.append({"id": candidate.id, **parsed})
    return saved

@app.get("/api/candidates")
def list_candidates(db: Session = Depends(get_db)):
    rows = db.query(models.Candidate).all()
    return [
        {"id": c.id, **json.loads(c.parsed_data)}
        for c in rows
    ]

@app.get("/api/candidates/{cand_id}")
def get_candidate(cand_id: int, db: Session = Depends(get_db)):
    c = db.query(models.Candidate).get(cand_id)
    if not c:
        raise HTTPException(404, "Not found")
    data = json.loads(c.parsed_data)
    data["resume_url"] = f"/uploads/{c.filename}"
    return data
