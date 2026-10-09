/**
 * Memoria AI - Palliative & Memory Care Assistant
 * Voice output: ElevenLabs only
 */

// On-screen message so problems are visible without opening the console
function notify(msg) {
  let el = document.getElementById("memoria-notice");
  if (!el) {
    el = document.createElement("div");
    el.id = "memoria-notice";
    el.style.cssText =
      "position:fixed;left:12px;right:12px;bottom:12px;z-index:99999;background:#b3261e;color:#fff;padding:12px 16px;border-radius:12px;font:14px/1.4 system-ui,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.3);cursor:pointer";
    el.onclick = () => el.remove();
    (document.body || document.documentElement).appendChild(el);
  }
  el.textContent = msg + "  (tap to dismiss)";
}
window.addEventListener("error", (e) => notify("Script error: " + e.message));

// Everything runs after the page is ready, wherever the <script> tag is placed
function memoriaMain() {
  Object.assign(window, { addMsg, applySettings, applySudokuInput, ask, closeCelebrationModal, drawMedications, drawPhotos, drawSudokuGrid, elevenConfigured, initApp, loadSavedSettings, loadWordPuzzle, newSudokuPuzzle, nextWordPuzzle, offlineAssistant, onCardClicked, pickWordLetter, provideSudokuHint, removeMedication, removePhoto, renderCaregiverChart, resetMemoryMatchGame, speak, stopSpeaking, handleCommand, aiReply, sfx, gameIntro, confettiBurst, browserSpeak, switchGame, switchMainTab, toggleVoiceGuidance, triggerCelebrationModal, unlockAudio }); // for onclick="..." in your HTML

// Utility Helpers
const missingEls = new Set();
const $ = (s) => {
  const el = document.querySelector(s);
  if (el) return el;
  if (!missingEls.has(s)) {
    missingEls.add(s);
    console.warn("Element not found in your HTML:", s);
  }
  return document.createElement("div"); // harmless stand-in so the rest keeps working
};
const $$ = (s) => [...document.querySelectorAll(s)];
const esc = (t) =>
  String(t).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
  );

