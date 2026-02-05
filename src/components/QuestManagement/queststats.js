const API_BASE = window.API_BASE || "http://localhost:3001";

function getAuthHeaders() {
  const token = localStorage.getItem("authToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiRequest(path) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
  });
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch (error) {
    data = { error: text || "Request failed" };
  }
  if (!response.ok) {
    const message = data.error || data.errors || text || `Request failed (${response.status})`;
    throw new Error(message);
  }
  return data;
}

function renderTopQuests(container, quests) {
  container.innerHTML = "";
  if (!quests.length) {
    const empty = document.createElement("div");
    empty.className = "quest-card";
    empty.innerHTML = `
      <div class="quest-title">No quest data yet.</div>
      <div class="quest-stats">
        <div class="stat-box">
          <div class="stat-value">+0 🌟</div>
          <div class="stat-label">EXP</div>
        </div>
        <div class="stat-box">
          <div class="stat-value">+0 🪙</div>
          <div class="stat-label">GOLD</div>
        </div>
      </div>
    `;
    container.appendChild(empty);
    return;
  }

  quests.forEach((quest) => {
    const card = document.createElement("div");
    card.className = "quest-card";
    card.innerHTML = `
      <div class="quest-title">${quest.title || "Untitled Quest"}</div>
      <div class="quest-stats">
        <div class="stat-box">
          <div class="stat-value">+${quest.expReward || 0} 🌟</div>
          <div class="stat-label">EXP</div>
        </div>
        <div class="stat-box">
          <div class="stat-value">+${quest.goldReward || 0} 🪙</div>
          <div class="stat-label">GOLD</div>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

async function initQuestStats() {
  const totalQuestsEl = document.getElementById("totalQuests");
  const totalExpEl = document.getElementById("totalExp");
  const totalGoldEl = document.getElementById("totalGold");
  const activeEl = document.getElementById("activeQuests");
  const completedEl = document.getElementById("completedQuests");
  const pendingEl = document.getElementById("pendingQuests");
  const topQuestsEl = document.getElementById("topQuests");

  if (!topQuestsEl) {
    return;
  }

  try {
    const stats = await apiRequest("/api/quests/stats");
    if (totalQuestsEl) totalQuestsEl.textContent = stats.totalQuests || 0;
    if (totalExpEl) totalExpEl.textContent = stats.totalExpAwarded || 0;
    if (totalGoldEl) totalGoldEl.textContent = stats.totalGoldAwarded || 0;
    if (activeEl) activeEl.textContent = stats.active || 0;
    if (completedEl) completedEl.textContent = stats.completed || 0;
    if (pendingEl) pendingEl.textContent = stats.pending || 0;

    const quests = await apiRequest("/api/quests/manage?limit=5");
    renderTopQuests(topQuestsEl, quests);
  } catch (error) {
    renderTopQuests(topQuestsEl, []);
    if (totalQuestsEl) totalQuestsEl.textContent = "—";
    if (totalExpEl) totalExpEl.textContent = "—";
    if (totalGoldEl) totalGoldEl.textContent = "—";
    if (activeEl) activeEl.textContent = "—";
    if (completedEl) completedEl.textContent = "—";
    if (pendingEl) pendingEl.textContent = "—";
  }
}

document.addEventListener("DOMContentLoaded", initQuestStats);
