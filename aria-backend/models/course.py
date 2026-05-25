from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, func
from database import Base

class course(Base):
    __tablename__ = "courses"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    name_code = Column(String, nullable=False)
    instructor = Column(String, nullable=True)
    canvas_id = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # default source is set to "manual" or "google_calendar"