// Local Storage Wrapper
const store = {
  get(k, def) {
    try {
      const v = localStorage.getItem(k);
      return v ? JSON.parse(v) : def;
    } catch (e) {
      return def;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch (e) {}
  },
};

// Global State
// ====================================================
// ELEVENLABS CONFIG - the ONLY place to set these two values
// ====================================================
let ELEVEN_API_KEY = localStorage.getItem("memoria_eleven") || ""; // set in Settings, never hardcode
const ELEVEN_VOICE_ID = "EXAVITQu4vr4xnSDxMaL";
// Different voice per mini-game (ElevenLabs ids; browser voices get different pitch/rate)
const GAME_VOICES = {
  default: { id: ELEVEN_VOICE_ID, pitch: 1, rate: 0.9 },
  sudoku: { id: "pNInz6obpgDQGcFmaJgB", pitch: 0.85, rate: 0.85 },
  word: { id: "21m00Tcm4TlvDq8ikWAM", pitch: 1.1, rate: 0.9 },
  pairs: { id: "ErXwobaYiN019PkySvjV", pitch: 1.25, rate: 1 },
};

// Saved settings never carry ElevenLabs values (drops anything stored by older versions)
function loadSavedSettings() {
  const saved = store.get("memoria_settings", {});
  delete saved.elevenKey;
  delete saved.elevenVoiceId;
  delete saved.apiKey; // old Gemini key from earlier versions
  return saved;
}

let S = Object.assign(
  {
    patient: "Arthur",
    location: "Baku, Azerbaijan",
    caregiver: "Sarah",
    phone: "",
    lang: "en-US",
  },
  loadSavedSettings()
);

let meds = store.get("memoria_meds", [
  { name: "Donepezil", time: "09:00", dose: "5", freq: "Daily" },
  { name: "Heart Care Omega", time: "12:00", dose: "1000", freq: "Daily" }
]);

let photos = store.get("memoria_photos", []);

let voiceGuidanceActive = true;

// ----------------------------------------------------
// Navigation & Views
// ----------------------------------------------------
function switchMainTab(tab) {
  const tabs = [
    { id: "patient", panel: "#patientPanel" },
    { id: "brain-gym", panel: "#brainGymPanel" },
    { id: "caregiver", panel: "#caregiverPanel" }
  ];

  tabs.forEach((t) => {
    const isCurrent = t.id === tab;
    const panel = $(t.panel);
    if (panel) {
      if (isCurrent) {
        panel.classList.remove("hidden");
        panel.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        panel.classList.add("hidden");
      }
    }
  });

  $$(".nav-tab-btn").forEach((btn) => {
    const isCurrent = btn.dataset.tab === tab;
    if (isCurrent) {
      btn.className = "nav-tab-btn flex items-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-xl text-sm sm:text-base font-bold transition-all bg-primary-container text-on-primary-container shadow-sm";
    } else {
      btn.className = "nav-tab-btn flex items-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-xl text-sm sm:text-base font-bold text-on-surface-variant hover:text-on-surface transition-all";
    }
  });
}

function switchGame(gameType) {
  gameIntro(gameType);
  const games = ["sudoku", "word", "pairs"];
  games.forEach((g) => {
    const view = $(`#game-${g}`);
    const btn = $(`#tab-btn-${g}`);
    const isCurrent = g === gameType;

    if (view) {
      if (isCurrent) {
        view.classList.remove("hidden");
      } else {
        view.classList.add("hidden");
      }
    }

    if (btn) {
      if (isCurrent) {
        btn.className = "game-nav-btn flex-1 sm:flex-none flex items-center justify-center gap-2.5 px-5 py-3 rounded-xl font-label text-base font-bold bg-primary-container text-on-primary-container shadow-md transition-all";
      } else {
        btn.className = "game-nav-btn flex-1 sm:flex-none flex items-center justify-center gap-2.5 px-5 py-3 rounded-xl font-label text-base font-bold text-on-surface-variant hover:text-on-surface transition-all";
      }
    }
  });
}

// ----------------------------------------------------
// Settings Management
// ----------------------------------------------------
const settingsModal = $("#settingsModal");

$("#settingsBtn").onclick = () => {
  $("#patientNameInput").value = S.patient || "Arthur";
  $("#locationInput").value = S.location || "Baku, Azerbaijan";
  $("#caregiverNameInput").value = S.caregiver || "Sarah";
  $("#caregiverPhoneInput").value = S.phone || "";

  $("#langSelect").value = S.lang || "en-US";
  $("#apiKeyInput").value = localStorage.getItem("memoria_gemini") || "";
  $("#elevenKeyInput").value = ELEVEN_API_KEY;
  settingsModal.classList.remove("hidden");
};

$("#closeModal").onclick = () => settingsModal.classList.add("hidden");
settingsModal.onclick = (e) => {
  if (e.target === settingsModal) settingsModal.classList.add("hidden");
};

$("#saveSettings").onclick = () => {
  S = {
    patient: $("#patientNameInput").value.trim() || "Arthur",
    location: $("#locationInput").value.trim() || "Baku, Azerbaijan",
    caregiver: $("#caregiverNameInput").value.trim() || "Sarah",
    phone: $("#caregiverPhoneInput").value.trim(),
    lang: $("#langSelect").value,
  };
  localStorage.setItem("memoria_gemini", $("#apiKeyInput").value.trim());
  ELEVEN_API_KEY = $("#elevenKeyInput").value.trim();
  localStorage.setItem("memoria_eleven", ELEVEN_API_KEY);
  store.set("memoria_settings", S);
  applySettings();
  settingsModal.classList.add("hidden");
  speak(`Settings updated. Hello ${S.patient}, you are safe at home.`);
};

// Apply Settings to UI
function applySettings() {
  const now = new Date();
  const h = now.getHours();
  const greeting = h < 12 ? "morning" : h < 18 ? "afternoon" : "evening";

  if ($("#greetingText")) {
    $("#greetingText").textContent = `Good ${greeting}, ${S.patient}!`;
  }
  if ($("#locationText")) {
    $("#locationText").textContent = `You are safe at home in ${S.location}.`;
  }
  if ($("#gpsLocation")) {
    $("#gpsLocation").textContent = S.location;
  }
  if ($("#caregiverLocation")) {
    $("#caregiverLocation").textContent = S.location;
  }
  if ($("#audioNoteBtnText")) {
    $("#audioNoteBtnText").textContent = `Play ${S.caregiver}'s reassuring voice note`;
  }
  if ($("#emergencyBtnText")) {
    $("#emergencyBtnText").textContent = `Call caregiver (${S.caregiver})`;
  }
  if ($("#celebTitle")) {
    $("#celebTitle").textContent = `Great Job, ${S.patient}!`;
  }

  // Header orientation badge
  const weekday = now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const city = S.location.split(",")[0].trim();
  if ($("#topOrientationBadge")) {
    $("#topOrientationBadge").textContent = `${weekday} • Safe at Home in ${city}`;
  }

  // Memory card avatar
  const firstPhoto = photos[0];
  if (firstPhoto) {
    $("#memoryName").textContent = firstPhoto.name;
    $("#memoryRelation").textContent = "Your " + firstPhoto.relation;
    $("#memoryAvatar").innerHTML = `<img src="${firstPhoto.src}" alt="${esc(firstPhoto.name)}" class="w-full h-full object-cover">`;
  } else {
    $("#memoryName").textContent = S.caregiver;
    $("#memoryRelation").textContent = "Your Loving Daughter";
    $("#memoryAvatar").innerHTML = `<span class="material-symbols-outlined text-primary text-[48px]">person</span>`;
  }
}

// ----------------------------------------------------
// Voice output: ElevenLabs only
// ----------------------------------------------------
const ELEVEN_MODEL = "eleven_flash_v2_5"; // low latency; use "eleven_multilingual_v2" for higher quality
const audioCache = new Map(); // saves credits on repeated phrases
const SILENT_WAV = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";

// One shared audio element. Once it is "unlocked" by a user tap,
// browsers (especially Safari/mobile) allow later programmatic playback.
const player = new Audio();
player.defaultPlaybackRate = 0.95; // gentle pacing; set to 1 for normal speed
let audioUnlocked = false;
let speakToken = 0;

function unlockAudio() {
  if (audioUnlocked) return;
  audioUnlocked = true;
  player.src = SILENT_WAV;
  player.play().catch(() => {
    audioUnlocked = false; // try again on the next tap
  });
}
["pointerdown", "touchstart", "keydown"].forEach((ev) =>
  document.addEventListener(ev, unlockAudio, { passive: true })
);

function stopSpeaking() {
  player.pause();
  if ("speechSynthesis" in window) speechSynthesis.cancel();
}

function elevenConfigured() {
  return (
    ELEVEN_API_KEY &&
    ELEVEN_VOICE_ID &&
    !ELEVEN_API_KEY.startsWith("YOUR_") &&
    !ELEVEN_VOICE_ID.startsWith("YOUR_")
  );
}

// Speak: ElevenLabs when a key is set, otherwise free browser voices. `game` picks the game voice.
async function speak(text, game = "default") {
  if (!voiceGuidanceActive || !text) return;
  stopSpeaking();
  const token = ++speakToken;
  const v = GAME_VOICES[game] || GAME_VOICES.default;
  if (elevenConfigured() && (S.lang || "en-US") === "en-US") {
    try {
      const key = v.id + "|" + text;
      let url = audioCache.get(key);
      if (!url) {
        const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(v.id)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "xi-api-key": ELEVEN_API_KEY, Accept: "audio/mpeg" },
          body: JSON.stringify({ text, model_id: ELEVEN_MODEL, voice_settings: { stability: 0.75, similarity_boost: 0.8, style: 0.1, use_speaker_boost: true } }),
        });
        if (!res.ok) throw new Error("ElevenLabs " + res.status);
        url = URL.createObjectURL(await res.blob());
        audioCache.set(key, url);
      }
      if (token !== speakToken) return;
      player.src = url;
      player.playbackRate = 0.95;
      await player.play();
      return;
    } catch (err) {
      console.warn("ElevenLabs failed, using browser voice:", err);
    }
  }
  if (token === speakToken) browserSpeak(text, v);
}
function browserSpeak(text, v) {
  if (!("speechSynthesis" in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = S.lang || "en-US";
  u.pitch = v.pitch;
  u.rate = v.rate;
  const match = speechSynthesis.getVoices().find((x) => x.lang.startsWith(u.lang.slice(0, 2)));
  if (match) u.voice = match;
  speechSynthesis.speak(u);
}

// ----------------------------------------------------
// Game sound effects (synthesized, no files needed)
// ----------------------------------------------------
let _ac;
function sfx(type) {
  if (!voiceGuidanceActive) return;
  try {
    _ac = _ac || new (window.AudioContext || window.webkitAudioContext)();
    const seq = {
      place: [[523, 0.09]], clear: [[330, 0.08]], flip: [[440, 0.06]],
      correct: [[523, 0.12], [659, 0.12], [784, 0.2]], match: [[659, 0.1], [880, 0.2]],
      oops: [[220, 0.18], [196, 0.22]], win: [[523, 0.12], [659, 0.12], [784, 0.12], [1047, 0.35]],
    }[type] || [];
    let t = _ac.currentTime;
    seq.forEach(([f, d]) => {
      const o = _ac.createOscillator(), g = _ac.createGain();
      o.type = type === "oops" ? "triangle" : "sine";
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g); g.connect(_ac.destination);
      o.start(t); o.stop(t + d + 0.02);
      t += d * 0.9;
    });
  } catch (e) {}
}
function gameIntro(g) {
  const t = {
    sudoku: "Sudoku time. Tap an empty box, then choose a number. Or just say: fill two.",
    word: "Word recall. Look at the picture and find the missing letter. You can say: letter E.",
    pairs: "Memory pairs. Turn over two cards and find the matches. Take all the time you like.",
  }[g];
  if (t && audioUnlocked) speak(t, g);
}
function confettiBurst() {
  const c = $("#confettiCanvas"), x = c.getContext && c.getContext("2d");
  if (!x) return;
  c.width = innerWidth; c.height = innerHeight;
  const cols = ["#cc4900", "#006c4a", "#ffb599", "#82f5c1", "#c05400"];
  const P = Array.from({ length: 140 }, () => ({ x: c.width / 2, y: c.height / 3, vx: (Math.random() - 0.5) * 14, vy: Math.random() * -12 - 2, r: 4 + Math.random() * 5, col: cols[Math.floor(Math.random() * cols.length)] }));
  let f = 0;
  (function tick() {
    x.clearRect(0, 0, c.width, c.height);
    P.forEach((p) => { p.vy += 0.35; p.x += p.vx; p.y += p.vy; x.fillStyle = p.col; x.fillRect(p.x, p.y, p.r, p.r * 0.6); });
    if (++f < 150) requestAnimationFrame(tick); else x.clearRect(0, 0, c.width, c.height);
  })();
}

// ----------------------------------------------------
// Assistant (offline, built-in replies)
// ----------------------------------------------------
const convLog = $("#conversationLog");

function addMsg(text, who) {
  const isAI = who === "ai";
  const item = document.createElement("div");
  item.className = `flex gap-3 max-w-[88%] ${isAI ? "self-start" : "self-end flex-row-reverse"}`;

  const avatar = document.createElement("div");
  avatar.className = `w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold text-sm shadow-sm ${
    isAI ? "bg-primary-container text-on-primary-container" : "bg-secondary text-on-secondary"
  }`;
  avatar.innerHTML = `<span class="material-symbols-outlined text-[20px]">${isAI ? "psychology" : "person"}</span>`;

  const bubble = document.createElement("div");
  bubble.className = `p-4 rounded-xl text-base leading-relaxed shadow-sm ${
    isAI
      ? "bg-surface-container-lowest text-on-surface border border-surface-container-high"
      : "bg-primary text-on-primary rounded-tr-none"
  }`;
  bubble.textContent = text;

  item.appendChild(avatar);
  item.appendChild(bubble);
  convLog.appendChild(item);
  convLog.scrollTop = convLog.scrollHeight;
}

function offlineAssistant(q) {
  const query = q.toLowerCase();
  const now = new Date();

  if (/time|clock|hour/.test(query)) {
    return `It is ${now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}. You are right on schedule.`;
  }
  if (/day|date|today|month|year/.test(query)) {
    return `Today is ${now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}. It is a lovely day.`;
  }
  if (/where|location|home|place/.test(query)) {
    return `You are completely safe at home in ${S.location}. Everything is peaceful here.`;
  }
  if (/who am i|my name/.test(query)) {
    return `Your name is ${S.patient}. You are surrounded by people who care deeply about you.`;
  }
  if (/daughter|sarah|caregiver|family|son|who are you/.test(query)) {
    return `${S.caregiver} is your caregiver and loves you very much. You can tap the red emergency button anytime to reach her.`;
  }
  if (/medic|pill|heart|dose/.test(query)) {
    return `Your daily medications are listed in your Daily Care Routine. Would you like to check them now?`;
  }
  if (/scared|afraid|lost|confused|help|nervous/.test(query)) {
    return `Take a slow, deep breath, ${S.patient}. You are completely safe right here. I am here with you, and ${S.caregiver} will see you soon.`;
  }
  return `I am here with you, ${S.patient}. Feel free to ask me the time, your location, or about ${S.caregiver}.`;
}

// ----------------------------------------------------
// AI AGENT: one pipeline for typed AND spoken input.
// Order: local commands -> safety check -> Gemini (if key) -> free Pollinations AI -> offline fallback
// ----------------------------------------------------
const chatHistory = store.get("memoria_chat", []);
const NUMW = { one: 1, two: 2, three: 3, four: 4, bir: 1, iki: 2, "üç": 3, "dörd": 4, "dört": 4, "один": 1, "два": 2, "три": 3, "четыре": 4 };

function handleCommand(q) {
  const t = q.toLowerCase();
  const num = (t.match(/(?:fill|put|number|place|yaz|qoy|koy|поставь)\s+(\S+)/) || [])[1];
  if (num && (NUMW[num] || /^[1-4]$/.test(num))) { switchMainTab("brain-gym"); switchGame("sudoku"); applySudokuInput(NUMW[num] || +num); return "Done."; }
  const ltr = (t.match(/\bletter\s+([a-z])\b/) || [])[1];
  if (ltr) { switchMainTab("brain-gym"); switchGame("word"); pickWordLetter(ltr.toUpperCase()); return "Let's see."; }
  if (/\bhint\b/.test(t)) { provideSudokuHint(); return "Here is a gentle hint."; }
  if (/new puzzle/.test(t)) { newSudokuPuzzle(); return "Here is a fresh puzzle."; }
  if (/next word/.test(t)) { nextWordPuzzle(); return "Next word."; }
  if (/shuffle|reset cards/.test(t)) { resetMemoryMatchGame(); return "Cards shuffled."; }
  if (/sudoku/.test(t)) { switchMainTab("brain-gym"); switchGame("sudoku"); return "Opening Sudoku."; }
  if (/word game|word recall/.test(t)) { switchMainTab("brain-gym"); switchGame("word"); return "Opening the word game."; }
  if (/pairs|memory match|cards/.test(t)) { switchMainTab("brain-gym"); switchGame("pairs"); return "Opening memory pairs."; }
  if (/\bcall\b/.test(t) && (t.includes(S.caregiver.toLowerCase()) || /caregiver|daughter|help|emergency/.test(t))) { setTimeout(() => $("#emergencyBtn").click(), 900); return `Calling ${S.caregiver} now.`; }
  return null;
}

const DANGER = /chest pain|can't breathe|cannot breathe|i fell|fell down|bleeding|heart attack|stroke|overdose/i;

function systemPrompt() {
  const now = new Date();
  const routine = $$("#routineList .routine-row").map((r) => (r.querySelector("input").checked ? "done: " : "pending: ") + r.querySelector(".routine-title").textContent).join("; ");
  const m = meds.map((x) => `${x.name} ${x.dose}mg at ${x.time} (${x.freq})`).join("; ") || "none";
  return `You are Memoria, a warm, patient voice companion for ${S.patient}, a person living with memory loss, at home in ${S.location}. Caregiver: ${S.caregiver}. Now: ${now.toLocaleString("en-US", { dateStyle: "full", timeStyle: "short" })}. Medications: ${m}. Today's routine: ${routine}. Rules: reply in the language the person writes in (preferred ${S.lang}); max 2-3 short, simple sentences; never correct or argue with confusion, gently reassure and orient (name, place, time); never invent medical advice, only refer to the schedule above or ${S.caregiver}; for any danger or pain say to call ${S.caregiver} or 112 now. Optionally end with ONE tag when useful: [[games]] to suggest brain games, [[call]] to call the caregiver, [[note]] to play the caregiver's voice note.`;
}

async function aiReply(q) {
  const msgs = chatHistory.slice(-8);
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 12000);
  try {
    const gKey = localStorage.getItem("memoria_gemini");
    if (gKey) {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${encodeURIComponent(gKey)}`, {
        method: "POST", signal: ctl.signal, headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: systemPrompt() }] }, contents: [...msgs.map((m) => ({ role: m.role === "user" ? "user" : "model", parts: [{ text: m.text }] })), { role: "user", parts: [{ text: q }] }] }),
      });
      if (r.ok) { const j = await r.json(); const t = j.candidates?.[0]?.content?.parts?.[0]?.text; if (t) return t; }
    }
    const r = await fetch("https://text.pollinations.ai/openai", {
      method: "POST", signal: ctl.signal, headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "openai", messages: [{ role: "system", content: systemPrompt() }, ...msgs.map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.text })), { role: "user", content: q }] }),
    });
    if (r.ok) { const j = await r.json(); const t = j.choices?.[0]?.message?.content; if (t) return t; }
  } catch (e) {
    console.warn("AI unavailable, using offline replies:", e);
  } finally {
    clearTimeout(timer);
  }
  return offlineAssistant(q);
}

async function ask(query) {
  if (!query) return;
  addMsg(query, "user");
  if (DANGER.test(query)) {
    const m = `${S.patient}, please stay where you are. I am calling ${S.caregiver} now. If it is an emergency, dial 112.`;
    addMsg(m, "ai"); speak(m); setTimeout(() => $("#emergencyBtn").click(), 1500);
    return;
  }
  const cmd = handleCommand(query);
  if (cmd) { addMsg(cmd, "ai"); speak(cmd); return; }

  const typing = document.createElement("div");
  typing.className = "flex gap-3 self-start";
  typing.innerHTML = '<div class="p-4 rounded-xl bg-surface-container-lowest border border-surface-container-high"><span class="typing-dots"><i></i><i></i><i></i></span></div>';
  convLog.appendChild(typing);
  convLog.scrollTop = convLog.scrollHeight;

  const raw = String(await aiReply(query)).trim();
  typing.remove();
  const tag = (raw.match(/\[\[(games|call|note)\]\]/) || [])[1];
  const ans = raw.replace(/\[\[.*?\]\]/g, "").trim();
  chatHistory.push({ role: "user", text: query }, { role: "ai", text: ans });
  store.set("memoria_chat", chatHistory.slice(-20));
  addMsg(ans, "ai");
  speak(ans);
  if (tag === "games") setTimeout(() => switchMainTab("brain-gym"), 2500);
  if (tag === "note") setTimeout(() => $("#playAudioNote").click(), 3500);
  if (tag === "call") setTimeout(() => $("#emergencyBtn").click(), 3500);
}
$$("#quickChips .quick-chip").forEach((b) => (b.onclick = () => ask(b.dataset.q)));
if ("speechSynthesis" in window) speechSynthesis.getVoices();

// Initial AI Greeting
addMsg(
  `Hello ${S.patient}! I'm Memoria, your gentle companion. How are you feeling today?`,
  "ai"
);

// Text input submission
const sendQuery = () => {
  const val = $("#textInput").value.trim();
  if (val) {
    $("#textInput").value = "";
    ask(val);
  }
};
$("#sendTextBtn").onclick = sendQuery;
$("#textInput").onkeydown = (e) => {
  if (e.key === "Enter") sendQuery();
};

// Web Speech Recognition
const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;

const toggleMic = () => {
  if (!SpeechRec) {
    $("#micStatus").textContent = "Voice speech recognition is not supported in this browser.";
    return;
  }
  if (recognition) {
    recognition.stop();
    return;
  }

  recognition = new SpeechRec();
  recognition.lang = S.lang || "en-US";
  recognition.interimResults = false;

  recognition.onstart = () => {
    $("#micBtn").classList.add("listening-pulse");
    $("#gymMicBtn").classList.add("listening-pulse");
    $("#micStatus").textContent = "Listening to your voice...";
  };

  recognition.onresult = (e) => {
    const transcript = e.results[0][0].transcript;
    ask(transcript);
  };

  recognition.onerror = () => {
    $("#micStatus").textContent = "Could not hear clearly. Tap to try again.";
  };

  recognition.onend = () => {
    recognition = null;
    $("#micBtn").classList.remove("listening-pulse");
    $("#gymMicBtn").classList.remove("listening-pulse");
    $("#micStatus").textContent = "Tap to speak with Memoria";
  };

  recognition.start();
};
$("#micBtn").onclick = toggleMic;
$("#gymMicBtn").onclick = toggleMic;

// Audio note playback
$("#playAudioNote").onclick = () => {
  speak(
    `Hello ${S.patient}, it is ${S.caregiver}. I love you so much. You are safe at home, and I will be right there with you very soon.`
  );
};

// Emergency Call
$("#emergencyBtn").onclick = () => {
  if (S.phone) {
    location.href = "tel:" + S.phone.replace(/[^+\d]/g, "");
  } else {
    alert(`Please set ${S.caregiver}'s telephone number in Settings.`);
    settingsModal.classList.remove("hidden");
  }
};

// Battery API integration
if (navigator.getBattery) {
  navigator.getBattery().then((batt) => {
    const updateBatt = () => {
      const pct = Math.round(batt.level * 100) + "%";
      if ($("#battery")) $("#battery").textContent = pct;
      if ($("#caregiverBattery")) $("#caregiverBattery").textContent = `${pct} (Healthy)`;
    };
    updateBatt();
    batt.onlevelchange = updateBatt;
  });
}

// ----------------------------------------------------
// Daily Care Routine
// ----------------------------------------------------
const todayStr = new Date().toDateString();
if ($("#routineDateText")) {
  $("#routineDateText").textContent = new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

$$("#routineList input").forEach((checkbox, idx) => {
  const key = "memoria_routine_" + idx;
  const saved = store.get(key, {});
  const isDone = saved.day === todayStr && saved.done;
  checkbox.checked = isDone;

  const row = checkbox.closest(".routine-row");
  if (row) {
    row.classList.toggle("opacity-60", isDone);
    const title = row.querySelector(".routine-title");
    if (title) title.classList.toggle("line-through", isDone);
  }

  checkbox.onchange = () => {
    store.set(key, { day: todayStr, done: checkbox.checked });
    if (row) {
      row.classList.toggle("opacity-60", checkbox.checked);
      const title = row.querySelector(".routine-title");
      if (title) title.classList.toggle("line-through", checkbox.checked);
    }
    if (checkbox.checked) {
      speak("Great job on taking care of your routine step.");
    }
  };
});

// ----------------------------------------------------
// Brain Gym Game 1: 4x4 Gentle Sudoku (Dynamic Generator)
// ----------------------------------------------------
const SUDOKU_BASE = [
  [1, 2, 3, 4],
  [3, 4, 1, 2],
  [2, 1, 4, 3],
  [4, 3, 2, 1]
];

let currentSudokuSolution = [];
let currentSudokuGrid = [];
let sudokuFixedCells = [];
let selectedSudokuPos = null;

function newSudokuPuzzle() {
  // Generate random permutation of 1..4
  const nums = [1, 2, 3, 4].sort(() => Math.random() - 0.5);
  currentSudokuSolution = SUDOKU_BASE.map((row) => row.map((v) => nums[v - 1]));

  // Create mutable grid
  currentSudokuGrid = currentSudokuSolution.map((r) => [...r]);
  sudokuFixedCells = currentSudokuGrid.map(() => Array(4).fill(true));

  // Blank out 6 random cells
  let blanks = 0;
  while (blanks < 6) {
    const r = Math.floor(Math.random() * 4);
    const c = Math.floor(Math.random() * 4);
    if (sudokuFixedCells[r][c]) {
      sudokuFixedCells[r][c] = false;
      currentSudokuGrid[r][c] = 0;
      blanks++;
    }
  }

  selectedSudokuPos = null;
  drawSudokuGrid();
  $("#sudoku-feedback").innerHTML = `
    <span class="material-symbols-outlined text-secondary text-[28px]">spa</span>
    <p class="font-body text-base text-on-surface">Take your time. ${esc(S.patient)} is doing beautifully.</p>
  `;
}

function drawSudokuGrid() {
  const container = $("#sudokuGrid");
  container.innerHTML = "";

  currentSudokuGrid.forEach((row, r) => {
    row.forEach((val, c) => {
      const isFixed = sudokuFixedCells[r][c];
      const isSelected = selectedSudokuPos && selectedSudokuPos[0] === r && selectedSudokuPos[1] === c;

      const cell = document.createElement("button");
      cell.className = `sudoku-cell flex items-center justify-center rounded-xl font-headline text-2xl sm:text-3xl font-bold transition-all shadow-sm select-none ${
        isFixed
          ? "bg-surface-container-lowest text-on-surface cursor-default font-extrabold"
          : isSelected
          ? "selected bg-primary-fixed text-on-primary-fixed shadow-md"
          : val !== 0
          ? "bg-secondary-container text-on-secondary-container font-extrabold"
          : "bg-surface-container-low hover:bg-surface-container text-primary font-bold"
      }`;

      cell.textContent = val !== 0 ? val : "?";
      cell.onclick = () => {
        if (!isFixed) {
          selectedSudokuPos = [r, c];
          drawSudokuGrid();
          $("#sudoku-guide-msg").innerHTML = `Selected box: <span class="font-label text-on-surface font-bold">Row ${r + 1}, Column ${c + 1}</span>. Tap a number below to place.`;
        }
      };

      container.appendChild(cell);
    });
  });
}

function applySudokuInput(num) {
  if (!selectedSudokuPos) {
    $("#sudoku-guide-msg").textContent = "Please tap an empty box first!";
    return;
  }
  const [r, c] = selectedSudokuPos;
  if (sudokuFixedCells[r][c]) return;

  currentSudokuGrid[r][c] = num;
  sfx(num ? "place" : "clear");
  drawSudokuGrid();

  // Check if grid is full
  let isFull = true;
  let isCorrect = true;
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      if (currentSudokuGrid[i][j] === 0) isFull = false;
      if (currentSudokuGrid[i][j] !== currentSudokuSolution[i][j]) isCorrect = false;
    }
  }

  if (isFull) {
    if (isCorrect) {
      $("#sudoku-feedback").innerHTML = `
        <span class="material-symbols-outlined text-secondary text-[28px] fill-1">celebration</span>
        <p class="font-body text-base text-on-surface font-bold">Bravo ${esc(S.patient)}! Sudoku completely solved!</p>
      `;
      sfx("win");
      speak(`Bravo ${S.patient}! You have solved the gentle Sudoku puzzle!`, "sudoku");
      setTimeout(triggerCelebrationModal, 800);
    } else {
      $("#sudoku-feedback").innerHTML = `
        <span class="material-symbols-outlined text-tertiary text-[28px]">info</span>
        <p class="font-body text-base text-on-surface">Almost there! Take a calm look at rows and columns.</p>
      `;
      sfx("oops");
      speak("Almost there. Take a calm look at the rows and columns.", "sudoku");
    }
  }
}

function provideSudokuHint() {
  if (!selectedSudokuPos) {
    // Find first empty cell
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        if (!sudokuFixedCells[r][c] && currentSudokuGrid[r][c] === 0) {
          selectedSudokuPos = [r, c];
          break;
        }
      }
      if (selectedSudokuPos) break;
    }
  }

  if (selectedSudokuPos) {
    const [r, c] = selectedSudokuPos;
    const sol = currentSudokuSolution[r][c];
    $("#sudoku-guide-msg").innerHTML = `
      <span class="font-label text-tertiary font-bold">Gentle Hint:</span> Row ${r + 1}, Column ${c + 1} needs <strong class="text-primary font-bold text-lg">${sol}</strong>.
    `;
    drawSudokuGrid();
  }
}

