from __future__ import annotations

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
import asyncio
from datetime import datetime, timedelta
import random
import importlib.resources as resources
from pathlib import Path


# Resolve packaged asset directories
pkg_root = resources.files(__package__)
static_dir = str(pkg_root / "static")
templates_dir = str(pkg_root / "templates")


app = FastAPI()

app.mount("/static", StaticFiles(directory=static_dir), name="static")
templates = Jinja2Templates(directory=templates_dir)


class HudState(BaseModel):
    headline: str = "BRAM HOUSE"
    eve: str = "EVE"                            # 3-char house status
    battery_pct: float = 76.0                   # 0..100
    load_w: float = 1344.0
    sun_w: float = 8000.0
    load_min_w: float = 0.0
    load_max_w: float = 5000.0
    sun_min_w: float = 0.0
    sun_max_w: float = 8000.0

    # "Small text" (last user message) shown at the top of the big box
    last_user_line: str = "HELLO ASTRID, HOW ARE MY RESERVE WATER LEVELS?"

    # When you POST a bot reply, clients will type it out with a cursor
    bot_reply_pending: Optional[str] = None


STATE = HudState()


class StatefulController:
    """A stateful controller that maintains conversation context and intelligently responds to user input."""

    def __init__(self):
        self.conversation_history = []
        self.user_preferences = {}
        self.system_status = {
            "last_maintenance": datetime.now() - timedelta(days=7),
            "alerts": [],
            "mode": "normal",
        }
        self.response_patterns = {
            "greeting": [
                "Greetings, human. How may I assist you today?",
                "Hello there. What would you like to know about your systems?",
                "ASTRID online and ready. What's your query?",
            ],
            "status": [
                "Current system status: All systems operational.",
                "Status check complete. Everything is running within normal parameters.",
                "Systems are functioning at optimal levels.",
            ],
            "power": [
                "Power consumption is currently at {load_w}W with {sun_w}W solar generation.",
                "Your power grid shows {load_w}W load against {sun_w}W solar input.",
                "Power status: {battery_pct}% battery, {load_w}W consumption, {sun_w}W generation.",
            ],
            "battery": [
                "Battery capacity is at {battery_pct}%.",
                "Your energy storage shows {battery_pct}% remaining.",
                "Battery status: {battery_pct}% capacity available.",
            ],
            "unknown": [
                "I'm not sure I understand that query. Could you rephrase?",
                "That's outside my current knowledge base. Try asking about power, battery, or system status.",
                "I need more context to help you with that request.",
            ],
        }

    def add_to_history(self, user_message: str, bot_response: str):
        """Add a message exchange to conversation history."""
        self.conversation_history.append(
            {"timestamp": datetime.now(), "user": user_message, "bot": bot_response}
        )
        # Keep only last 20 exchanges
        if len(self.conversation_history) > 20:
            self.conversation_history.pop(0)

    def analyze_message(self, message: str) -> Dict[str, Any]:
        """Analyze user message to determine intent and extract relevant information."""
        message_lower = message.lower().strip()

        # Check for greetings
        if any(word in message_lower for word in ["hello", "hi", "hey", "greetings"]):
            return {"intent": "greeting", "confidence": 0.9}

        # Check for status queries
        if any(word in message_lower for word in ["status", "how", "what", "condition", "state"]):
            return {"intent": "status", "confidence": 0.8}

        # Check for power-related queries
        if any(
            word in message_lower for word in ["power", "electricity", "watt", "consumption", "generation"]
        ):
            return {"intent": "power", "confidence": 0.85}

        # Check for battery queries
        if any(
            word in message_lower for word in ["battery", "capacity", "charge", "energy", "storage"]
        ):
            return {"intent": "battery", "confidence": 0.9}

        # Check for water-related queries (from original message)
        if any(word in message_lower for word in ["water", "reserve", "level", "tank"]):
            return {"intent": "water", "confidence": 0.7}

        # Check for maintenance queries
        if any(word in message_lower for word in ["maintenance", "service", "check", "inspect"]):
            return {"intent": "maintenance", "confidence": 0.8}

        return {"intent": "unknown", "confidence": 0.3}

    def generate_response(self, message: str, intent: str) -> str:
        """Generate an appropriate response based on intent and current state."""
        if intent == "greeting":
            return random.choice(self.response_patterns["greeting"])

        elif intent == "status":
            return random.choice(self.response_patterns["status"])

        elif intent == "power":
            template = random.choice(self.response_patterns["power"])
            return template.format(
                load_w=int(STATE.load_w),
                sun_w=int(STATE.sun_w),
                battery_pct=int(STATE.battery_pct),
            )

        elif intent == "battery":
            template = random.choice(self.response_patterns["battery"])
            return template.format(battery_pct=int(STATE.battery_pct))

        elif intent == "water":
            return "I don't have access to water system sensors at the moment. My current monitoring is limited to power systems."

        elif intent == "maintenance":
            days_since = (datetime.now() - self.system_status["last_maintenance"]).days
            if days_since > 30:
                return f"System maintenance is overdue by {days_since - 30} days. Recommend scheduling a service check."
            else:
                days_until = 30 - days_since
                return f"Last maintenance was {days_since} days ago. Next scheduled maintenance in {days_until} days."

        else:
            return random.choice(self.response_patterns["unknown"])

    def process_message(self, message: str) -> str:
        """Process a user message and return an appropriate response."""
        # Analyze the message
        analysis = self.analyze_message(message)
        intent = analysis["intent"]

        # Generate response
        response = self.generate_response(message, intent)

        # Add to history
        self.add_to_history(message, response)

        return response


