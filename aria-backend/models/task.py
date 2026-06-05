from sqlalchemy import Column, Float, Integer, String, DateTime, ForeignKey, Enum, func
from database import Base
import enum

class priority(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"

class status(str, enum.Enum):
    todo = "todo"
    in_progress = "in_progress"
    done = "done"

class task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String, index=True)
    description = Column(String, index=True, nullable=True)
    grade_max = Column(Float, nullable=True)
    grade_earned = Column(Float, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())
    due_date = Column(DateTime(timezone=True), nullable=True)
    priority = Column(Enum(priority), default=priority.medium)
    status = Column(Enum(status), default=status.todo)

    # nullable = true is used for optional fields,
    # which means that the field can be left empty