// ----------------------------------------------------
// Brain Gym Game 2: Word Recall
// ----------------------------------------------------
const WORD_BANK = [
  {
    word: "APPLE",
    title: "Crisp, sweet, and red fruit",
    desc: "Enjoyed with morning breakfast slices",
    category: "Morning Nutrition",
    img: "https://lh3.googleusercontent.com/aida-public/AB6AXuBFyIQ328k-e17n6neHWT-h3L8uO3pXr7HiznnsSjNJ5cGlCdGo4gw791L3zB2CoBChDDAZdAsZzydlO1OT1Fpe4dKsZ-OkBVF1mvyybl2ZjAmCX4dbTwTXi86r8hWVcELgzqkycZf801WxeIZNG5WdSQIaS3TB117K8U8EdQTrf9gbU_4EG94PWREB8Ze_EZpdxNzm7aQvnrJD9iN5wsFraRcqpx14iCUFDlbrKDc1IpO7xpZgCEj7vA"
  },
  {
    word: "GARDEN",
    title: "Place with flowers and soft grass",
    desc: "Where morning birds sing happily in the sunshine",
    category: "Peaceful Nature",
    img: "https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=400&auto=format&fit=crop&q=80"
  },
  {
    word: "FAMILY",
    title: "Those who love and cherish you",
    desc: "Warm smiles, shared laughter, and tight hugs",
    category: "Loved Ones",
    img: "https://images.unsplash.com/photo-1511895426328-dc8714191300?w=400&auto=format&fit=crop&q=80"
  },
  {
    word: "FLOWER",
    title: "Delicate and pleasant bloom",
    desc: "Fresh colors that bring peaceful joy to your room",
    category: "Sweet Scents",
    img: "https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=400&auto=format&fit=crop&q=80"
  }
];

