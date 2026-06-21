from sqlalchemy.orm import Session 
from models.user import User
from models.task import Task, Status, Priority
from models.event import Event
from models.course import Course
from datetime import datetime, timedelta

def score_priority(task_obj: Task, now: datetime) -> float:
    score = 0.0

    priority_scores = {
        Priority.low: 10,
        Priority.medium: 50,
        Priority.high: 100
    }

    score += priority_scores.get(task_obj.priority, 0)

    if task_obj.due_date:
        hours_until_due = (task_obj.due_date - now).total_seconds() / 3600
        if hours_until_due < 0:
            score += 200
        elif hours_until_due < 24:
            score += 150
        elif hours_until_due < 48:
            score += 100
        elif hours_until_due < 72:
            score += 50
        elif hours_until_due < 168:
            score += 25
    else:
        score += 5

    if task_obj.status == Status.in_progress.value:
        score += 20

    return score

def get_priority_tasks(user_id: int, db: Session, limit: int = 5) -> list:
    now = datetime.utcnow()
    tasks = db.query(Task).filter(Task.user_id == user_id, Task.status != Status.done.value).all()
    scored = sorted(tasks, key=lambda t: score_priority(t, now), reverse=True)
    return scored[:limit]

def build_user_context(user: User, db: Session) -> str:
    now = datetime.utcnow()
    today_time = now.replace(hour=23, minute=59, second=59)
    week_time = now + timedelta(days=7)

    tasks = db.query(Task).filter(Task.user_id == user.id).all()

    all_events = db.query(Event).filter(Event.user_id == user.id).all()
    google_events = [e for e in all_events if e.source.startswith("google:") and e.start_time >= now and e.start_time <= week_time]

    courses = db.query(Course).filter(Course.user_id == user.id).all()

    overdue = [t for t in tasks if t.due_date and t.due_date < now and t.status != Status.done.value]
    upcoming = [t for t in tasks if t.due_date and t.due_date >= now and t.status != Status.done.value]
    done = [t for t in tasks if t.status == Status.done.value]

    upcoming_events = sorted(
        [e for e in all_events if e.start_time >= now],
        key=lambda e: e.start_time
    )[:5]

    today_events = sorted(
        [e for e in all_events if e.start_time >= now and e.start_time <= today_time],
        key=lambda e: e.start_time
    )

    priority_tasks = get_priority_tasks(user.id, db)

    google_section = ""
    if google_events:
        sorted_google = sorted(google_events, key=lambda e: e.start_time)
        google_section = f"""
GOOGLE CALENDAR EVENTS (next 7 days, {len(sorted_google)} total)
{chr(10).join(f"- {e.title} on {e.start_time.strftime('%A %b %d at %I:%M %p')}" for e in sorted_google)}
"""
        
    context = f"""
    STUDENT PROFILE
    User ID: {user.id}
    Email: {user.email}
    Courses: ({len(courses)} total)
    {chr(10).join(f"- {c.name} (ID: {c.id or 'no code'}) - {c.instructor or 'no instructor'}" for c in courses) if courses else "None."}

    Overdue: ({len(overdue)} total)
    {chr(10).join(f"- {t.title} (Due: {t.due_date.strftime('%Y-%m-%d %H:%M')}) - Priority: {t.priority} - Status: {t.status}" for t in overdue) if overdue else "None."}

    Upcoming: ({len(upcoming)} total)
    {chr(10).join(f"- {t.title} (Due: {t.due_date.strftime('%Y-%m-%d %H:%M')}) - Priority: {t.priority} - Status: {t.status}" for t in upcoming) if upcoming else "None."}

    Done: ({len(done)} total)
    {chr(10).join(f"- {t.title}" for t in done) if done else "None."}

    Today's schedule ({len(today_events)} events)
    {chr(10).join(f"- {e.title} at {e.start_time.strftime('%I:%M %p')} {'[Google]' if e.source.startswith('google:') else '[Manual]'}" for e in today_events) or "Nothing scheduled today."}

    Upcoming events (next 7 days, {len(upcoming_events)} total)
    {chr(10).join(f"- {e.title} on {e.start_time.strftime('%A %b %d at %I:%M %p')} {'[Google]' if e.source.startswith('google:') else '[Manual]'}" for e in upcoming_events) or "No upcoming events."}
    {google_section}
    """.strip()

    return context.strip()