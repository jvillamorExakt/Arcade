(() => {
  if (window.__mainDashboardLoaded) {
    return;
  }
  window.__mainDashboardLoaded = true;

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

  function renderLeaderboard(listEl, entries) {
    if (!listEl) return;
    listEl.innerHTML = "";
    if (!entries.length) {
      const empty = document.createElement("li");
      empty.innerHTML = `<span>#</span> No players yet <em>0 XP</em>`;
      listEl.appendChild(empty);
      return;
    }

    entries.forEach((entry, index) => {
      const item = document.createElement("li");
      item.innerHTML = `<span>#${index + 1}</span> ${entry.name} <em>${entry.currentExp} XP</em>`;
      listEl.appendChild(item);
    });
  }

  async function loadDashboardData() {
    const completedEl = document.getElementById("statCompleted");
    const activeEl = document.getElementById("statActive");
    const pendingEl = document.getElementById("statPending");
    const leaderboardEl = document.getElementById("leaderboardList");

    try {
      const stats = await apiRequest("/api/dashboard/quest-stats");
      if (completedEl) completedEl.textContent = stats.completed ?? 0;
      if (activeEl) activeEl.textContent = stats.active ?? 0;
      if (pendingEl) pendingEl.textContent = stats.pending ?? 0;
    } catch (error) {
      if (completedEl) completedEl.textContent = "—";
      if (activeEl) activeEl.textContent = "—";
      if (pendingEl) pendingEl.textContent = "—";
    }

    try {
      const leaderboard = await apiRequest("/api/leaderboard?limit=10");
      renderLeaderboard(leaderboardEl, Array.isArray(leaderboard) ? leaderboard : []);
    } catch (error) {
      renderLeaderboard(leaderboardEl, []);
    }
  }

  window.loadDashboardData = loadDashboardData;
  document.addEventListener("DOMContentLoaded", loadDashboardData);
})();