let wordIdx = 0;
let currentWordObj = null;
let missingIndex = -1;
let expectedLetter = "";

function nextWordPuzzle() {
  wordIdx = (wordIdx + 1) % WORD_BANK.length;
  loadWordPuzzle(wordIdx);
}

function loadWordPuzzle(idx) {
  currentWordObj = WORD_BANK[idx];
  const w = currentWordObj.word;
  missingIndex = Math.floor(Math.random() * w.length);
  expectedLetter = w[missingIndex];

  $("#wordCategoryBadge").textContent = currentWordObj.category;
  $("#wordClueTitle").textContent = currentWordObj.title;
  $("#wordClueSubtitle").textContent = currentWordObj.desc;
  $("#wordImage").src = currentWordObj.img;
  $("#word-badge-success").classList.add("hidden");

  // Render Tiles
  const tilesBox = $("#wordTilesContainer");
  tilesBox.innerHTML = "";

  for (let i = 0; i < w.length; i++) {
    const tile = document.createElement("div");
    if (i === missingIndex) {
      tile.id = "word-missing-slot";
      tile.className = "w-14 h-20 sm:w-16 sm:h-24 rounded-xl bg-primary-fixed/50 border-2 border-primary border-dashed flex items-center justify-center font-headline text-3xl font-extrabold text-primary shadow-sm animate-pulse";
      tile.textContent = "_";
    } else {
      tile.className = "w-14 h-20 sm:w-16 sm:h-24 rounded-xl bg-surface-container-lowest border border-surface-container-high flex items-center justify-center font-headline text-3xl font-bold text-on-surface shadow-sm";
      tile.textContent = w[i];
    }
    tilesBox.appendChild(tile);
  }

  // Generate 3 choices
  const choices = new Set([expectedLetter]);
  while (choices.size < 3) {
    const randomLetter = String.fromCharCode(65 + Math.floor(Math.random() * 26));
    choices.add(randomLetter);
  }

  const choiceContainer = $("#letterChoices");
  choiceContainer.innerHTML = "";

  [...choices]
    .sort(() => Math.random() - 0.5)
    .forEach((ltr) => {
      const btn = document.createElement("button");
      btn.className = "h-20 rounded-lg bg-primary-container text-on-primary-container hover:bg-primary font-headline text-3xl font-bold shadow-md active:scale-95 transition-all flex items-center justify-center";
      btn.textContent = ltr;
      btn.onclick = () => pickWordLetter(ltr);
      choiceContainer.appendChild(btn);
    });
}

