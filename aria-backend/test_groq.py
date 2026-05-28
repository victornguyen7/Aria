from dotenv import load_dotenv
from pathlib import Path

# Load .env.local first (if it exists), then fall back to .env
env_local_path = Path(__file__).parent / ".env.local"
if env_local_path.exists():
    load_dotenv(env_local_path)
else:
    load_dotenv()

import os
from groq import Groq

client = Groq(api_key=os.getenv("GROQ_API_KEY"))

response = client.chat.completions.create(
    model="llama-3.3-70b-versatile",
    messages=[
        {
            "role": "user",
            "content": "Hello, world!"
        }
    ]
)

print(response.choices[0].message.content)