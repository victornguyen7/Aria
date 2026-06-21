from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel
from database import get_db
from models.task import Task as TaskModel, Priority as task_priority, Status as task_status
from models.auth import get_current_user
from models.user import User

router = APIRouter(prefix="/tasks", tags=["tasks"])

class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None 
    #Optional is used to indicate that this field is not required
    due_date: Optional[datetime] = None # type: ignore
    priority: task_priority = task_priority.medium
    status: task_status = task_status.todo


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    due_date: Optional[datetime] = None # type: ignore
    priority: Optional[task_priority] = None
    status: Optional[task_status] = None
    grade_max: Optional[float] = None
    grade_earned: Optional[float] = None

@router.get("/")
def get_tasks(db : Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(TaskModel).filter(TaskModel.user_id == current_user.id).all()

@router.post("/")
def create_task(task_data: TaskCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    new_task = TaskModel(
        **task_data.dict(),
        user_id=current_user.id
    )
    db.add(new_task)
    db.commit()
    db.refresh(new_task)
    return new_task

@router.put("/{task_id}")
def update_task(task_id: int, task_data: TaskUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    existing_task = db.query(TaskModel).filter(TaskModel.id == task_id, TaskModel.user_id == current_user.id).first()
    if not existing_task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    for key, value in task_data.dict(exclude_unset=True).items():
        setattr(existing_task, key, value)
        # Update any other fields as necessary
        # setattr is used to set the attribute of an object
    db.commit()
    db.refresh(existing_task)
    return existing_task

@router.delete("/{task_id}")
def delete_task(task_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    existing_task = db.query(TaskModel).filter(TaskModel.id == task_id, TaskModel.user_id == current_user.id).first()
    if not existing_task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    db.delete(existing_task)
    db.commit()
    return {"message": "Task deleted successfully"}