function pickWordLetter(ltr) {
  const slot = $("#word-missing-slot");
  const badge = $("#word-badge-success");
  slot.textContent = ltr;
  sfx(ltr === expectedLetter ? "correct" : "oops");

  if (ltr === expectedLetter) {
    slot.className = "w-14 h-20 sm:w-16 sm:h-24 rounded-lg bg-secondary-container text-on-secondary-container border-2 border-secondary flex items-center justify-center font-headline text-3xl font-bold shadow-sm";
    badge.classList.remove("hidden");
    $("#wordSuccessText").textContent = `Wonderful job, ${S.patient}! “${currentWordObj.word}” is correct!`;
    speak(`Wonderful job, ${S.patient}! ${currentWordObj.word} is correct!`, "word");

    setTimeout(() => {
      nextWordPuzzle();
    }, 2800);
  } else {
    slot.className = "w-14 h-20 sm:w-16 sm:h-24 rounded-lg bg-error-container text-on-error-container flex items-center justify-center font-headline text-3xl font-bold";
    setTimeout(() => {
      slot.className = "w-14 h-20 sm:w-16 sm:h-24 rounded-lg bg-primary-fixed/40 border-2 border-primary border-dashed flex items-center justify-center font-headline text-3xl font-bold text-primary shadow-sm animate-pulse";
      slot.textContent = "_";
    }, 800);
  }
}

