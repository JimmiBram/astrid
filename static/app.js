// ----- WebSocket setup -----
const ws = new WebSocket((location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/ws");

// Connection status tracking
let isConnected = false;
let offlineStartTime = null;
let reconnectInterval = null;

// Create offline popup overlay
let offlinePopup = null;

// Create size warning popup overlay
let sizeWarningPopup = null;

// Minimum page dimensions
const MIN_WIDTH = 1267;
const MIN_HEIGHT = 850;

// Function to check page size and show warning if needed
function checkPageSize() {
    const currentWidth = window.innerWidth;
    const currentHeight = window.innerHeight;
    
    // Show warning if EITHER width or height is below the minimum
    if (currentWidth < MIN_WIDTH || currentHeight < MIN_HEIGHT) {
        showSizeWarningPopup();
    } else {
        hideSizeWarningPopup();
    }
}

// Function to show size warning popup
function showSizeWarningPopup() {
    if (sizeWarningPopup) return; // Already showing
    
    sizeWarningPopup = document.createElement('div');
    sizeWarningPopup.id = 'size-warning-popup';
    sizeWarningPopup.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.9);
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        z-index: 9998;
        font-family: 'Orbitron', monospace;
        color: var(--cyan);
    `;
    
    sizeWarningPopup.innerHTML = `
        <div style="text-align: center;">
            <div style="font-size: 2.5rem; font-weight: bold; margin-bottom: 1rem; color: #ffaa00;">BROWSER WINDOW TOO SMALL</div>
            <div style="font-size: 1.5rem; margin-bottom: 2rem;">ASTRID requires at least 1267x850 pixels</div>
            <div style="font-size: 1.2rem; margin-bottom: 1rem;">Current size: ${window.innerWidth}x${window.innerHeight}</div>
            <div style="font-size: 1rem; margin-top: 1rem; opacity: 0.7;">Please resize your browser window</div>
        </div>
    `;
    
    document.body.appendChild(sizeWarningPopup);
}

// Function to hide size warning popup
function hideSizeWarningPopup() {
    if (sizeWarningPopup) {
        sizeWarningPopup.remove();
        sizeWarningPopup = null;
    }
}

// Function to show offline popup
function showOfflinePopup() {
    if (offlinePopup) return; // Already showing
    
    offlinePopup = document.createElement('div');
    offlinePopup.id = 'offline-popup';
    offlinePopup.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.9);
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        z-index: 9999;
        font-family: 'Orbitron', monospace;
        color: var(--cyan);
    `;
    
    offlinePopup.innerHTML = `
        <div style="text-align: center;">
            <div style="font-size: 3rem; font-weight: bold; margin-bottom: 1rem; color: #ff4444;">ASTRID OFFLINE</div>
            <div style="font-size: 1.5rem; margin-bottom: 2rem;">Reconnecting...</div>
            <div style="font-size: 2rem; font-weight: bold;" id="offline-counter">0</div>
            <div style="font-size: 1rem; margin-top: 1rem; opacity: 0.7;">seconds offline</div>
        </div>
    `;
    
    document.body.appendChild(offlinePopup);
    
    // Start the counter
    updateOfflineCounter();
}

// Function to hide offline popup
function hideOfflinePopup() {
    if (offlinePopup) {
        offlinePopup.remove();
        offlinePopup = null;
    }
}

// Function to update offline counter
function updateOfflineCounter() {
    if (!offlinePopup || !offlineStartTime) return;
    
    const counterElement = document.getElementById('offline-counter');
    if (counterElement) {
        const secondsOffline = Math.floor((Date.now() - offlineStartTime) / 1000);
        counterElement.textContent = secondsOffline;
    }
    
    // Continue updating every second if still offline
    if (!isConnected) {
        setTimeout(updateOfflineCounter, 1000);
    }
}

// Add debugging for WebSocket connection
ws.onopen = () => {
    console.log("WebSocket connected successfully");
    isConnected = true;
    offlineStartTime = null;
    hideOfflinePopup();
    ws.send(JSON.stringify({type:"request_state"}));
};

ws.onerror = (error) => {
    console.error("WebSocket error:", error);
    if (!isConnected) {
        showOfflinePopup();
    }
};

ws.onclose = (event) => {
    console.log("WebSocket closed:", event.code, event.reason);
    isConnected = false;
    offlineStartTime = Date.now();
    showOfflinePopup();
    
    // Try to reconnect every 5 seconds
    if (reconnectInterval) {
        clearInterval(reconnectInterval);
    }
    reconnectInterval = setInterval(() => {
        if (!isConnected) {
            console.log("Attempting to reconnect...");
            location.reload();
        }
    }, 5000);
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

// Function to apply responsive scaling
function applyResponsiveScaling() {
    const currentWidth = window.innerWidth;
    const currentHeight = window.innerHeight;
    
    // Calculate scale factors for both directions
    const scaleX = currentWidth / MIN_WIDTH;
    const scaleY = currentHeight / MIN_HEIGHT;
    const scale = Math.min(scaleX, scaleY); // Use the smaller scale to fit both dimensions
    
    // Apply scaling to the main container
    const hudWrap = document.querySelector('.hud-wrap');
    if (hudWrap) {
        // Apply scaling and centering in one clean transform
        hudWrap.style.transform = `translate(-50%, -50%) scale(${scale})`;
        hudWrap.style.width = `${MIN_WIDTH}px`;
        hudWrap.style.height = `${MIN_HEIGHT}px`;
        
        // Center the content
        hudWrap.style.position = 'absolute';
        hudWrap.style.left = '50%';
        hudWrap.style.top = '50%';
        
        // Update the size warning popup if it exists
        if (sizeWarningPopup) {
            const currentSizeText = sizeWarningPopup.querySelector('div:nth-child(3)');
            if (currentSizeText) {
                currentSizeText.textContent = `Current size: ${currentWidth}x${currentHeight}`;
            }
        }
    }
}

// Add window resize event listener
window.addEventListener('resize', () => {
    checkPageSize();
    applyResponsiveScaling();
});

// Check initial page size and apply scaling
checkPageSize();
applyResponsiveScaling();

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
      // toggleTTS(); // This function is removed, so this line is removed
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

// Display initial greeting when page loads
displayInitialGreeting();

// Add periodic connection check - more conservative approach
setInterval(() => {
    if (!isConnected && ws.readyState === WebSocket.OPEN) {
        // Don't refresh immediately - wait for actual server communication
        console.log("WebSocket appears open but marked as disconnected - waiting for server response");
    }
}, 2000); // Check every 2 seconds

// Handle page visibility changes (user switching tabs) - more conservative
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && !isConnected) {
        // User came back to the tab and we're disconnected
        console.log("Page became visible, but waiting for server response before refreshing...");
        // Don't refresh immediately - wait for actual server communication
    }
});

// Format "StellarDate" like 202.508.26 for 2025-08-26
function formatStellarDate(d) {
  const yyyy = String(d.getFullYear());
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  return `${yyyy.slice(0,3)}.${yyyy.slice(3)}${mm}.${dd}`;
}
// Pulse as HH.MM.SS (from 17:54:01 -> 17.54.01)
function formatPulse(d) {
  const hh = String(d.getHours()).padStart(2,"0");
  const mm = String(d.getMinutes()).padStart(2,"0");
  const ss = String(d.getSeconds()).padStart(2,"0");
  return `${hh}.${mm}.${ss}`;
}

// Tick clock
function tickClock(){
  const now = new Date();
  els.stellardate.textContent = formatStellarDate(now);
  els.pulse.textContent = formatPulse(now);
}
tickClock();
setInterval(tickClock, 1000); // Update every second since we're showing seconds


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
  
  // If we were disconnected and now receiving messages, server is back online
  if (!isConnected && msg.type) {
    console.log("Server is back online! Refreshing page...");
    location.reload();
    return;
  }
  
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