from sqlalchemy import create_engine #connect to my own database
from sqlalchemy.ext.declarative import declarative_base #use the databse model as a python class
from sqlalchemy.orm import sessionmaker #query the database
import os
from dotenv import load_dotenv #loads variables from .env file

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./aria.db")

engine = create_engine(
    DATABASE_URL, connect_args={"check_same_thread": False}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()