// ----------------------------------------------------
// Brain Gym Game 3: Memory Pair Match
// ----------------------------------------------------
const PAIR_ITEMS = [
  { id: "glasses", name: "Reading Glasses", icon: "eyeglasses" },
  { id: "cup", name: "Warm Teacup", icon: "local_cafe" },
  { id: "key", name: "House Keys", icon: "key" },
  { id: "book", name: "Memory Book", icon: "menu_book" }
];

let flippedCardList = [];
let matchedPairCount = 0;
let pairLock = false;

function resetMemoryMatchGame() {
  flippedCardList = [];
  matchedPairCount = 0;
  pairLock = false;
  $("#match-counter").textContent = "0 / 4";

  const deck = [...PAIR_ITEMS, ...PAIR_ITEMS].sort(() => Math.random() - 0.5);
  const grid = $("#memoryGrid");
  grid.innerHTML = "";

  deck.forEach((item, idx) => {
    const card = document.createElement("div");
    card.className = "flip-card h-36 sm:h-44 cursor-pointer";
    card.dataset.itemId = item.id;
    card.dataset.cardIdx = idx;

    card.innerHTML = `
      <div class="flip-card-inner">
        <!-- Front / Hidden state -->
        <div class="flip-card-front bg-surface-container-high hover:bg-surface-container text-on-surface border border-surface-container-highest shadow-sm p-3">
          <span class="material-symbols-outlined text-primary text-[42px] mb-1">help_center</span>
          <span class="font-label text-sm font-semibold text-on-surface-variant">Tap to Reveal</span>
        </div>
        <!-- Back / Revealed state -->
        <div class="flip-card-back bg-secondary-container text-on-secondary-container border border-secondary shadow-sm p-3">
          <span class="material-symbols-outlined text-[48px] sm:text-[54px] mb-2 fill-1">${item.icon}</span>
          <span class="font-label text-sm sm:text-base font-bold">${item.name}</span>
          <div class="absolute top-2 right-2 w-6 h-6 rounded-full bg-secondary text-on-secondary flex items-center justify-center">
            <span class="material-symbols-outlined text-[16px]">check</span>
          </div>
        </div>
      </div>
    `;

    card.onclick = () => onCardClicked(card, item);
    grid.appendChild(card);
  });
}

