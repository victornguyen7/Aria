from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from groq import Groq 
from groq.types.chat import ChatCompletionMessageParam
from database import get_db
from routers.auth import get_current_user
from models.user import User
from services.context import build_user_context
from services.prompt import build_system_prompt
from config import config
from typing import Generator, Literal, cast
import json

router = APIRouter(prefix="/chat", tags=["chat"])

client = Groq(api_key=config.GROQ_API_KEY)

class ChatHistoryMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str

class ChatMessage(BaseModel):
    message: str
    history: list[ChatHistoryMessage] = []


def stream_chat_response(messages: list[ChatCompletionMessageParam]) -> Generator[bytes, None, None]: 

    
    response = client.chat.completions.create(
        model=config.GROQ_MODEL,
        messages=messages,
        stream=True
    )
    for chunk in response:
        # In streaming, the content is in delta, not message
        if chunk.choices and chunk.choices[0].delta and chunk.choices[0].delta.content:
            data = f"data: {json.dumps({'content': chunk.choices[0].delta.content})}\n\n"
            yield data.encode('utf-8')

@router.post("/stream")
def chat_stream_endpoint(chat_message: ChatMessage, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    user_context = build_user_context(user, db)
    system_prompt = build_system_prompt(user_context)
    
    messages = [
        {"role": "system", "content": system_prompt}
    ]
    
    # Add chat history (last 10 messages)
    if chat_message.history:
        messages.extend(
            {"role": m.role, "content": m.content}
            for m in chat_message.history[-10:]
        )
    
    # Add current user message
    messages.append({"role": "user", "content": chat_message.message})

    return StreamingResponse(stream_chat_response(cast(list[ChatCompletionMessageParam], messages)), media_type="text/event-stream")

@router.post("/message")
def chat_message_endpoint(chat_message: ChatMessage, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    user_context = build_user_context(user, db)
    system_prompt = build_system_prompt(user_context)

    messages = [
        {"role": "system", "content": system_prompt}
    ]

    # Add chat history (last 10 messages)
    if chat_message.history:
        messages.extend(
            {"role": m.role, "content": m.content}
            for m in chat_message.history[-10:]
        )

    # Add current user message
    messages.append({"role": "user", "content": chat_message.message})

    response = client.chat.completions.create(
        model=config.GROQ_MODEL,
        messages=cast(list[ChatCompletionMessageParam], messages),
        max_tokens=1000
    )
    
    # Return the complete message (non-streaming)
    return {
        "response": response.choices[0].message.content,
        "status": "success",
        "role": "assistant"
    }