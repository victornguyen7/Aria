import requests
import json

# Test the login endpoint
BASE_URL = "http://localhost:8000"

# Test data
login_data = {
    "email": "test@example.com",
    "password": "TestPass123!"
}

print("Testing login endpoint...")
print(f"POST {BASE_URL}/auth/login")
print(f"Body: {json.dumps(login_data, indent=2)}")
print("-" * 50)

try:
    response = requests.post(f"{BASE_URL}/auth/login", json=login_data)
    print(f"Status Code: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}")
    
    if response.status_code == 200:
        print("\n✅ Login successful!")
        token = response.json().get("access_token")
        print(f"Token: {token[:50]}...")
    else:
        print(f"\n❌ Login failed!")
        
except Exception as e:
    print(f"❌ Error: {e}")
    print("Make sure the backend is running on http://localhost:8000")