function onCardClicked(card, item) {
  if (pairLock || card.classList.contains("is-flipped") || card.classList.contains("is-matched")) {
    return;
  }

  card.classList.add("is-flipped");
  sfx("flip");
  flippedCardList.push({ card, item });

  if (flippedCardList.length === 2) {
    pairLock = true;
    const [c1, c2] = flippedCardList;

    if (c1.item.id === c2.item.id) {
      c1.card.classList.add("is-matched");
      c2.card.classList.add("is-matched");
      matchedPairCount++;
      sfx("match");
      $("#match-counter").textContent = `${matchedPairCount} / 4`;
      flippedCardList = [];
      pairLock = false;

      if (matchedPairCount === 4) {
        sfx("win");
        speak(`Splendid work ${S.patient}! All pairs have been joyfully found.`, "pairs");
        setTimeout(triggerCelebrationModal, 700);
      }
    } else {
      setTimeout(() => sfx("oops"), 400);
      setTimeout(() => {
        c1.card.classList.remove("is-flipped");
        c2.card.classList.remove("is-flipped");
        flippedCardList = [];
        pairLock = false;
      }, 900);
    }
  }
}

// Celebration Reward Modal
function triggerCelebrationModal() {
  $("#rewardModal").classList.remove("hidden");
  confettiBurst();
}
function closeCelebrationModal() {
  $("#rewardModal").classList.add("hidden");
}

