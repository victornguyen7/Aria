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
    # user_context = build_user_context(current_user, db) for future use

    top = get_priority_tasks(current_user.id, db)
    top_text = "\n".join([f"- {t.title} {t.priority.value.upper()} - due {t.due_date.strftime('%b %d') if t.due_date else 'no date'}" for t in top]) or "No tasks."
    events = db.query(event).filter(event.user_id == current_user.id, event.start_time >= now).all()
    
    # Get all tasks for filtering
    all_tasks = db.query(task).filter(task.user_id == current_user.id).all()
    overdue = [t for t in all_tasks if t.due_date and t.due_date < now and t.status != status.done.value]
    upcoming = sorted(
         [t for t in all_tasks if t.status != status.done.value and (not t.due_date or t.due_date >= now)],
        key=lambda t: (t.due_date is None, t.due_date)
    )
    today = [e for e in events if e.start_time.date() == now.date()]
    today_text = "\n".join([f"- {e.title} (At: {e.start_time.strftime('%I:%M %p')})" for e in today]) or "No events today."

    prompt = f"""You are ARIA (Academic & Routine Intelligence Assistant). You produce one structured daily briefing for a student using only the data provided. Never invent tasks, events, deadlines, or details not present in the data.

Respond in exactly four labeled sections:

GREETING — One sentence. Acknowledge the day and the student's current workload in plain, warm language.

FOCUS — Identify the single highest-priority task the student must act on today. Base this on overdue status, due-date proximity, and priority score. State the task name and why it's the focus. If nothing is urgent, say so.

HEADS UP — Flag up to three risks or conflicts: overdue tasks, events clashing with deadlines, or high-priority work due within 48 hours. Include any Google Calendar events from the provided data if they affect the student's day. If nothing needs flagging, write "Nothing critical today."

MOTIVATION — One sentence. Practical and specific to their situation. Not generic.

Rules:
- Base every claim on the student data below. If a field is absent, omit it — do not guess.
- Events labeled [Google] come from Google Calendar sync. Events labeled [Manual] were entered by the student.
- 150 words maximum across all four sections.
- No preamble. No sign-off. Output the four sections only.

TODAY'S DATE: {now.strftime("%A, %B %d %Y")}

TOP PRIORITY TASKS:
{top_text}

TODAY'S EVENTS:
{today_text}

OVERDUE: {len(overdue)} task(s) overdue
UPCOMING: {len(upcoming)} task(s) remaining
"""
    summary = "Unable to generate briefing at this time. Please try again."
    
    try:
        response = client.chat.completions.create(
            model=os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile"),
            messages=[{"role": "user", "content": prompt}],
            max_tokens=400,
        )
        
        if response.choices and response.choices[0].message.content:
            summary = response.choices[0].message.content.strip()
    except Exception as e:
        logger.error(f"Error Groq API: {e}")

    focus_task = None
    if top:
        t = top[0]
        focus_task = {
            "id": t.id,
            "title": t.title,
            "priority": t.priority.value,
            "due_date": t.due_date.isoformat() if t.due_date else None,
            "status": t.status.value,
            "description": t.description or None,
        }

    return {
        "summary": summary,
        "focus_task": focus_task,
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
            "priority": t.priority.value,
            "due_date": t.due_date.isoformat() if t.due_date else None,
            "status": t.status.value,
        } for t in top],
        "generated_at": now.isoformat()
    }