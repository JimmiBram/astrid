// ----- WebSocket setup -----
const ws = new WebSocket((location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/ws");

// Add debugging for WebSocket connection
ws.onopen = () => {
    console.log("WebSocket connected successfully");
    ws.send(JSON.stringify({type:"request_state"}));
};

ws.onerror = (error) => {
    console.error("WebSocket error:", error);
};

ws.onclose = (event) => {
    console.log("WebSocket closed:", event.code, event.reason);
};

const els = {
  headline: document.getElementById("headline"),
  stellardate: document.getElementById("stellardate"),
  pulse: document.getElementById("pulse"),
  eve: document.getElementById("eve"),
  batteryPct: document.getElementById("batteryPct"),
  loadW: document.getElementById("loadW"),
  sunW: document.getElementById("sunW"),
  loadDots: document.getElementById("loadDots"),
  sunDots: document.getElementById("sunDots"),
  topLine: document.getElementById("topLine"),
  typed: document.getElementById("typed"),
  cursor: document.getElementById("cursor"),
};

let typing = false;        // true while bot text is animating
let userTyping = false;    // true while user is entering text
let userBuffer = "";       // current user-typed text

// TTS setup
let speechSynthesis = window.speechSynthesis;
let selectedVoice = null;

// Initialize TTS with the best available female English voice
function initializeTTS() {
    // Wait for voices to load
    speechSynthesis.onvoiceschanged = () => {
        const voices = speechSynthesis.getVoices();
        console.log('Available voices:', voices.map(v => `${v.name} (${v.lang}) - ${v.default ? 'DEFAULT' : ''}`));
        
        // Hardcode UK English Female voice
        selectedVoice = voices.find(voice => 
            voice.name.includes('Google UK English Female') && voice.lang.startsWith('en')
        ) || voices.find(voice => 
            voice.name.includes('UK English Female') && voice.lang.startsWith('en')
        ) || voices.find(voice => 
            voice.name.includes('Female') && voice.lang.startsWith('en-GB')
        );
        
        if (selectedVoice) {
            console.log('Selected TTS voice:', selectedVoice.name, selectedVoice.lang);
        } else {
            console.log('UK English Female voice not found, using default');
            // Fallback to any English female voice
            selectedVoice = voices.find(voice => 
                voice.lang.startsWith('en') && voice.name.toLowerCase().includes('female')
            ) || voices.find(voice => 
                voice.lang.startsWith('en')
            );
        }
        
        // Force a voice change by updating the TTS controls
        updateVoiceDisplay();
    };
    
    // Trigger voices loading
    speechSynthesis.getVoices();
    
    // Also try to get voices immediately in case they're already loaded
    const immediateVoices = speechSynthesis.getVoices();
    if (immediateVoices.length > 0) {
        console.log('Immediate voices available:', immediateVoices.map(v => `${v.name} (${v.lang})`));
    }
}

// Function to speak text with high quality
function speakText(text, options = {}) {
    if (!speechSynthesis || !selectedVoice) return;
    
    // Stop any current speech
    speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = selectedVoice;
    utterance.rate = options.rate || 0.9; // Slightly slower for clarity
    utterance.pitch = options.pitch || 1.0; // Natural pitch
    utterance.volume = options.volume || 0.8; // Good volume
    utterance.lang = 'en-GB'; // British English for better quality
    
    speechSynthesis.speak(utterance);
}

// Function to stop TTS
function stopTTS() {
    if (speechSynthesis) {
        speechSynthesis.cancel();
    }
}

// Initialize TTS when page loads
initializeTTS();

// Function to display initial greeting when page loads
function displayInitialGreeting() {
  // Wait a moment for the page to fully load, then show greeting
  setTimeout(() => {
    if (!typing && !userTyping) {
      typeText("Hello! Welcome to BRAM HOUSE. I'm ASTRID, your AI assistant. How may I help you today?", "cyan", 25);
    }
  }, 1000);
}

// Build dot columns (10 each)
function buildDots(container) {
  container.innerHTML = "";
  for (let i = 0; i < 10; i++) {
    const d = document.createElement("div");
    d.className = "dot";
    container.appendChild(d);
  }
}
buildDots(els.loadDots);
buildDots(els.sunDots);

function setDotFill(container, pct) {
  // pct 0..1
  const dots = [...container.querySelectorAll(".dot")];
  const lit = Math.round(pct * dots.length);
  dots.forEach((d, i) => d.classList.toggle("active", i < lit));
}

function clamp01(x){ return Math.max(0, Math.min(1, x)); }

// Typewriter effect with TTS
async function typeText(text, colorClass="cyan", cps=20) {
  typing = true;
  els.typed.classList.remove("white","cyan");
  els.typed.classList.add(colorClass);
  els.typed.textContent = "";
  els.cursor.style.display = "none"; // Hide the CSS cursor since we're using text-based cursor
  
  // Split text into words for coordinated display
  const words = text.split(' ');
  let currentText = '';
  
  console.log('Starting TTS with words:', words);
  
  // Create utterance for the full text
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = selectedVoice;
  utterance.rate = 1; // Slightly slower for more natural, seductive pace
  utterance.pitch = 1.2; // Slightly lower pitch for more mature, attractive sound
  utterance.volume = 0.9; // Slightly higher volume for presence
  utterance.lang = 'en-US'; // US English for more natural Scarlett-like accent
  
  // Start speaking immediately
  speechSynthesis.speak(utterance);
  
  // Calculate timing based on speech rate and text length
  // Rate 0.9 means speech is 90% of normal speed
  const baseTimePerWord = 250; // Reduced from 400ms to 250ms for better sync
  const adjustedTimePerWord = baseTimePerWord / 0.9; // Adjust for speech rate
  
  // Display words progressively to match speech timing
  for (let i = 0; i < words.length; i++) {
    if (userTyping) { // user interrupted
      els.typed.textContent = "";
      typing = false;
      return;
    }
    
    // Wait for the calculated time for this word
    await new Promise(r => setTimeout(r, adjustedTimePerWord));
    
    // Add the word with a space (except for first word)
    if (i === 0) {
      currentText = words[i];
    } else {
      currentText += ' ' + words[i];
    }
    
    els.typed.textContent = currentText;
    console.log('Displayed word:', words[i], 'at index:', i);
  }
  
  typing = false;
  // Add text-based cursor at the end
  addTextCursor();
}

// Function to add a text-based cursor at the end of the text
function addTextCursor() {
  const cursorSpan = document.createElement('span');
  cursorSpan.className = 'text-cursor';
  cursorSpan.textContent = '█'; // Block character for cursor
  cursorSpan.style.color = 'var(--cyan)';
  cursorSpan.style.animation = 'blink 1s steps(1,end) infinite';
  
  // Clear any existing text cursor
  const existingCursor = els.typed.querySelector('.text-cursor');
  if (existingCursor) {
    existingCursor.remove();
  }
  
  // Add the new cursor
  els.typed.appendChild(cursorSpan);
}

// Function to remove the text-based cursor
function removeTextCursor() {
  const existingCursor = els.typed.querySelector('.text-cursor');
  if (existingCursor) {
    existingCursor.remove();
  }
}

// Add TTS controls to the page
function addTTSControls() {
    const controlsDiv = document.createElement('div');
    controlsDiv.id = 'tts-controls';
    controlsDiv.style.cssText = `
        background: rgba(11, 15, 18, 0.9);
        border: 2px solid var(--hud);
        border-radius: 10px;
        padding: 15px;
        color: var(--cyan);
        font-family: 'Orbitron', monospace;
        font-size: 14px;
        margin-top: 20px;
        backdrop-filter: blur(10px);
        flex-shrink: 0;
    `;
    
    controlsDiv.innerHTML = `
        <div style="margin-bottom: 10px; font-weight: bold;">ASTRID TTS Controls</div>
        <div style="margin-bottom: 8px;">
            <button id="tts-toggle" style="background: var(--hud); color: var(--bg); border: none; padding: 5px 10px; border-radius: 5px; cursor: pointer; margin-right: 5px;">Disable TTS</button>
            <button id="tts-stop" style="background: var(--hud-dim); color: var(--bg); border: none; padding: 5px 10px; border-radius: 5px; cursor: pointer;">Stop Speech</button>
        </div>
        <div style="font-size: 12px; opacity: 0.8;">
            <div>Shortcuts: Space = Stop</div>
        </div>
    `;
    
    // Insert the controls after the power module
    const powerModule = document.querySelector('.power');
    if (powerModule) {
        powerModule.appendChild(controlsDiv);
    } else {
        // Fallback: append to body if power module not found
        document.body.appendChild(controlsDiv);
    }
    
    // Add event listeners
    document.getElementById('tts-toggle').addEventListener('click', toggleTTS);
    document.getElementById('tts-stop').addEventListener('click', stopTTS);
    
    // Update voice display
    updateVoiceDisplay();
}

// Toggle TTS on/off
let ttsEnabled = true;
function toggleTTS() {
    ttsEnabled = !ttsEnabled;
    const button = document.getElementById('tts-toggle');
    button.textContent = ttsEnabled ? 'Disable TTS' : 'Enable TTS';
    button.style.background = ttsEnabled ? 'var(--hud)' : 'var(--hud-dim)';
    
    if (!ttsEnabled) {
        stopTTS();
    }
}

// Update voice display
function updateVoiceDisplay() {
    if (selectedVoice) {
        console.log('TTS voice set to:', selectedVoice.name, selectedVoice.lang);
    } else {
        console.log('No TTS voice selected');
    }
}

// Add keyboard shortcuts
document.addEventListener("keydown", (ev) => {
  // TTS shortcuts (only when not typing)
  if (!userTyping && !typing) {
    if (ev.code === 'Space') {
      ev.preventDefault();
      stopTTS();
      return;
    } else if (ev.code === 'KeyT' && ev.ctrlKey) {
      ev.preventDefault();
      toggleTTS();
      return;
    }
  }
  
  // User input handling
  console.log("Key pressed:", ev.key, "userTyping:", userTyping, "typing:", typing);
  
  // Ignore while bot is typing; user can interrupt though
  if (!userTyping) {
    // user starts typing: clear center, switch to white text
    userTyping = true;
    userBuffer = "";
    els.typed.textContent = "";
    els.typed.classList.remove("cyan");
    els.typed.classList.add("white");
    els.cursor.style.display = "none"; // Hide CSS cursor
    
    // Stop any current TTS when user interrupts
    if (speechSynthesis) {
      speechSynthesis.cancel();
    }
    
    console.log("User started typing");
  }

  if (ev.key === "Enter") {
    // Send to server, move to small top line
    const txt = userBuffer.trim();
    userTyping = false;
    console.log("Enter pressed, sending message:", txt);
    if (txt.length > 0) {
      const message = {type:"user_message", text: txt};
      console.log("Sending WebSocket message:", message);
      ws.send(JSON.stringify(message));
    }
    // leave only the blinking cursor in center until bot reply
    els.typed.textContent = "";
    removeTextCursor(); // Remove any text cursor
    return;
  }
  if (ev.key === "Backspace") {
    userBuffer = userBuffer.slice(0, -1);
  } else if (ev.key.length === 1) {
    userBuffer += ev.key;
  } else {
    return;
  }
  els.typed.textContent = userBuffer;
  
  // Add text cursor at end of user text
  addTextCursor();
});

// Initialize TTS controls
addTTSControls();

// Display initial greeting when page loads
displayInitialGreeting();

// Format "StellarDate" like 202.508.26 for 2025-08-26
function formatStellarDate(d) {
  const yyyy = String(d.getFullYear());
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  return `${yyyy.slice(0,3)}.${yyyy.slice(3)}${mm}.${dd}`;
}
// Pulse as HH.MM (from 14:35 -> 14.35)
function formatPulse(d) {
  const hh = String(d.getHours()).padStart(2,"0");
  const mm = String(d.getMinutes()).padStart(2,"0");
  return `${hh}.${mm}`;
}

// Tick clock
function tickClock(){
  const now = new Date();
  els.stellardate.textContent = formatStellarDate(now);
  els.pulse.textContent = formatPulse(now);
}
tickClock();
setInterval(tickClock, 1000*15);


// Apply full state update
function applyState(s){
  els.headline.textContent = s.headline || "BRAM HOUSE";
  els.eve.textContent = s.eve || "EVE";
  els.batteryPct.textContent = `${Math.round(s.battery_pct)}%`;
  els.loadW.textContent = `${Math.round(s.load_w)}W`;
  els.sunW.textContent  = `${Math.round(s.sun_w)}W`;
  els.topLine.textContent = s.last_user_line || "";

  const lp = clamp01((s.load_w - s.load_min_w) / Math.max(1, (s.load_max_w - s.load_min_w)));
  const sp = clamp01((s.sun_w  - s.sun_min_w ) / Math.max(1, (s.sun_max_w  - s.sun_min_w )));
  setDotFill(els.loadDots, lp);
  setDotFill(els.sunDots, sp);
}

// WebSocket events
ws.onmessage = async (ev) => {
  console.log("WebSocket message received:", ev.data);
  const msg = JSON.parse(ev.data);
  console.log("Parsed message:", msg);
  
  if (msg.type === "state"){
    console.log("Applying state update");
    applyState(msg.data);
  } else if (msg.type === "user_line"){
    console.log("Updating user line:", msg.text);
    els.topLine.textContent = msg.text || "";
  } else if (msg.type === "clear_center"){
    console.log("Clearing center");
    els.typed.textContent = "";
    removeTextCursor(); // Remove any text cursor
  } else if (msg.type === "bot_reply"){
    console.log("Bot reply received:", msg.text);
    // When bot reply arrives, animate in cyan
    userTyping = false;
    await typeText(msg.text || "", "cyan", 28);
    // Text cursor is already added by typeText function
  }
};