function toggleVoiceGuidance() {
  voiceGuidanceActive = !voiceGuidanceActive;
  if (!voiceGuidanceActive) stopSpeaking();
  $("#voiceGuidanceLabel").textContent = voiceGuidanceActive ? "Voice Guidance Active" : "Voice Guidance Muted";
}

// ----------------------------------------------------
// Caregiver Dashboard Logic
// ----------------------------------------------------
// Cognitive 7-Day Chart
function renderCaregiverChart() {
  const scores = [72, 78, 75, 86, 89, 90, 92];
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Today"];
  const chart = $("#progressChart");
  if (!chart) return;

  chart.innerHTML = scores
    .map(
      (val, i) => `
    <div class="flex flex-col items-center gap-1.5 w-10 group cursor-pointer">
      <div class="w-full bg-gradient-to-t from-secondary to-secondary-container hover:from-secondary-hover hover:to-secondary rounded-t-lg transition-all shadow-sm relative" style="height:${val * 0.7}px" title="${days[i]}: ${val}%">
        <span class="opacity-0 group-hover:opacity-100 absolute -top-6 left-1/2 -translate-x-1/2 bg-on-surface text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow pointer-events-none transition-opacity">${val}%</span>
      </div>
      <span class="font-label text-xs text-on-surface-variant font-bold">${days[i]}</span>
    </div>
  `
    )
    .join("");

  if ($("#lastUpdate")) {
    $("#lastUpdate").textContent = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
}

// Medication List & Form
function drawMedications() {
  const list = $("#medList");
  if (!list) return;

  if (meds.length === 0) {
    list.innerHTML = `<div class="p-4 rounded-lg bg-surface-container-low text-on-surface-variant text-sm">No medications currently scheduled. Add one above.</div>`;
    return;
  }

  list.innerHTML = meds
    .map(
      (m, i) => `
    <div class="flex items-center justify-between p-3.5 rounded-lg bg-surface-container-low border border-surface-container-high">
      <div class="flex items-center gap-3">
        <span class="material-symbols-outlined text-primary text-[24px]">pill</span>
        <div class="flex flex-col">
          <span class="font-headline text-base font-bold text-on-surface">${esc(m.name)} • ${esc(m.dose)} mg</span>
          <span class="font-body text-xs text-on-surface-variant">${esc(m.time)} · ${esc(m.freq)}</span>
        </div>
      </div>
      <button onclick="removeMedication(${i})" class="p-2 rounded-full hover:bg-surface-container text-error transition-all" title="Remove medication">
        <span class="material-symbols-outlined text-[20px]">delete</span>
      </button>
    </div>
  `
    )
    .join("");
}

function removeMedication(idx) {
  meds.splice(idx, 1);
  store.set("memoria_meds", meds);
  drawMedications();
}

$("#medicationForm").onsubmit = (e) => {
  e.preventDefault();
  meds.push({
    name: $("#medName").value.trim(),
    time: $("#medTime").value,
    dose: $("#medDosage").value.trim(),
    freq: $("#medFrequency").value,
  });
  store.set("memoria_meds", meds);
  e.target.reset();
  drawMedications();
};

// Photo Vault List & Form (HTML5 Canvas Compression)
function drawPhotos() {
  const vault = $("#photoVault");
  if (!vault) return;

  if (photos.length === 0) {
    vault.innerHTML = `<div class="col-span-full p-4 rounded-lg bg-surface-container-low text-on-surface-variant text-sm">No photos added yet. Upload one above to anchor memories.</div>`;
    return;
  }

  vault.innerHTML = photos
    .map(
      (p, i) => `
    <div class="relative group rounded-lg overflow-hidden border border-surface-container-high shadow-sm bg-surface-container-low flex flex-col">
      <img src="${p.src}" alt="${esc(p.name)}" class="w-full h-28 object-cover">
      <div class="p-2 flex flex-col">
        <span class="font-headline text-sm font-bold text-on-surface truncate">${esc(p.name)}</span>
        <span class="font-body text-xs text-on-surface-variant truncate">${esc(p.relation)}</span>
      </div>
      <button onclick="removePhoto(${i})" class="absolute top-1 right-1 p-1 rounded-full bg-surface-container-lowest/90 text-error hover:bg-surface-container transition-all" title="Remove photo">
        <span class="material-symbols-outlined text-[18px]">delete</span>
      </button>
    </div>
  `
    )
    .join("");
}

function removePhoto(idx) {
  photos.splice(idx, 1);
  store.set("memoria_photos", photos);
  drawPhotos();
  applySettings();
}

$("#photoForm").onsubmit = (e) => {
  e.preventDefault();
  const file = $("#photoFile").files[0];
  if (!file) return;

  const name = $("#photoName").value.trim();
  const relation = $("#photoRelation").value.trim();

  const img = new Image();
  const url = URL.createObjectURL(file);

  img.onload = () => {
    const size = 240;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const minDim = Math.min(img.width, img.height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(
      img,
      (img.width - minDim) / 2,
      (img.height - minDim) / 2,
      minDim,
      minDim,
      0,
      0,
      size,
      size
    );
    URL.revokeObjectURL(url);

    photos.unshift({
      name,
      relation,
      src: canvas.toDataURL("image/jpeg", 0.8),
    });
    store.set("memoria_photos", photos);
    e.target.reset();
    drawPhotos();
    applySettings();
  };
  img.src = url;
};

// ----------------------------------------------------
// App Initialization (runs once, whether or not the DOM is already ready)
// ----------------------------------------------------
function initApp() {
  applySettings();
  newSudokuPuzzle();
  loadWordPuzzle(0);
  resetMemoryMatchGame();
  renderCaregiverChart();
  drawMedications();
  drawPhotos();
}

initApp();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", memoriaMain);
} else {
  memoriaMain();
}