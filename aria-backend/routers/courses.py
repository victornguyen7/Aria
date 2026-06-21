from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel
from database import get_db
from models.course import Course as CourseModel
from models.auth import get_current_user
from models.user import User

router = APIRouter(prefix="/courses", tags=["courses"])

class CourseCreate(BaseModel):
    name: str
    name_code: str
    description: Optional[str] = None
    instructor: Optional[str] = None
    canvas_id: Optional[str] = None

class CourseUpdate(BaseModel):
    name: Optional[str] = None
    name_code: Optional[str] = None
    description: Optional[str] = None
    instructor: Optional[str] = None
    canvas_id: Optional[str] = None

@router.get("/")
def get_courses(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(CourseModel).filter(CourseModel.user_id == current_user.id).all()

@router.post("/")
def create_course(course_data: CourseCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    new_course = CourseModel(**course_data.dict(), user_id=current_user.id)
    db.add(new_course)
    db.commit()
    db.refresh(new_course)
    return new_course

@router.put("/{course_id}")
def update_course(course_id: int, course_data: CourseUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    existing_course = db.query(CourseModel).filter(CourseModel.id == course_id, CourseModel.user_id == current_user.id).first()
    if not existing_course:
        raise HTTPException(status_code=404, detail="Course not found")
    for key, value in course_data.dict(exclude_unset=True).items():
        setattr(existing_course, key, value)
    db.commit()
    db.refresh(existing_course)
    return existing_course

@router.delete("/{course_id}")
def delete_course(course_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    existing_course = db.query(CourseModel).filter(CourseModel.id == course_id, CourseModel.user_id == current_user.id).first()
    if not existing_course:
        raise HTTPException(status_code=404, detail="Course not found")
    db.delete(existing_course)
    db.commit()
    return {"message": "Course deleted successfully"}