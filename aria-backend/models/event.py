from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, func
from database import Base
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime

class Event(Base):
    __tablename__ = "events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    title: Mapped[str] = mapped_column(String, index=True)
    description: Mapped[str | None] = mapped_column(String, index=True, nullable=True)
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    source: Mapped[str] = mapped_column(String, default="manual", nullable=True)  # default source is set to "manual" or "google_calendar"
    # source_id: Mapped[str | None] = mapped_column(String, nullable=True)  # e.g. Google Calendar event ID, if applicable