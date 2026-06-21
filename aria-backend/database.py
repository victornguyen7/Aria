from sqlalchemy import create_engine #connect to my own database
from sqlalchemy.ext.declarative import declarative_base #use the databse model as a python class
from sqlalchemy.orm import sessionmaker #query the database
import os
from pathlib import Path
from dotenv import load_dotenv #loads variables from .env file

# Load .env.local first (if it exists), then fall back to .env
env_local_path = Path(__file__).parent / ".env.local"
if env_local_path.exists():
    load_dotenv(env_local_path)
else:
    load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./aria.db")

# Railway injects postgresql:// but SQLAlchemy requires postgresql+psycopg2://
if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg2://", 1)

_connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=_connect_args)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()