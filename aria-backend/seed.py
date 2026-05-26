from datetime import datetime, timedelta

from database import SessionLocal, Base, engine
from models.user import User
from models.task import task, priority, status
from models.event import event
from models.course import course
from models.auth import hash_password

# Create all tables first
Base.metadata.create_all(bind=engine)

db = SessionLocal()

try:
    # Delete in FK-safe order (children first)
    db.query(task).delete()
    db.query(event).delete()
    db.query(course).delete()
    db.query(User).delete()
    db.commit()

    # Create test user (users.hashed_password is NOT NULL)
    raw_password = "TestPass123!"
    test_user = User(
        email="test@example.com",
        hashed_password=hash_password(raw_password),
    )
    db.add(test_user)
    db.commit()
    db.refresh(test_user)

    # Seed courses (model uses name_code, not code)
    courses = [
        course(user_id=test_user.id, name="Data Structures", name_code="CS201", instructor="Dr. Smith"),
        course(user_id=test_user.id, name="Calculus II", name_code="MATH202", instructor="Dr. Johnson"),
        course(user_id=test_user.id, name="Intro to AI", name_code="CS301", instructor="Dr. Lee"),
    ]
    db.add_all(courses)
    db.commit()

    now = datetime.utcnow()
    tasks = [
        task(
            user_id=test_user.id,
            title="Complete CS201 assignment",
            priority=priority.high,
            status=status.todo,
            due_date=now + timedelta(days=1),
            description="Binary search tree implementation",
        ),
        task(
            user_id=test_user.id,
            title="Study for Calculus quiz",
            priority=priority.high,
            status=status.todo,
            due_date=now + timedelta(days=2),
            description="Chapters 4 and 5",
        ),
        task(
            user_id=test_user.id,
            title="Read AI textbook chapter 3",
            priority=priority.medium,
            status=status.in_progress,
            due_date=now + timedelta(days=3),
            description="Neural networks intro",
        ),
        task(
            user_id=test_user.id,
            title="Submit project proposal",
            priority=priority.high,
            status=status.todo,
            due_date=now - timedelta(days=1),
            description="Overdue — submit ASAP",
        ),
        task(
            user_id=test_user.id,
            title="Review lecture notes",
            priority=priority.low,
            status=status.done,
            description="Already completed",
        ),
    ]
    db.add_all(tasks)
    db.commit()

    events = [
        event(
            user_id=test_user.id,
            title="AI Conference",
            start_time=now + timedelta(days=5),
            end_time=now + timedelta(days=5, hours=2),
            description="Attend the annual AI conference",
        )
    ]
    db.add_all(events)
    db.commit()

    print("Seed data created successfully!")
    print(f"Demo account: test@example.com / {raw_password}")

except Exception:
    db.rollback()
    raise
finally:
    db.close()