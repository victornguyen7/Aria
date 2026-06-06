from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from database import get_db
from sqlalchemy.orm import Session
from routers.auth import get_current_user
from models.user import User
from google_auth_oauthlib.flow import Flow  # type: ignore
from jose import JWTError, jwt
from datetime import datetime, timedelta, timezone
from config import config
import json

router = APIRouter(prefix="/auth/google", tags=["google"])

SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"]
SECRET_KEY = config.SECRET_KEY
ALGORITHM = "HS256"

# In-memory store: state -> code_verifier (populated during /authorize,
# consumed during /callback). Fine for a single-process local dev server.
_pending_verifiers: dict[str, str | None] = {}

def make_flow() -> Flow:
    return Flow.from_client_config(
        {
            "web": {
                "client_id": config.GOOGLE_CLIENT_ID,
                "client_secret": config.GOOGLE_CLIENT_SECRET,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [config.GOOGLE_REDIRECT_URI],
            }
        },
        scopes=SCOPES,
        redirect_uri=config.GOOGLE_REDIRECT_URI,
    )

def _make_state_token(user_id: int) -> str:
    payload = {
        "sub": str(user_id),
        "type": "oauth_state",
        "exp": datetime.now(timezone.utc) + timedelta(minutes=10),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def _decode_state_token(state: str) -> int:
    try:
        payload = jwt.decode(state, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "oauth_state":
            raise ValueError
        return int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        raise HTTPException(status_code=400, detail="Invalid or expired state token")

@router.get("/authorize")
def authorize(current_user: User = Depends(get_current_user)):
    flow = make_flow()
    state = _make_state_token(current_user.id)
    auth_url, _ = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
        state=state,
    )
    # Capture whatever code_verifier the library may have generated so we
    # can pass it back during token exchange in /callback.
    _pending_verifiers[state] = getattr(flow, "code_verifier", None)
    return {"auth_url": auth_url}

@router.get("/callback")
def callback(code: str, state: str, db: Session = Depends(get_db)):
    user_id = _decode_state_token(state)

    try:
        flow = make_flow()

        # Restore the code_verifier (may be None if PKCE wasn't used).
        code_verifier = _pending_verifiers.pop(state, None)
        if code_verifier is not None:
            flow.code_verifier = code_verifier

        flow.fetch_token(code=code)
        credentials = flow.credentials

        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        user.google_tokens = json.dumps({
            "token": credentials.token,
            "refresh_token": credentials.refresh_token,
            "token_uri": credentials.token_uri,
            "client_id": credentials.client_id,
            "scopes": list(credentials.scopes or []),
        })
        db.commit()

        return RedirectResponse(url=f"{config.FRONTEND_URL}/dashboard?google=connected")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
