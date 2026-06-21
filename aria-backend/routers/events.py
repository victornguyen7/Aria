from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime
from pydantic import BaseModel
from database import get_db
from models.event import Event as EventModel
from models.auth import get_current_user
from models.user import User


router = APIRouter(prefix="/events", tags=["events"])

class EventCreate(BaseModel):
    title: str
    description: Optional[str] = None
    start_time: datetime
    end_time: Optional[datetime] = None
    source: str = "manual"

class EventUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    source: Optional[str] = None

@router.get("/")
def get_events(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(EventModel).filter(EventModel.user_id == current_user.id).all()

@router.post("/")
def create_event(event_data: EventCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    new_event = EventModel(**event_data.dict(), user_id=current_user.id)
    db.add(new_event)
    db.commit()
    db.refresh(new_event)
    return new_event

@router.put("/{event_id}")
def update_event(event_id: int, event_data: EventUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    existing_event = db.query(EventModel).filter(EventModel.id == event_id, EventModel.user_id == current_user.id).first()
    if not existing_event:
        raise HTTPException(status_code=404, detail="Event not found")
    for key, value in event_data.dict(exclude_unset=True).items():
        setattr(existing_event, key, value)
        # Update any other fields as necessary
        # setattr is used to set the attribute of an object
    db.commit()
    db.refresh(existing_event)
    return existing_event

@router.delete("/{event_id}")
def delete_event(event_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    existing_event = db.query(EventModel).filter(EventModel.id == event_id, EventModel.user_id == current_user.id).first()
    if not existing_event:
        raise HTTPException(status_code=404, detail="Event not found")
    db.delete(existing_event)
    db.commit()
    return {"message": "Event deleted successfully"}