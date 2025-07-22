from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, JSON, Float
from sqlalchemy import DateTime, ForeignKey
from backend.database import Base
from sqlalchemy import DateTime
from sqlalchemy.orm import relationship

class Job(Base):
    __tablename__ = "jobs"

    id          = Column(Integer, primary_key=True, index=True)
    title       = Column(Text, nullable=False)
    description = Column(Text, nullable=True)
    created_at  = Column(
      DateTime(timezone=True),
      default=lambda: datetime.now(timezone.utc),
      nullable=False
    )

    # back‐reference to candidates
    candidates  = relationship("Candidate", back_populates="job")

class Candidate(Base):
    __tablename__ = "candidates"

    id          = Column(Integer, primary_key=True, index=True)
    filename    = Column(String, index=True)
    parsed_data = Column(Text)            # existing: filename + size JSON

    # store the extracted raw text of the resume
    text        = Column(Text, nullable=True)
    email     = Column(String, index=True, nullable=True)
    phone     = Column(String, index=True, nullable=True)

    # store parsed GPA (0.0–4.0)
    gpa         = Column(Float, nullable=True)

    # structured fields from resume_parser
    name                  = Column(String, nullable=True)   # person’s full name
    location              = Column(String, nullable=True)   # city, state
    degrees_earned        = Column(JSON, nullable=True)     # list of [line, date]
    degrees_in_progress   = Column(JSON, nullable=True)     # list of [line, date]

    projects       = Column(JSON, default=[])  # new: structured list of parsed projects
    experience     = Column(JSON, default=[])    # new: structured list of experiences

    # NEW: store requirement-to-score map, e.g. {"Python": 87.5, "AWS": 42.0}
    scores      = Column(JSON, nullable=False, default={})

    skills = Column(Text, nullable=True)

    upload_date = Column(
            DateTime(timezone=True),
            default=lambda: datetime.now(timezone.utc),
            nullable=False
        )
    
    # link each candidate to a job
    job_id      = Column(Integer, ForeignKey("jobs.id", ondelete="CASCADE"), index=True)
    job         = relationship("Job", back_populates="candidates")
    
    
