from sqlalchemy import Column, Float, Integer, String, DateTime, ForeignKey, Enum, func
from database import Base
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime
import enum

class Priority(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"

class Status(str, enum.Enum):
    todo = "todo"
    in_progress = "in_progress"
    done = "done"

class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    title: Mapped[str] = mapped_column(String, index=True)
    description: Mapped[str] = mapped_column(String, index=True, nullable=True)
    grade_max: Mapped[float] = mapped_column(Float, nullable=True)
    grade_earned: Mapped[float] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, onupdate=func.now())
    due_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    priority: Mapped[Priority] = mapped_column(Enum(Priority), default=Priority.medium)
    status: Mapped[Status] = mapped_column(Enum(Status), default=Status.todo)


    # nullable = true is used for optional fields,
    # which means that the field can be left empty