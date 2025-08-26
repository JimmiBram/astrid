# astrid
A very simplistic AI assistant with personality for everywhere and everything

# how to run it
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload

Open: http://localhost:8000


Update values live:
# Example: set battery, watts, min/max, headline, EVE
curl -X PUT http://localhost:8000/api/state \
  -H "content-type: application/json" \
  -d '{
    "headline":"BRAM HOUSE",
    "eve":"EVE",
    "battery_pct":76,
    "load_w":1344, "load_min_w":0, "load_max_w":5000,
    "sun_w":8000,  "sun_min_w":0, "sun_max_w":8000
  }'

Bot reply:
curl -X POST http://localhost:8000/api/bot_reply \
  -H "content-type: application/json" \
  -d '{"text":"GOOD EVENING FAMILY,\nNIGHT MODE ACTIVATED"}'
