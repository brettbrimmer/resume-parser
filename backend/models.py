from sqlalchemy import Column, Integer, String, Text
from backend.database import Base

class Candidate(Base):
    __tablename__ = "candidates"
    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, unique=True, index=True)
    parsed_data = Column(Text)  # JSON dump of parsed info
