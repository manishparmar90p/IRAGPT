
const input = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const messagesContainer = document.querySelector(".messages");
const chatList = document.querySelector(".chat-list");
const newChatBtn = document.getElementById("newChatBtn");

/* ===============================
   GEMINI CONFIG
================================ */
const GEMINI_API_KEY = "AIzaSyDn6sLfVD_9wguVbqjEQvbdCm0KUL7rvk8";
const GEMINI_API_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`;

/* ===============================
   STATE
================================ */
let chats = JSON.parse(localStorage.getItem("trygpt_chats")) || [];
let activeChatId = localStorage.getItem("trygpt_active_chat");

/* ==============================  INIT
================================ */
if (!activeChatId) createNewChat();
else loadChat(activeChatId);

renderChatList();

/* ===============================
   EVENTS
================================ */
sendBtn.addEventListener("click", sendMessage);
input.addEventListener("keypress", e => e.key === "Enter" && sendMessage());
newChatBtn.addEventListener("click", createNewChat);

/* ===============================
   CHAT FUNCTIONS
================================ */
function createNewChat() {
  const chatId = "chat_" + Date.now();
  const newChat = {
    id: chatId,
    title: "New Chat",
    messages: []
  };

  chats.unshift(newChat);
  activeChatId = chatId;

  saveState();
  renderChatList();
  loadChat(chatId);
}

function loadChat(chatId) {
  activeChatId = chatId;
  messagesContainer.innerHTML = "";

  const chat = chats.find(c => c.id === chatId);
  if (!chat) return;

  chat.messages.forEach(msg => {
    msg.type === "code"
      ? addCodeBlock(msg.content, false)
      : addTextMessage(msg.content, msg.role, false);
  });
  
  saveState();
}

function renderChatList() {
  chatList.innerHTML = "";

  chats.forEach(chat => {
    const chatItem = document.createElement("div");
    chatItem.className = "chat-item";
    if (chat.id === activeChatId) chatItem.classList.add("active");

    const title = document.createElement("span");
    title.innerText = chat.title;
    title.onclick = () => loadChat(chat.id);

    /* ---- Options (⋮) ---- */
    const options = document.createElement("div");
    options.className = "chat-options";

    const dots = document.createElement("span");
    dots.className = "dots";
    dots.innerText = "⋮";

    const menu = document.createElement("div");
    menu.className = "options-menu";

    const renameBtn = document.createElement("button");
    renameBtn.innerText = "Rename";
    renameBtn.onclick = () => renameChat(chat.id);

    const deleteBtn = document.createElement("button");
    deleteBtn.innerText = "Delete";
    deleteBtn.onclick = () => deleteChat(chat.id);

    menu.append(renameBtn, deleteBtn);
    options.append(dots, menu);

    dots.onclick = (e) => {
      e.stopPropagation();
      document.querySelectorAll(".options-menu").forEach(m => m.style.display = "none");
      menu.style.display = "flex";
    };

    chatItem.append(title, options);
    chatList.appendChild(chatItem);
  });

  document.addEventListener("click", () => {
    document.querySelectorAll(".options-menu").forEach(m => m.style.display = "none");
  });
}

function renameChat(chatId) {
  const chat = chats.find(c => c.id === chatId);
  if (!chat) return;

  const newName = prompt("Enter new chat name:", chat.title);
  if (!newName || !newName.trim()) return;

  chat.title = newName.trim();
  saveState();
  renderChatList();
}

function deleteChat(chatId) {
  const confirmDelete = confirm("Are you sure you want to delete this chat?");
  if (!confirmDelete) return;

  chats = chats.filter(c => c.id !== chatId);

  if (activeChatId === chatId) {
    if (chats.length > 0) {
      loadChat(chats[0].id);
    } else {
      createNewChat();
    }
  }

  saveState();
  renderChatList();
}

/* ===============================
   MESSAGE SEND
================================ */
async function sendMessage() {
  const userText = input.value.trim();
  if (!userText) return;

  input.value = "";

  addTextMessage(userText, "user");
  saveMessage("user", userText);

  const thinking = addTextMessage("Thinking... 🤔", "bot");

  try {
    const res = await fetch(GEMINI_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json"},
      body: JSON.stringify({
        contents: [{ parts: [{ text: userText }] }]
      })
    });

    const data = await res.json();
    thinking.remove();

    const aiText =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "Sorry, I couldn't respond.";

    renderAIResponse(aiText);
    updateChatTitle(userText);
  } catch (err) {
    thinking.remove();
    addTextMessage("⚠️ Error connecting to AI", "bot");
  }
}

/* ===============================
   RENDER AI RESPONSE
================================ */
function renderAIResponse(text) {
  const parts = text.split(/```([\s\S]*?)```/g);

  parts.forEach((part, i) => {
    if (i % 2 === 0) {
      if (part.trim()) {
        addTextMessage(part.trim(), "bot");
        saveMessage("bot", part.trim());
      }
    } else {
      addCodeBlock(part.trim());
      saveMessage("bot", part.trim(), "code");
    }
  });
}

/* ===============================
   UI HELPERS
================================ */
function addTextMessage(text, role, scroll = true) {
  const div = document.createElement("div");
  div.className = `message ${role}`;
  div.innerHTML = parseMarkdown(text);
  messagesContainer.appendChild(div);
  if (scroll) messagesContainer.scrollTop = messagesContainer.scrollHeight;
  return div;
}

function addCodeBlock(code, scroll = true) {
  const wrapper = document.createElement("div");
  wrapper.className = "message bot code-wrapper";

  const copy = document.createElement("span");
  copy.className = "copy-btn";
  copy.innerText = "📋";

  const pre = document.createElement("pre");
  const codeEl = document.createElement("code");
  codeEl.innerText = code;

  copy.addEventListener("click", () => {
    navigator.clipboard.writeText(code);
    showToast("Code is copied on clipboard");
  });

  pre.appendChild(codeEl);
  wrapper.append(copy, pre);
  messagesContainer.appendChild(wrapper);

  if (scroll) messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function parseMarkdown(text) {
  return text
    // Headings
    .replace(/^#### (.*$)/gim, "<h4>$1</h4>")
    .replace(/^### (.*$)/gim, "<h3>$1</h3>")
    .replace(/^## (.*$)/gim, "<h2>$1</h2>")
    .replace(/^# (.*$)/gim, "<h1>$1</h1>")

    // Bold + Italic
    .replace(/\*\*\*(.*?)\*\*\*/gim, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.*?)\*\*/gim, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/gim, "<em>$1</em>")

    // Inline code
    .replace(/`(.*?)`/gim, "<code class='text_code'>$1</code>")

    // Line breaks
    .replace(/\n/gim, "<br />");
}


/* ===============================
   STORAGE HELPERS
================================ */
function saveMessage(role, content, type = "text") {
  const chat = chats.find(c => c.id === activeChatId);
  chat.messages.push({ role, content, type });
  saveState();
}

function saveState() {
  localStorage.setItem("trygpt_chats", JSON.stringify(chats));
  localStorage.setItem("trygpt_active_chat", activeChatId);
}

function updateChatTitle(firstUserMsg) {
  const chat = chats.find(c => c.id === activeChatId);
  if (chat && chat.title === "New Chat") {
    chat.title = firstUserMsg.slice(0, 25);
    saveState();
    renderChatList();
  }
}

/* ===============================
   TOAST
================================ */
function showToast(text) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.innerText = text;
  document.body.appendChild(toast);

  setTimeout(() => toast.classList.add("show"), 50);
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 500);
  }, 2000);
}

