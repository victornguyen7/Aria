from dotenv import load_dotenv
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