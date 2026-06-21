from sqlalchemy.orm import Session
from models.task import Task, Status, Priority
from models.event import Event
from models.user import User
from datetime import datetime, timedelta

def detect_conflict(user_id: int, db: Session):
    now = datetime.utcnow()
    week_time = now + timedelta(days=7)

    events = db.query(Event).filter(
        Event.user_id == user_id,
        Event.start_time >= now,
        Event.start_time <= week_time,
    ).all()

    tasks = db.query(Task).filter(
        Task.user_id == user_id,
        Task.status != Status.done,
        Task.due_date != None,
        Task.due_date >= now,
        Task.due_date <= week_time,
    ).all()

    conflicts = []

    for t in tasks:
        for e in events:
            if not e.end_time:
                continue

            task_due = t.due_date
            event_start = e.start_time
            event_end = e.end_time

            if event_start <= task_due <= event_end:
                conflicts.append({
                    "type": "due_during_event",
                    "severity": "high",
                    "message": f'"{t.title}" is due at {task_due.strftime("%I:%M %p")} during "{e.title}"',
                    "task": {
                        "id": t.id,
                        "title": t.title,
                        "due_date": task_due.isoformat(),
                        "priority": t.priority.value,
                    },
                    "event": {
                        "id": e.id,
                        "title": e.title,
                        "start_time": event_start.isoformat(),
                        "end_time": event_end.isoformat(),
                    },
                })

            one_hour_before = event_start - timedelta(hours=1)
            if one_hour_before <= task_due < event_start:
                conflicts.append({
                    "type": "due_before_event",
                    "severity": "medium",
                    "message": f'"{t.title}" is due less than 1 hour before "{e.title}" starts',
                    "task": {
                        "id": t.id,
                        "title": t.title,
                        "due_date": task_due.isoformat(),
                        "priority": t.priority.value,
                    },
                    "event": {
                        "id": e.id,
                        "title": e.title,
                        "start_time": event_start.isoformat(),
                        "end_time": event_end.isoformat(),
                    },
                })

    overdue_not_low = db.query(Task).filter(
        Task.user_id == user_id,
        Task.status != Status.done,
        Task.due_date < now,
        Task.priority != Priority.low
    ).all()

    for t in overdue_not_low:
        conflicts.append({
            "type": "overdue_high_priority",
            "severity": "critical",
            "message": f'"{t.title}" is overdue and needs immediate attention',
            "task": {
                "id": t.id,
                "title": t.title,
                "due_date": t.due_date.isoformat(),
                "priority": t.priority.value,
            },
            "event": None,
        })
                
    severity_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    conflicts.sort(key=lambda c: severity_order.get(c["severity"], 99))

    return conflicts