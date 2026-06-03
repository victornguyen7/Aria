#import fastapi and CorsMiddleware, allowing frontend to communicate with backend
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
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
import os

os.environ["OAUTHLIB_INSECURE_TRANSPORT"] = "1"

Base.metadata.create_all(bind=engine)  # creates tables on startup

app = FastAPI(title = "Aria API")

app.add_middleware(
    CORSMiddleware,
    allow_origins = ["http://localhost:5173"],
    allow_credentials = True,
    allow_methods = ["*"],
    allow_headers = ["*"],
)
#this will help the frontend sever (localhsot: 5173) communicate with the backend sever
#(localhost: 8080) and use api methods, get, post, requests,...

app.include_router(auth_router)
app.include_router(tasks_router)
app.include_router(events_router)
app.include_router(courses_router)
app.include_router(chat_router)
app.include_router(briefing_router)
app.include_router(google_router)
app.include_router(calendar_router)

@app.get("/health")
def health():
    return {"status" : "ok"}
#one simple endpoint api created to test the server