#import fastapi and CorsMiddleware, allowing frontend to communicate with backend
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from sqlalchemy.exc import SQLAlchemyError
from database import SessionLocal
from database import Base, engine
import models.user
import models.task
import models.event
import models.course
from routers.auth import router as auth_router
from routers.tasks import router as tasks_router
from routers.events import router as events_router
from routers.courses import router as courses_router
from routers.chat import router as chat_router
from routers.briefing import router as briefing_router
from routers.google import router as google_router
from routers.calendar import router as calendar_router
from routers.canvas import router as canvas_router
from config import config
import os
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

if not config.IS_PRODUCTION:
    os.environ["OAUTHLIB_INSECURE_TRANSPORT"] = "1"

Base.metadata.create_all(bind=engine)  # creates tables on startup

app = FastAPI(title = "Aria API")

_origins = [
    "http://localhost:5173",
    "http://localhost:4173",
    "https://aria-flame-nine.vercel.app",
]
if config.IS_PRODUCTION:
    frontend = os.getenv("FRONTEND_ORIGIN", "")
    if frontend:
        _origins.append(frontend)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
#this will help the frontend sever (localhsot: 5173) communicate with the backend sever
#(localhost: 8080) and use api methods, get, post, requests,...

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = jsonable_encoder(exc.errors(include_url=False))
    logger.error(f"Validation error: {errors}")
    return JSONResponse(status_code=400, content={"detail": errors})

@app.exception_handler(SQLAlchemyError)
async def sqlalchemy_exception_handler(request: Request, exc: SQLAlchemyError):
    logger.error(f"SQLAlchemy error: {exc}")
    # Note: session rollback is best handled in get_db's except block
    return JSONResponse(status_code=500, content={"detail": "Internal Server Error"})

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unexpected error: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error"},
    )

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})

app.include_router(auth_router)
app.include_router(tasks_router)
app.include_router(events_router)
app.include_router(courses_router)
app.include_router(chat_router)
app.include_router(briefing_router)
app.include_router(google_router)
app.include_router(calendar_router)
app.include_router(canvas_router)

@app.get("/health")
def health():
    return {"status" : "ok"}
#one simple endpoint api created to test the server