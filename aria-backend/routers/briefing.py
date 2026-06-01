from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
from groq import Groq # type: ignore
from routers.auth import get_current_user
from models.user import User
from models.task import task, status
from models.event import event
from services.context import build_user_context, get_priority_tasks
import os
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/briefing", tags=["briefing"])

client = Groq(api_key=os.getenv("GROQ_API_KEY"))

@router.get("/")
def get_briefing(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):

    now = datetime.utcnow()
    user_context = build_user_context(current_user, db)

    tasks = get_priority_tasks(current_user.id, db)
    events = db.query(event).filter(event.user_id == current_user.id, event.start_time >= now).all()
    overdue = [t for t in tasks if t.due_date and t.due_date < now and t.status != status.done.value]
    upcoming = sorted(
         [t for t in tasks if t.status != status.done.value and (not t.due_date or t.due_date >= now)],
        key=lambda t: (t.due_date is None, t.due_date)
    )
    today = [e for e in events if e.start_time.date() == now.date()]

    prompt = f"""
Based on this student's data, write a short personalized daily briefing (3-4 sentences max).
Mention their most urgent priorities, any overdue items, and one encouragement.
Be warm and direct. No bullet points — flowing sentences only.

{user_context}
"""
    summary = "Unable to generate briefing at this time. Please try again."
    
    try:
        response = client.chat.completions.create(
            model=os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile"),
            messages=[{"role": "user", "content": prompt}],
            max_tokens=300,
        )
        
        if response.choices and response.choices[0].message.content:
            summary = response.choices[0].message.content.strip()
    except Exception as e:
        logger.error(f"Error Groq API: {e}")

    return {
        "summary": summary,
        "overdue_count": len(overdue),
        "upcoming_count": len(upcoming),
        "today_events":[{
            "id": e.id,
            "title": e.title,
            "start_time": e.start_time.isoformat(),
            "end_time": e.end_time.isoformat() if e.end_time else None
        } for e in today],
        "top_tasks": [{
            "id": t.id,
            "title": t.title,
            "priority": t.priority,
            "due_date": t.due_date.isoformat() if t.due_date else None,
            "status": t.status,
        } for t in tasks],
        "generated_at": now.isoformat()
    }