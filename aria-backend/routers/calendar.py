from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from googleapiclient.discovery import build  # type: ignore
from google.oauth2.credentials import Credentials  # type: ignore
from google.auth.transport.requests import Request  # type: ignore
from database import get_db
from routers.auth import get_current_user
from models.user import User
from models.event import Event as EventModel
from datetime import datetime, timedelta, timezone
from config import config
import json

router = APIRouter(prefix="/calendar", tags=["calendar"])

def get_google_credentials(user: User) -> Credentials:
    if not user.google_tokens:
        raise HTTPException(
            status_code=400,
            detail="Google Calendar not connected. Please connect via /auth/google/authorize"
        )
    tokens = json.loads(user.google_tokens)
    # client_secret must never be stored in the DB — always read from env
    return Credentials(
        token=tokens["token"],
        refresh_token=tokens.get("refresh_token"),
        token_uri=tokens["token_uri"],
        client_id=tokens["client_id"],
        client_secret=config.GOOGLE_CLIENT_SECRET,
        scopes=tokens["scopes"],
    )

@router.get("/sync")
def sync_calendar(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    credentials = get_google_credentials(current_user)

    # Refresh the access token if expired
    if credentials.expired and credentials.refresh_token:
        credentials.refresh(Request())
        # Persist the new token back to the DB
        tokens = json.loads(current_user.google_tokens)
        tokens["token"] = credentials.token
        current_user.google_tokens = json.dumps(tokens)
        db.commit()

    try:
        service = build("calendar", "v3", credentials=credentials)

        now = datetime.now(timezone.utc)
        time_min = now.isoformat()
        time_max = (now + timedelta(days=14)).isoformat()

        result = service.events().list(
            calendarId="primary",
            timeMin=time_min,
            timeMax=time_max,
            maxResults=50,
            singleEvents=True,
            orderBy="startTime",
        ).execute()

        google_events = result.get("items", [])
        synced = 0

        for ge in google_events:
            if "dateTime" not in ge.get("start", {}):
                continue

            start = datetime.fromisoformat(
                ge["start"]["dateTime"].replace("Z", "+00:00")
            ).replace(tzinfo=None)

            end = None
            if "dateTime" in ge.get("end", {}):
                end = datetime.fromisoformat(
                    ge["end"]["dateTime"].replace("Z", "+00:00")
                ).replace(tzinfo=None)
            if end is None:
                end = start + timedelta(hours=1)

            google_id = ge["id"]

            existing = db.query(EventModel).filter(
                EventModel.user_id == current_user.id,
                EventModel.source == f"google:{google_id}"
            ).first()

            if existing:
                existing.title = ge.get("summary", "Untitled")
                existing.start_time = start
                existing.end_time = end
            else:
                new_event = EventModel(
                    user_id=current_user.id,
                    title=ge.get("summary", "Untitled"),
                    description=ge.get("description"),
                    start_time=start,
                    end_time=end,
                    source=f"google:{google_id}",
                )
                db.add(new_event)
                synced += 1

        db.commit()

        return {
            "message": f"Synced {synced} new events from Google Calendar",
            "total_fetched": len(google_events),
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error syncing calendar: {e}")

@router.get("/status")
def calendar_status(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return {
        "connected": current_user.google_tokens is not None,
        "email": current_user.email,
    }
