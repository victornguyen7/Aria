from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
from routers.auth import get_current_user
from models.user import User
from models.task import task, priority as p, status
from models.course import course
from datetime import datetime, timedelta

router = APIRouter(prefix="/canvas", tags=["canvas"])

MOCK_COURSES = [
    {
        "canvas_id": "canvas-course-101",
        "name": "Data Structures",
        "name_code": "CS201",
        "description": "Learn fundamental data structures including arrays, linked lists, trees, and graphs.",
        "instructor": "Dr. Alice Johnson",
    },
    {
        "canvas_id": "canvas-course-102",
        "name": "Calculus II",
        "name_code": "MATH202",
        "description": "Continuation of calculus focusing on integration techniques and applications.",
        "instructor": "Prof. Robert Chen",
    },
    {
        "canvas_id": "canvas-course-103",
        "name": "Intro to AI",
        "name_code": "CS301",
        "description": "Introduction to artificial intelligence, machine learning, and ethics.",
        "instructor": "Dr. Sarah Williams",
    },
]

# due_date offsets are relative to request time (computed in routes, not at import)
MOCK_ASSIGNMENT_TEMPLATES = [
    {
        "canvas_id": "canvas-001",
        "title": "Binary Search Tree Implementation",
        "description": "Implement a BST with insert, delete, and search methods.",
        "course_code": "CS201",
        "due_offset_days": 2,
    },
    {
        "canvas_id": "canvas-002",
        "title": "Calculus Quiz 4 — Integration",
        "description": "Covers sections 7.1 through 7.4.",
        "course_code": "MATH202",
        "due_offset_days": 3,
    },
    {
        "canvas_id": "canvas-003",
        "title": "AI Ethics Reading Response",
        "description": "Write 300 words responding to the assigned reading on AI bias.",
        "course_code": "CS301",
        "due_offset_days": 5,
    },
    {
        "canvas_id": "canvas-004",
        "title": "Midterm Project Proposal",
        "description": "Submit a 1-page proposal for your midterm project.",
        "course_code": "CS301",
        "due_offset_days": -1,  # already past due
    },
    {
        "canvas_id": "canvas-005",
        "title": "Problem Set 6",
        "description": "Problems 1-20 from chapter 8.",
        "course_code": "MATH202",
        "due_offset_days": 7,
    },
]


def _resolved_assignments():
    """Return assignments with due_date resolved relative to now."""
    now = datetime.utcnow()
    return [
        {**t, "due_date": (now + timedelta(days=t["due_offset_days"])).isoformat()}
        for t in MOCK_ASSIGNMENT_TEMPLATES
    ]


def _compute_priority(due_date: datetime | None) -> p:
    now = datetime.utcnow()
    if due_date is None:
        return p.low
    if due_date < now:
        return p.high
    days_left = (due_date - now).days
    if days_left <= 2:
        return p.high
    if days_left <= 5:
        return p.medium
    return p.low


@router.get("/assignments")
def get_assignments(current_user: User = Depends(get_current_user)):
    return {
        "assignments": _resolved_assignments(),
        "total": len(MOCK_ASSIGNMENT_TEMPLATES),
        "source": "mock",
    }


@router.get("/courses")
def get_courses(current_user: User = Depends(get_current_user)):
    return {
        "courses": MOCK_COURSES,
        "total": len(MOCK_COURSES),
        "source": "mock",
    }


@router.post("/sync/courses")
def sync_courses(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    synced = 0
    skipped = 0

    for c in MOCK_COURSES:
        existing = db.query(course).filter(
            course.user_id == current_user.id,
            course.canvas_id == c["canvas_id"],
        ).first()
        if existing:
            skipped += 1
            continue

        db.add(course(
            user_id=current_user.id,
            name=c["name"],
            name_code=c["name_code"],
            description=c.get("description"),
            instructor=c.get("instructor"),
            canvas_id=c["canvas_id"],
        ))
        synced += 1

    db.commit()
    return {"message": f"Synced {synced} courses from Canvas", "synced": synced, "skipped": skipped}


@router.post("/sync/assignments")
def sync_assignments(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    synced = 0
    skipped = 0

    # Build a course_code -> course.id map for the current user
    user_courses = db.query(course).filter(course.user_id == current_user.id).all()
    course_map = {c.name_code: c.id for c in user_courses}

    for assignment in _resolved_assignments():
        existing = db.query(task).filter(
            task.user_id == current_user.id,
            task.title == assignment["title"],
        ).first()
        if existing:
            skipped += 1
            continue

        due_date = None
        try:
            due_date = datetime.fromisoformat(assignment["due_date"])
        except (ValueError, KeyError):
            pass

        db.add(task(
            user_id=current_user.id,
            title=assignment["title"],
            description=assignment.get("description"),
            due_date=due_date,
            priority=_compute_priority(due_date),
            status=status.todo,
        ))
        synced += 1

    db.commit()
    return {"message": f"Synced {synced} assignments from Canvas", "synced": synced, "skipped": skipped}
