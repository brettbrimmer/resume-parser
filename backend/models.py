from sqlalchemy import Column, Integer, String, Text, JSON
from backend.database import Base

class Candidate(Base):
    __tablename__ = "candidates"

    id          = Column(Integer, primary_key=True, index=True)
    filename    = Column(String, index=True)
    parsed_data = Column(Text)            # existing: filename + size JSON

    # NEW: store the extracted raw text of the resume
    text        = Column(Text, nullable=True)

    # NEW: store requirement-to-score map, e.g. {"Python": 87.5, "AWS": 42.0}
    scores      = Column(JSON, nullable=False, default={})
