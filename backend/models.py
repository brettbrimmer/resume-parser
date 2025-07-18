from sqlalchemy import Column, Integer, String, Text, JSON, Float
from backend.database import Base

class Candidate(Base):
    __tablename__ = "candidates"

    id          = Column(Integer, primary_key=True, index=True)
    filename    = Column(String, index=True)
    parsed_data = Column(Text)            # existing: filename + size JSON

    # NEW: store the extracted raw text of the resume
    text        = Column(Text, nullable=True)

    # NEW: store parsed GPA (0.0–4.0)
    gpa         = Column(Float, nullable=True)

    # NEW: structured fields from resume_parser
    name                  = Column(String, nullable=True)   # person’s full name
    location              = Column(String, nullable=True)   # city, state
    degrees_earned        = Column(JSON, nullable=True)     # list of [line, date]
    degrees_in_progress   = Column(JSON, nullable=True)     # list of [line, date]

    # NEW: store requirement-to-score map, e.g. {"Python": 87.5, "AWS": 42.0}
    scores      = Column(JSON, nullable=False, default={})
