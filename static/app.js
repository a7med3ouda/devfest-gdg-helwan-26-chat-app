const chatBox = document.getElementById("chat-box");
const chatForm = document.getElementById("chat-form");
const messageInput = document.getElementById("message-input");
const statusDiv = document.getElementById("status");
const userBadge = document.getElementById("user-badge");
const themeToggleBtn = document.getElementById("theme-toggle");
const themeIcon = document.getElementById("theme-icon");
const themeText = document.getElementById("theme-text");
const htmlElement = document.documentElement;

// 1. Theme Management via HTML 'dark' class & LocalStorage
let currentTheme = localStorage.getItem("chat_theme") || "dark";

function applyTheme(theme) {
  if (theme === "light") {
    htmlElement.classList.remove("dark");
    themeIcon.textContent = "🌙";
    themeText.textContent = "Dark";
  } else {
    htmlElement.classList.add("dark");
    themeIcon.textContent = "🌞";
    themeText.textContent = "Light";
  }
  localStorage.setItem("chat_theme", theme);
}

applyTheme(currentTheme);

themeToggleBtn.addEventListener("click", () => {
  currentTheme = htmlElement.classList.contains("dark") ? "light" : "dark";
  applyTheme(currentTheme);
});

// 2. Manage User Identity via LocalStorage
let myId = localStorage.getItem("chat_id");
if (!myId) {
  myId = "user_" + Math.random().toString(36).substring(2, 9);
  localStorage.setItem("chat_id", myId);
}

let myName = localStorage.getItem("chat_name");
if (!myName) {
  myName = prompt("Enter your chat name for DevFest:") || "Anonymous";
  localStorage.setItem("chat_name", myName.trim());
}

userBadge.textContent = `👤 ${myName}`;

// 3. Connect to WebSocket server
const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
const wsUrl = `${wsProtocol}//${window.location.host}/ws`;
const ws = new WebSocket(wsUrl);

ws.onopen = () => {
  statusDiv.innerHTML = `<span class="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-emerald-500"></span> <span class="hidden sm:inline">Connected</span>`;
  statusDiv.className =
    "flex items-center gap-1.5 text-xs sm:text-sm text-emerald-400";
};

ws.onclose = () => {
  statusDiv.innerHTML = `<span class="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-rose-500"></span> <span class="hidden sm:inline">Disconnected</span>`;
  statusDiv.className =
    "flex items-center gap-1.5 text-xs sm:text-sm text-rose-400";
};

// 4. Receive Broadcasted Messages
ws.onmessage = (event) => {
  try {
    const data = JSON.parse(event.data);
    const isMe = data.id === myId;
    appendMessage(data.name, data.text, data.time, isMe);
  } catch (err) {
    console.error("Failed to parse incoming message:", event.data);
  }
};

// 5. Handle Textarea Auto-Resize & Enter to Send (Shift+Enter for New Line)
messageInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    chatForm.requestSubmit();
  }
});

messageInput.addEventListener("input", () => {
  messageInput.style.height = "auto";
  messageInput.style.height = Math.min(messageInput.scrollHeight, 128) + "px";
});

// 6. Send Message Payload with Full Date & Time Stamp
chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = messageInput.value.trim();
  if (!text) return;

  const now = new Date();
  const dateStr = now.toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
  const timeStr = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const fullTimeStamp = `${dateStr}, ${timeStr}`;

  const payload = JSON.stringify({
    id: myId,
    name: myName,
    text: text,
    time: fullTimeStamp,
  });

  ws.send(payload);
  messageInput.value = "";
  messageInput.style.height = "auto";
});

// 7. Render Bubbles in Messenger Style with Multi-Line Support (`whitespace-pre-wrap`)
function appendMessage(senderName, text, time, isMe) {
  const div = document.createElement("div");

  if (isMe) {
    div.className = "flex flex-col items-end";
    div.innerHTML = `
      <div class="bg-blue-600 text-white px-4 py-2.5 rounded-3xl max-w-[85%] sm:max-w-md shadow-sm break-words text-sm whitespace-pre-wrap">${escapeHtml(text)}</div>
      <span class="text-[10px] text-zinc-500 mr-2 mt-0.5">${escapeHtml(time || "")}</span>
    `;
  } else {
    div.className = "flex flex-col items-start";
    div.innerHTML = `
      <span class="text-[11px] text-zinc-500 font-medium ml-3 mb-1">${escapeHtml(senderName)}</span>
      <div class="bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100 px-4 py-2.5 rounded-3xl max-w-[85%] sm:max-w-md shadow-sm break-words text-sm whitespace-pre-wrap">${escapeHtml(text)}</div>
      <span class="text-[10px] text-zinc-500 ml-3 mt-0.5">${escapeHtml(time || "")}</span>
    `;
  }

  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function escapeHtml(text) {
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}
