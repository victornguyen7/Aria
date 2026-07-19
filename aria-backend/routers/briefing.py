from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
from groq import Groq
from routers.auth import get_current_user
from models.user import User
from models.task import Task, Status
from models.event import Event
from services.context import build_user_context, get_priority_tasks
from services.conflict import detect_conflict
from config import config
import logging
import random
from datetime import datetime

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/briefing", tags=["briefing"])

client = Groq(api_key=config.GROQ_API_KEY)

WORKAHOLIC_QUOTES = [
    ('"Work like there is someone working 24 hours a day to take it away from you."', "Mark Cuban"),
    ('"I\'m not the smartest fellow in the world, but I sure can pick smart colleagues." Work hard, though — luck favors the busy.', "Franklin D. Roosevelt"),
    ('"If you really look closely, most overnight successes took a long time."', "Steve Jobs"),
    ('"There is no substitute for hard work."', "Thomas Edison"),
    ('"The only way to do great work is to love what you do."', "Steve Jobs"),
    ('"I feel that luck is prepared opportunity meeting preparation."', "Oprah Winfrey"),
    ('"Someone\'s sitting in the shade today because someone planted a tree a long time ago."', "Warren Buffett"),
    ('"I\'m always thinking about creating problems for myself, and that gives me the drive to solve them."', "Elon Musk"),
    ('"You miss 100% of the shots you don\'t take."', "Wayne Gretzky"),
    ('"The separation of talent and skill is one of the greatest misunderstood concepts. Skill is the unyielding zeal to practice."', "Will Smith"),
    ('"The price of success is hard work, dedication to the job at hand, and the determination that whether we win or lose, we have applied the best of ourselves to the task at hand."', "Vince Lombardi"),
    ('"A dream doesn\'t become reality through magic; it takes sweat, determination and hard work."', "Colin Powell"),
    ('"The only place where success comes before work is in the dictionary."', "Vidal Sassoon"),
    ('"The secret of getting ahead is getting started."', "Mark Twain"),
    ('"Success is no accident. It is hard work, perseverance, learning, studying, sacrifice, and most of all, love of what you are doing."', "Pelé"),
    ('"Far and away the best prize that life offers is the chance to work hard at work worth doing."', "Theodore Roosevelt"),
    ('"Work Hard In Silence, Let Success Make The Noise."', "Frank Ocean"),
    ('"Nothing ever comes to one, that is worth having, except as a result of hard work."', "Booker T. Washington"),
    ('"I never dreamt of success. I worked for it."', "Estée Lauder"),
    ('"Success isn\'t always about greatness. It\'s about consistency. Consistent hard work leads to success. Greatness will come."', "Dwayne Johnson"),
]

@router.get("/")
def get_briefing(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):

    now = datetime.utcnow()
    # user_context = build_user_context(current_user, db) for future use

    top = get_priority_tasks(current_user.id, db)
    top_text = "\n".join([f"- {t.title} {t.priority.value.upper()} - due {t.due_date.strftime('%b %d') if t.due_date else 'no date'}" for t in top]) or "No tasks."
    events = db.query(Event).filter(Event.user_id == current_user.id, Event.start_time >= now).all()
    
    # Get all tasks for filtering
    all_tasks = db.query(Task).filter(Task.user_id == current_user.id).all()
    overdue = [t for t in all_tasks if t.due_date and t.due_date < now and t.status != Status.done.value]
    upcoming = sorted(
         [t for t in all_tasks if t.status != Status.done.value and (not t.due_date or t.due_date >= now)],
        key=lambda t: (t.due_date is None, t.due_date)
    )
    today = [e for e in events if e.start_time.date() == now.date()]
    today_text = "\n".join([f"- {e.title} (At: {e.start_time.strftime('%I:%M %p')})" for e in today]) or "No events today."

    conflicts = detect_conflict(current_user.id, db)
    top_conflicts = conflicts[:3]
    conflicts_text = "\n".join(
        f"- [{c['severity'].upper()}] {c['message']}" for c in top_conflicts
    ) or "No conflicts detected."

    quote_text, quote_author = random.choice(WORKAHOLIC_QUOTES)

    prompt = f"""You are ARIA (Academic & Routine Intelligence Assistant). You produce one structured daily briefing for a student using only the data provided. Never invent tasks, events, deadlines, or details not present in the data.

Respond in exactly four labeled sections:

SCHEDULE — List today's events and tasks due today with their times, if applicable, one per line. If nothing is scheduled, say so.

TOP PRIORITIES — List up to five tasks or events from the data that need the most attention today, ordered by importance. For each, give a short reason (overdue, due soon, high priority, etc.).

CONFLICTS — List the conflicts provided below (up to three), stating what overlaps or clashes. If none are provided, write "No conflicts today."

MOTIVATION — Output exactly the quote and author given below in QUOTE below, verbatim, formatted as: {quote_text} — {quote_author}. Do not alter the wording or attribution, and do not add anything else.

Rules:
- Base every claim on the student data below. If a field is absent, omit it — do not guess.
- Do not invent conflicts beyond what is listed in CONFLICTS DATA below.
- Events labeled [Google] come from Google Calendar sync. Events labeled [Manual] were entered by the student.
- 150 words maximum across all four sections.
- No preamble. No sign-off. No section titled anything other than the four labels above. Output the four sections only.

TODAY'S DATE: {now.strftime("%A, %B %d %Y")}

TOP PRIORITY TASKS:
{top_text}

TODAY'S EVENTS:
{today_text}

CONFLICTS DATA:
{conflicts_text}

QUOTE:
{quote_text} — {quote_author}

OVERDUE: {len(overdue)} task(s) overdue
UPCOMING: {len(upcoming)} task(s) remaining
"""
    summary = "Unable to generate briefing at this time. Please try again."
    
    try:
        response = client.chat.completions.create(
            model=config.GROQ_MODEL,
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
        "conflicts": conflicts[:3],
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

@router.get("/conflicts")
def get_conflicts(user_id = Depends(get_current_user), db:Session = Depends(get_db)):
    conflicts = detect_conflict(user_id, db)
    return {
        "conflicts": conflicts,
        "total": len(conflicts),
        "has_critical": any(c["severity"] == "critical" for c in conflicts),
    }