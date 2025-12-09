
import os
import sys

# Ensure DB does not exist BEFORE importing app
if os.path.exists("dashboard.db"):
    os.remove("dashboard.db")

# Now import app, which should trigger init_db()
from app import app
import json

# Check if DB was created
if not os.path.exists("dashboard.db"):
    print("Error: dashboard.db was not created on import")
    sys.exit(1)
else:
    print("Success: dashboard.db was created on import")

# Create a test client
client = app.test_client()

# Try to create a query
data = {
    "name": "Test Query",
    "keywords": ["test"],
    "prompts": {"Español": "Test prompt"},
    "models": ["test-model"]
}

try:
    response = client.post('/api/queries', 
                          data=json.dumps(data),
                          content_type='application/json')
    
    print(f"Status Code: {response.status_code}")
    if response.status_code == 201:
        print("Success: Query created")
    else:
        print(f"Failed with status: {response.status_code}")
        print(response.data)
except Exception as e:
    print(f"Exception: {e}")
