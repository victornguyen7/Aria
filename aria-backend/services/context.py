from sqlalchemy.orm import Session 
from models.user import User
from models.task import task
from models.event import event
from models.course import course
from datetime import datetime

def build_user_context(user: User, db: Session) -> str:
    now = datetime.utcnow()

    tasks = db.query(task).filter(task.user_id == user.id).all()
    events = db.query(event).filter(event.user_id == user.id, event.start_time >= now).order_by(event.start_time).all()
    courses = db.query(course).filter(course.user_id == user.id).all()

    overdue = [t for t in tasks if t.due_date and t.due_date < now and t.status != "done"]
    upcoming = [t for t in tasks if t.due_date and t.due_date >= now and t.status != "done"]
    done = [t for t in tasks if t.status == "done"]

    upcoming_events = sorted(
        [e for e in events if e.start_time >= now],
        key=lambda e: e.start_time
    )[:5]

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

    Events: ({len(upcoming_events)} total)
    {chr(10).join(f"- {e.title} (At: {e.start_time.strftime('%Y-%m-%d %H:%M')})" for e in upcoming_events) if upcoming_events else "No upcoming events."}
    """

    return context.strip()