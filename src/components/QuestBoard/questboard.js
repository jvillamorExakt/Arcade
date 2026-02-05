(function () {
  if (window.__questBoardScriptLoaded) {
    return;
  }
  window.__questBoardScriptLoaded = true;

  const API_BASE = window.API_BASE || "http://localhost:3001";

  // Create Audio object for jump sound
  const jumpSound = new Audio("../../sounds/jump1.wav");
  jumpSound.volume = 0.5;
  jumpSound.preload = "auto";

  // Play sound function
  function playSound(type) {
    if (type === "jump") {
      jumpSound.currentTime = 0;
      jumpSound.play().catch(() => {});
    }
  }

  function getAuthHeaders() {
    const token = localStorage.getItem("authToken");
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async function apiRequest(path, options = {}) {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
        ...(options.headers || {}),
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

  function normalizeId(value) {
    return typeof value === "string" ? value.trim().toLowerCase() : "";
  }

  function getStoredProfile() {
    const raw = localStorage.getItem("userProfile");
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (error) {
      return null;
    }
  }

  async function fetchCurrentProfile() {
    const userId = localStorage.getItem("userId");
    if (!userId) {
      return null;
    }
    const response = await fetch(`${API_BASE}/api/users/${userId}`, {
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      },
    });
    if (!response.ok) {
      return getStoredProfile();
    }
    const profile = await response.json();
    localStorage.setItem("userProfile", JSON.stringify(profile));
    return profile;
  }

  function questMatchesProfile(quest, profile) {
    if (!profile?.departmentId) {
      return false;
    }
    const profileDept = normalizeId(profile.departmentId);
    const questDept = normalizeId(quest.departmentId);
    if (!questDept || questDept !== profileDept) {
      return false;
    }
    const profileCategories = [
      ...(Array.isArray(profile.categoryIds) ? profile.categoryIds : []),
      ...(profile.categoryId ? [profile.categoryId] : []),
    ];
    const questCategories = [
      ...(Array.isArray(quest.categoryIds) ? quest.categoryIds : []),
      ...(quest.categoryId ? [quest.categoryId] : []),
    ];
    if (!questCategories.length) {
      return true;
    }
    const profileSet = new Set(
      profileCategories.map((cat) => normalizeId(cat)).filter(Boolean),
    );
    return questCategories.some((cat) => profileSet.has(normalizeId(cat)));
  }

  let departmentMap = new Map();
  let categoryMap = new Map();
  let userMap = new Map();

  async function loadDepartments() {
    try {
      const departments = await apiRequest("/api/departments?limit=200");
      departmentMap = new Map(
        (Array.isArray(departments) ? departments : []).map((dept) => [
          dept.id,
          dept.name || dept.id,
        ]),
      );
    } catch (error) {
      departmentMap = new Map();
    }
  }

  async function loadCategories(departmentId) {
    if (!departmentId) {
      return;
    }
    try {
      const categories = await apiRequest(
        `/api/departments/${departmentId}/categories?limit=200`,
      );
      categoryMap = new Map(
        (Array.isArray(categories) ? categories : []).map((cat) => [
          cat.id,
          cat.name || cat.id,
        ]),
      );
    } catch (error) {
      categoryMap = new Map();
    }
  }

  async function loadUsers() {
    try {
      const users = await apiRequest("/api/users?limit=200");
      userMap = new Map(
        (Array.isArray(users) ? users : []).map((user) => [
          user.id,
          user.name || user.username || user.id,
        ]),
      );
    } catch (error) {
      userMap = new Map();
    }
  }

  function getViewModalElements() {
    const viewModal = document.getElementById("viewDetailsModal");
    if (!viewModal) {
      return null;
    }
    return {
      viewModal,
      viewQuestTitle: document.getElementById("viewQuestTitle"),
      viewQuestDesc: document.getElementById("viewQuestDesc"),
      viewQuestExp: document.getElementById("viewQuestExp"),
      viewQuestGold: document.getElementById("viewQuestGold"),
      viewQuestDiff: document.getElementById("viewQuestDiff"),
      viewQuestType: document.getElementById("viewQuestType"),
      viewQuestStatus: document.getElementById("viewQuestStatus"),
      viewQuestDepartment: document.getElementById("viewQuestDepartment"),
      viewQuestCategory: document.getElementById("viewQuestCategory"),
      viewAssignedUser: document.getElementById("viewAssignedUser"),
    };
  }

  function openViewModal(quest) {
    const els = getViewModalElements();
    if (!els) return;
    const {
      viewModal,
      viewQuestTitle,
      viewQuestDesc,
      viewQuestExp,
      viewQuestGold,
      viewQuestDiff,
      viewQuestType,
      viewQuestStatus,
      viewQuestDepartment,
      viewQuestCategory,
      viewAssignedUser,
    } = els;

    viewQuestTitle.textContent = quest.title || "Quest Details";
    viewQuestDesc.textContent = quest.description || "No description.";
    viewQuestExp.textContent = quest.expReward || 0;
    viewQuestGold.textContent = quest.goldReward || 0;
    viewQuestDiff.textContent = quest.difficulty || 0;
    viewQuestType.textContent = quest.questType || "open";
    viewQuestStatus.textContent = quest.status || "open";
    viewQuestDepartment.textContent =
      departmentMap.get(quest.departmentId) || quest.departmentId || "—";

    const questCategory =
      quest.categoryId ||
      (Array.isArray(quest.categoryIds) ? quest.categoryIds[0] : "") ||
      "";
    viewQuestCategory.textContent =
      categoryMap.get(questCategory) || questCategory || "—";

    const assignedIds = Array.isArray(quest.assignedUserIds) ? quest.assignedUserIds : [];
    const assignedNames = assignedIds
      .map((id) => userMap.get(id) || id)
      .filter(Boolean)
      .join(", ");
    viewAssignedUser.textContent = assignedNames || "None";

    viewModal.style.display = "block";

    if (quest.departmentId) {
      loadCategories(quest.departmentId).then(() => {
        const updatedCategory =
          quest.categoryId ||
          (Array.isArray(quest.categoryIds) ? quest.categoryIds[0] : "") ||
          "";
        viewQuestCategory.textContent =
          categoryMap.get(updatedCategory) || updatedCategory || "—";
      });
    }
  }

  function bindViewModalClose() {
    const els = getViewModalElements();
    if (!els) return;
    const { viewModal } = els;
    if (viewModal.dataset.bound === "true") {
      return;
    }
    viewModal.dataset.bound = "true";

    const closeBtn = viewModal.querySelector(".close");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        viewModal.style.display = "none";
      });
    }
    window.addEventListener("click", (event) => {
      if (event.target === viewModal) {
        viewModal.style.display = "none";
      }
    });
  }

  function setGridMessage(grid, message) {
    if (!grid) return;
    grid.innerHTML = "";
    const note = document.createElement("div");
    note.className = "quest-card";
    note.innerHTML = `
      <div class="quest-info">
        <div class="quest-title">${message}</div>
        <div class="quest-desc">Try refreshing or check your login.</div>
      </div>
    `;
    grid.appendChild(note);
  }

  function buildQuestCard(quest, tab, onAction) {
    const card = document.createElement("div");
    card.className = "quest-card";

  const exp = Number(quest.expReward || 0);
  const gold = Number(quest.goldReward || 0);
  const assignedCount = Array.isArray(quest.assignedUserIds)
    ? quest.assignedUserIds.length
    : 0;
  const groupLimit = typeof quest.groupLimit === "number" ? quest.groupLimit : null;
  const groupMeta = groupLimit ? `${assignedCount}/${groupLimit} members` : `${assignedCount} members`;
  const statusLabel = quest.status || "open";

  const actions = [];

  if (tab === "open") {
    actions.push({ label: "ACCEPT", className: "quest-btn-primary", action: "claim" });
    actions.push({ label: "VIEW", className: "quest-btn-secondary", action: "view" });
  } else if (tab === "my") {
    actions.push({ label: "VIEW", className: "quest-btn-secondary", action: "view" });
    actions.push({ label: "START", className: "quest-btn-secondary", action: "start" });
    actions.push({ label: "DONE", className: "quest-btn-success", action: "done" });
  } else if (tab === "group") {
    actions.push({ label: "JOIN", className: "quest-btn-primary", action: "join" });
    actions.push({ label: "VIEW", className: "quest-btn-secondary", action: "view" });
  }

  card.innerHTML = `
    <div class="quest-stats">
      <div class="stat-box">
        <div class="stat-value">+${exp}</div>
        <div class="stat-label">EXP</div>
      </div>
      <div class="stat-box">
        <div class="stat-value">+${gold}🪙</div>
        <div class="stat-label">GOLD</div>
      </div>
    </div>
    <div class="quest-info">
      <div class="quest-title">${quest.title || "Untitled Quest"}</div>
      <div class="quest-desc">${quest.description || "No description yet."}</div>
      <div class="quest-desc" style="margin-top: 10px;">
        Status: ${statusLabel}
        ${tab === "group" ? ` | ${groupMeta}` : ""}
      </div>
      ${
        actions.length
          ? `<div class="quest-actions">
              ${actions
                .map(
                  (action) =>
                    `<button class="quest-btn ${action.className}" data-action="${action.action}">${action.label}</button>`,
                )
                .join("")}
            </div>`
          : ""
      }
    </div>
  `;

  const actionButtons = card.querySelectorAll(".quest-actions button");
  actionButtons.forEach((button) => {
    button.addEventListener("click", () => {
      playSound("jump");
      const actionType = button.dataset.action;
      if (actionType === "claim" || actionType === "join") {
        onAction(quest);
        } else if (actionType === "view") {
          openViewModal(quest);
      }
    });
  });

    return card;
  }

  async function fetchBoard(tab) {
    const response = await fetch(`${API_BASE}/api/quests?view=board&tab=${tab}`, {
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      },
    });

  const text = await response.text();
  let data = [];
  try {
    data = text ? JSON.parse(text) : [];
  } catch (error) {
    data = [];
  }

  if (!response.ok) {
    const message =
      data?.error || data?.errors || text || `Failed to load quests (${response.status})`;
    throw new Error(message);
  }

    return Array.isArray(data) ? data : [];
  }

  async function handleQuestAction(tab, quest) {
    const actionEndpoint = tab === "open" ? "claim" : "join";
    const response = await fetch(`${API_BASE}/api/quests/${quest.id}/${actionEndpoint}`, {
      method: "POST",
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
    data = {};
  }

  if (!response.ok) {
    const message =
      data?.error || data?.errors || text || `Action failed (${response.status})`;
    throw new Error(message);
  }

    return data;
  }

  async function loadTab(tab, grid) {
    if (!grid) return;
    grid.innerHTML = "";
    try {
      let quests = await fetchBoard(tab);
      if (tab === "open") {
        const profile = await fetchCurrentProfile();
        if (!profile) {
          setGridMessage(grid, "No profile data found for filtering quests.");
          return;
        }
        quests = quests.filter((quest) => questMatchesProfile(quest, profile));
      }
      if (!quests.length) {
        setGridMessage(grid, "No quests available right now.");
        return;
      }

      quests.forEach((quest) => {
        const card = buildQuestCard(quest, tab, async (selected) => {
          try {
            await handleQuestAction(tab, selected);
            await loadTab(tab, grid);
          } catch (error) {
            setGridMessage(grid, error.message);
          }
        });
        grid.appendChild(card);
      });
    } catch (error) {
      setGridMessage(grid, error.message);
    }
  }

  function activateTab(targetTab) {
    const tabBtns = document.querySelectorAll(".tab-btn");
    const tabContents = document.querySelectorAll(".tab-content");
    const openGrid = document.getElementById("openQuestGrid");
    const myGrid = document.getElementById("myQuestGrid");
    const groupGrid = document.getElementById("groupQuestGrid");

    if (!tabBtns.length || !tabContents.length || !openGrid || !myGrid || !groupGrid) {
      return false;
    }

    tabBtns.forEach((b) => b.classList.remove("active"));
    tabContents.forEach((c) => c.classList.remove("active"));

    const targetButton = Array.from(tabBtns).find(
      (btn) => btn.getAttribute("data-tab") === targetTab,
    );
    const targetContent = document.getElementById(targetTab);
    if (!targetButton || !targetContent) {
      return false;
    }

    targetButton.classList.add("active");
    targetContent.classList.add("active");

    if (targetTab === "open-quest") {
      loadTab("open", openGrid);
    } else if (targetTab === "my-quest") {
      loadTab("my", myGrid);
    } else {
      loadTab("group", groupGrid);
    }

    return true;
  }

  function initQuestTabs() {
    const tabContainer = document.querySelector(".quest-tabs");
    if (!tabContainer || tabContainer.dataset.bound === "true") {
      return false;
    }

    if (!activateTab("open-quest")) {
      return false;
    }

    tabContainer.dataset.bound = "true";
    return true;
  }

  function ensureQuestTabsReady() {
    initQuestTabs();
    bindViewModalClose();
  }

  document.addEventListener("DOMContentLoaded", ensureQuestTabsReady);

  window.addEventListener("hashchange", () => {
    setTimeout(ensureQuestTabsReady, 600);
  });

  if (!window.__questBoardClickBound) {
    window.__questBoardClickBound = true;
    document.addEventListener("click", (event) => {
      const btn = event.target.closest(".tab-btn");
      if (!btn) return;
      if (!document.querySelector(".quest-tabs")) return;
      event.preventDefault();
      const targetTab = btn.getAttribute("data-tab");
      if (targetTab) {
        activateTab(targetTab);
      }
    });
  }

  Promise.all([loadDepartments(), loadUsers()]).catch(() => {});

  const mainContent = document.getElementById("main-content");
  if (mainContent) {
    const observer = new MutationObserver(() => {
      ensureQuestTabsReady();
    });
    observer.observe(mainContent, { childList: true, subtree: true });
  }
})();