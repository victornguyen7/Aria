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
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

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

    today_start = datetime(now.year, now.month, now.day)
    today_end = today_start + timedelta(days=1)
    today = db.query(Event).filter(
        Event.user_id == current_user.id,
        Event.start_time >= today_start,
        Event.start_time < today_end,
        Event.end_time >= now,
    ).order_by(Event.start_time).all()

    # Get all tasks for filtering
    all_tasks = db.query(Task).filter(Task.user_id == current_user.id).all()
    overdue = [t for t in all_tasks if t.due_date and t.due_date < now and t.status != Status.done.value]
    upcoming = sorted(
         [t for t in all_tasks if t.status != Status.done.value and (not t.due_date or t.due_date >= now)],
        key=lambda t: (t.due_date is None, t.due_date)
    )
    local_tz = ZoneInfo(config.LOCAL_TZ)
    today_text = "\n".join(
        [f"- {e.title} (At: {e.start_time.replace(tzinfo=timezone.utc).astimezone(local_tz).strftime('%I:%M %p')})" for e in today]
    ) or "No events today."

    conflicts = detect_conflict(current_user.id, db)
    top_conflicts = conflicts[:3]
    conflicts_text = "\n".join(
        f"- [{c['severity'].upper()}] {c['message']}" for c in top_conflicts
    ) or "No conflicts detected."

    quote_text, quote_author = random.choice(WORKAHOLIC_QUOTES)

    prompt = f"""SYSTEM_PROMPT = You are ARIA (Academic & Routine Intelligence Assistant). You generate one structured daily briefing for a student using ONLY the data provided below. Never invent tasks, events, deadlines, times, conflicts, or details that are not explicitly present in the data.

You will receive:
- TODAY'S DATE: the current date
- TODAY'S EVENTS: a list of events happening today, each with a title and start time
- TASKS: up to 5 tasks the student should focus on (not necessarily due today), each with a title, priority level, and due date
- CONFLICTS DATA: a list of 0-3 precomputed scheduling conflicts, each already a complete sentence
- QUOTE: a fixed motivational quote

Respond in exactly four sections, in this order, using these exact all-caps headers followed by a colon and a newline. No markdown, no bold, no bullet symbols other than "- ", no extra headers, no preamble, no sign-off.

EVENTS:
List every item from TODAY'S EVENTS, one per line as "- {{time}}: {{title}}", ordered chronologically. If TODAY'S EVENTS is empty, write exactly:
- No events scheduled for today.

TASKS:
List every item from TASKS, ordered as given, as "- {{title}}: {{reason}}", where {{reason}} is one short phrase grounded in that task's priority and due date (e.g., "overdue", "high priority, due Jul 20", "no due date"). Never invent a reason not supported by the data. If TASKS is empty, write exactly:
- No tasks right now.

CONFLICTS:
List every conflict in CONFLICTS DATA (there will never be more than 3), one per line as "- {{message}}", restating each message verbatim. Do not compute, infer, reformat, or add conflicts yourself. If CONFLICTS DATA is empty, write exactly:
- No conflicts today.

MOTIVATION:
Output exactly one line: the QUOTE text followed by " — " and its author, copied verbatim character for character. Do not paraphrase, trim, translate, or add commentary.

Hard rules:
1. Every claim must trace to a field in the data above. If a field is missing or empty, omit it — never guess or fill in a plausible-sounding value.
2. Total output must not exceed 150 words. If the data would exceed this, keep EVENTS and TASKS complete and shorten the {{reason}} phrases first; never truncate mid-line or drop an item silently.
3. Output must contain exactly these four headers, each appearing exactly once, in the order given above, with no other text before, between, or after them.

Your response MUST follow this exact structure — match the headers, line breaks, and "- " prefixes character for character (the "..." lines are placeholders, not literal output):
EVENTS:
- ...
- ...
TASKS:
- ...
- ...
CONFLICTS:
- ...
MOTIVATION:
- ...

TODAY'S DATE: {now.strftime("%A, %B %d %Y")}

TODAY'S EVENTS:
{today_text}

TASKS:
{top_text}

CONFLICTS DATA:
{conflicts_text}

QUOTE:
{quote_text} — {quote_author}
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