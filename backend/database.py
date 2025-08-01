from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# SQLite URL: change to your production DB URL when deploying
SQLALCHEMY_DATABASE_URL = "sqlite:///./resumes.db"

# Create the engine; echo=True logs all SQL statements for debugging
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})

# Configure session factory
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

# Base class for all ORM models
Base = declarative_base()