# Initialize the stateful controller
controller = StatefulController()


class ConnectionManager:
    def __init__(self) -> None:
        self.active: List[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.append(ws)
        await self.send_state(ws)

    def disconnect(self, ws: WebSocket):
        if ws in self.active:
            self.active.remove(ws)

    async def broadcast(self, message: Dict[str, Any]):
        living = []
        for ws in self.active:
            try:
                await ws.send_json(message)
                living.append(ws)
            except Exception:
                pass
        self.active = living

    async def send_state(self, ws: WebSocket):
        await ws.send_json({"type": "state", "data": STATE.dict()})


manager = ConnectionManager()


@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


@app.get("/test", response_class=HTMLResponse)
async def test_websocket(request: Request):
    # Use packaged example template for test page
    test_path = Path(templates_dir) / "gui_test.html"
    if test_path.exists():
        content = test_path.read_text(encoding="utf-8")
        return HTMLResponse(content=content)
    return HTMLResponse(content="<h1>Test page not found</h1>", status_code=404)


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    print(f"WebSocket connection attempt from {ws.client.host}:{ws.client.port}")
    await manager.connect(ws)
    print(f"WebSocket connected successfully. Total connections: {len(manager.active)}")
    try:
        while True:
            msg = await ws.receive_json()
            print(f"Received WebSocket message: {msg}")
            mtype = msg.get("type")

            # User finished typing and pressed Enter
            if mtype == "user_message":
                user_text = (msg.get("text") or "").strip()
                print(f"Processing user message: '{user_text}'")
                if user_text:
                    STATE.last_user_line = user_text
                    # Tell everyone to update the small line
                    await manager.broadcast({"type": "user_line", "text": STATE.last_user_line})
                    # Show only a blinking cursor in the center until a bot reply arrives
                    await manager.broadcast({"type": "clear_center"})

                    # Process the message through the stateful controller
                    bot_response = controller.process_message(user_text)
                    print(f"Bot response: '{bot_response}'")

                    # Send the bot response after a short delay to simulate thinking
                    await asyncio.sleep(1.5)
                    await manager.broadcast({"type": "bot_reply", "text": bot_response})
                    print(f"Bot reply sent to {len(manager.active)} clients")

            # A client asks for a fresh copy of the full state
            elif mtype == "request_state":
                print("State request received")
                await manager.send_state(ws)
            else:
                print(f"Unknown message type: {mtype}")
    except WebSocketDisconnect:
        print(f"WebSocket disconnected. Total connections: {len(manager.active)}")
        manager.disconnect(ws)
    except Exception as e:
        print(f"WebSocket error: {e}")
        manager.disconnect(ws)


class StateUpdate(BaseModel):
    headline: Optional[str] = None
    eve: Optional[str] = Field(None, min_length=1, max_length=3)
    battery_pct: Optional[float] = None
    load_w: Optional[float] = None
    sun_w: Optional[float] = None
    load_min_w: Optional[float] = None
    load_max_w: Optional[float] = None
    sun_min_w: Optional[float] = None
    sun_max_w: Optional[float] = None
    last_user_line: Optional[str] = None


@app.get("/api/state")
async def get_state():
    return STATE


@app.put("/api/state")
async def update_state(update: StateUpdate):
    upd = update.dict(exclude_unset=True)
    for k, v in upd.items():
        setattr(STATE, k, v)
    await manager.broadcast({"type": "state", "data": STATE.dict()})
    return {"ok": True}


class BotReply(BaseModel):
    text: str


@app.post("/api/bot_reply")
async def bot_reply(payload: BotReply):
    STATE.bot_reply_pending = payload.text
    # push a "bot_reply" event; clients type it out
    await manager.broadcast({"type": "bot_reply", "text": STATE.bot_reply_pending})
    STATE.bot_reply_pending = None
    return {"ok": True}


# New endpoints for the stateful controller
@app.get("/api/controller/history")
async def get_conversation_history():
    """Get the conversation history from the controller."""
    return {
        "history": controller.conversation_history,
        "total_exchanges": len(controller.conversation_history),
    }


@app.get("/api/controller/status")
async def get_controller_status():
    """Get the current status of the controller."""
    return {
        "system_status": controller.system_status,
        "user_preferences": controller.user_preferences,
        "active_patterns": len(controller.response_patterns),
    }


@app.post("/api/controller/process")
async def process_message_directly(payload: BotReply):
    """Process a message directly through the controller (for testing)."""
    response = controller.process_message(payload.text)
    return {"response": response, "intent": controller.analyze_message(payload.text)}


def main():
    """Run the development server via CLI script."""
    import uvicorn

    uvicorn.run("astrid.main:app", host="127.0.0.1", port=8000, reload=True)
