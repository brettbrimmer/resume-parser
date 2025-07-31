from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    JSON,
    Float,
    DateTime,
    ForeignKey,
    func,
)
from sqlalchemy.orm import relationship
from database import Base


class Job(Base):
    """
    Represents a job posting, including its metadata and relationship to candidates.

    Attributes:
        id (int): Primary key.
        title (str): Job title.
        description (str | None): Optional job description.
        created_at (datetime): Timestamp of job creation in UTC.
        location (str): Job location (e.g., "Tempe, AZ").
        candidates (List[Candidate]): List of candidates associated with this job.
    """
    __tablename__ = "jobs"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(Text, nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )
    location = Column(String, nullable=False, index=True)

    candidates = relationship("Candidate", back_populates="job")


class Candidate(Base):
    """
    Represents a candidate applying for a job, including parsed resume fields and scoring data.

    Attributes:
        id (int): Primary key.
        filename (str): Original filename of the uploaded resume.
        parsed_data (str): JSON string storing file metadata (e.g., filename and size).
        text (str | None): Raw text extracted from the resume.
        email (str | None): Candidate's email address.
        phone (str | None): Candidate's phone number.
        gpa (float | None): Parsed GPA on a 0.0–4.0 scale.
        name (str | None): Full name extracted from the resume.
        location (str | None): Parsed location (e.g., city, state).
        degrees_earned (List[List[str, str]] | None): Completed degrees with details.
        degrees_in_progress (List[List[str, str]] | None): Ongoing degrees with details.
        projects (List[dict]): Parsed project information.
        experience (List[dict]): Parsed work experience information.
        scores (dict): Requirement-to-score map (e.g., {"Python": 87.5}).
        skills (str | None): Free-text list or block of skills.
        upload_date (datetime): Timestamp of resume upload.
        job_id (int): Foreign key to the associated job.
        job (Job): Relationship to the associated job.
    """
    __tablename__ = "candidates"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, index=True)
    parsed_data = Column(Text)

    text = Column(Text, nullable=True)
    email = Column(String, index=True, nullable=True)
    phone = Column(String, index=True, nullable=True)
    gpa = Column(Float, nullable=True)

    name = Column(String, nullable=True)
    location = Column(String, nullable=True)
    degrees_earned = Column(JSON, nullable=True)
    degrees_in_progress = Column(JSON, nullable=True)

    projects = Column(JSON, default=[])
    experience = Column(JSON, default=[])
    scores = Column(JSON, nullable=False, default={})

    skills = Column(Text, nullable=True)
    upload_date = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )

    job_id = Column(Integer, ForeignKey("jobs.id", ondelete="CASCADE"), index=True)
    job = relationship("Job", back_populates="candidates")


class Badge(Base):
    """
    Represents a reusable job requirement badge.

    Attributes:
        id (int): Primary key.
        title (str): Human-readable name of the badge.
        reqText (str): Raw text of the requirement.
        created_at (datetime): Timestamp of creation.
    """
    __tablename__ = "badges"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    reqText = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
