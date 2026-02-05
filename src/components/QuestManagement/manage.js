(() => {
  if (window.__questManagementScriptLoaded) {
    return;
  }
  window.__questManagementScriptLoaded = true;

  const API_BASE = window.API_BASE || "http://localhost:3001";

  const typingSound = new Audio("../../sounds/typing1.wav");
  typingSound.volume = 0.5;
  typingSound.preload = "auto";

  function playSound(type) {
    if (type === "type") {
      typingSound.currentTime = 0;
      typingSound.play().catch(() => {});
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

  function toggleQuestTypeFields(type) {
    const specificUsersWrapper = document.getElementById("specificUsersWrapper");
    const groupLimitWrapper = document.getElementById("groupLimitWrapper");
    const specificUsers = document.getElementById("specificUsers");
    const groupLimit = document.getElementById("groupLimit");

  specificUsersWrapper.style.display = "none";
  groupLimitWrapper.style.display = "none";
  specificUsers.removeAttribute("required");
  groupLimit.removeAttribute("required");

    if (type === "specific") {
      specificUsersWrapper.style.display = "block";
      specificUsers.setAttribute("required", "required");
    } else if (type === "group") {
      groupLimitWrapper.style.display = "block";
      groupLimit.setAttribute("required", "required");
    }
  }

  function createQuestCard(quest, userMap) {
    const card = document.createElement("div");
    card.className = "quest-card";
    card.dataset.id = quest.id;

  const exp = Number(quest.expReward || 0);
  const gold = Number(quest.goldReward || 0);
  const difficulty = Number(quest.difficulty || 0);
  const questType = quest.questType || "open";
  const assignedUserIds = Array.isArray(quest.assignedUserIds) ? quest.assignedUserIds : [];
  const assignedNames = assignedUserIds
    .map((id) => userMap.get(id))
    .filter(Boolean)
    .join(", ");
  const typeLabel = questType.charAt(0).toUpperCase() + questType.slice(1);
  const additionalInfo =
    questType === "specific"
      ? ` | Assigned to: ${assignedNames || "None"}`
      : questType === "group"
        ? ` | Max Members: ${quest.groupLimit || "∞"}`
        : "";

  card.innerHTML = `
    <div class="quest-title">${quest.title || "Untitled Quest"}</div>
    <div class="quest-desc">${quest.description || "No description yet."}</div>
    <div class="quest-type-badge" style="font-size: 0.5rem; color: #ff8c00; margin-top: 8px;">
      ${typeLabel}${additionalInfo}
    </div>
    <div class="quest-stats">
      <div class="stat-box">
        <div class="stat-value">+${exp} 🌟</div>
        <div class="stat-label">EXP</div>
      </div>
      <div class="stat-box">
        <div class="stat-value">+${gold} 🪙</div>
        <div class="stat-label">GOLD</div>
      </div>
    </div>
    <div class="quest-actions">
      <a href="#" class="editQuestBtn">✏️ Edit</a>
      <a href="#" class="deleteQuestBtn">🗑️ Delete</a>
      <a href="#" class="viewDetailsBtn">🔍 View Details</a>
      <a href="#" class="completeQuestBtn">✅ Mark Complete</a>
    </div>
  `;

  card.dataset.meta = JSON.stringify({
    exp,
    gold,
    difficulty,
    questType,
    assignedUserIds,
    groupLimit: quest.groupLimit || null,
    status: quest.status || "open",
  });

    return card;
  }

  function initManageQuest() {
    const questModal = document.getElementById("questModal");
    if (!questModal || questModal.dataset.bound === "true") {
      return false;
    }
    questModal.dataset.bound = "true";

  const questModalTitle = document.getElementById("questModalTitle");
  const openAddQuestBtn = document.getElementById("openAddQuestBtn");
  const closeBtns = document.querySelectorAll(".close");
  const questForm = document.getElementById("questForm");
  const questCards = document.getElementById("questCards");
  const deleteModal = document.getElementById("deleteModal");
  const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");
  const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");

  const viewModal = document.getElementById("viewDetailsModal");
  const viewQuestTitle = document.getElementById("viewQuestTitle");
  const viewQuestDesc = document.getElementById("viewQuestDesc");
  const viewQuestExp = document.getElementById("viewQuestExp");
  const viewQuestGold = document.getElementById("viewQuestGold");
  const viewQuestDiff = document.getElementById("viewQuestDiff");
  const viewQuestType = document.getElementById("viewQuestType");
  const viewQuestStatus = document.getElementById("viewQuestStatus");
  const viewQuestDepartment = document.getElementById("viewQuestDepartment");
  const viewQuestCategory = document.getElementById("viewQuestCategory");
  const viewAssignedUser = document.getElementById("viewAssignedUser");

  const questTypeSelect = document.getElementById("questType");
  const specificUsersSelect = document.getElementById("specificUsers");
  const departmentSelect = document.getElementById("departmentSelect");
  const categorySelect = document.getElementById("categorySelect");
  const defaultDepartmentOptions = departmentSelect.innerHTML;
  const defaultCategoryOptions = categorySelect.innerHTML;
  let profileDepartmentId = "";
  let profileCategoryId = "";

  let currentEditId = null;
  let currentDeleteId = null;
  let questCache = new Map();
  let userMap = new Map();
  let departmentMap = new Map();
  let categoryMap = new Map();

  let lastTypeTime = 0;
  const inputs = questForm.querySelectorAll("input, textarea");
  inputs.forEach((input) => {
    input.addEventListener("input", () => {
      const now = Date.now();
      if (now - lastTypeTime > 80) {
        playSound("type");
        lastTypeTime = now;
      }
    });
  });

  questTypeSelect.addEventListener("change", (e) => {
    toggleQuestTypeFields(e.target.value);
  });

  departmentSelect.addEventListener("change", async (e) => {
    const departmentId = e.target.value;
    await loadCategories(departmentId);
  });

  openAddQuestBtn.onclick = () => {
    questModalTitle.innerText = "➕ Add Quest";
    questForm.reset();
    currentEditId = null;
    toggleQuestTypeFields("");
    applyProfileSelection();
    questModal.style.display = "block";
  };

  closeBtns.forEach(
    (btn) =>
      (btn.onclick = () => {
        questModal.style.display = "none";
        deleteModal.style.display = "none";
        viewModal.style.display = "none";
      }),
  );

  window.onclick = (e) => {
    if (e.target === questModal) questModal.style.display = "none";
    if (e.target === deleteModal) deleteModal.style.display = "none";
    if (e.target === viewModal) viewModal.style.display = "none";
  };

  async function loadUsers() {
    const users = await apiRequest("/api/users?limit=200");
    userMap = new Map(users.map((user) => [user.id, user.name || user.username || user.id]));
    specificUsersSelect.innerHTML = "";
    users.forEach((user) => {
      const option = document.createElement("option");
      option.value = user.id;
      option.textContent = user.name || user.username || user.id;
      specificUsersSelect.appendChild(option);
    });
  }

  async function loadCurrentProfile() {
    const userId = localStorage.getItem("userId");
    if (!userId) {
      return;
    }
    const profile = await apiRequest(`/api/users/${userId}`);
    profileDepartmentId = profile.departmentId || "";
    profileCategoryId = Array.isArray(profile.categoryIds) ? profile.categoryIds[0] : "";
  }

  function applyProfileSelection() {
    if (!profileDepartmentId) {
      return;
    }
    if (!departmentSelect.querySelector(`option[value="${profileDepartmentId}"]`)) {
      const option = document.createElement("option");
      option.value = profileDepartmentId;
      option.textContent = profileDepartmentId;
      departmentSelect.appendChild(option);
    }
    departmentSelect.value = profileDepartmentId;
    loadCategories(profileDepartmentId).then(() => {
      if (profileCategoryId) {
        if (!categorySelect.querySelector(`option[value="${profileCategoryId}"]`)) {
          const option = document.createElement("option");
          option.value = profileCategoryId;
          option.textContent = profileCategoryId;
          categorySelect.appendChild(option);
        }
        categorySelect.value = profileCategoryId;
      }
    });
  }

  async function loadDepartments() {
    const departments = await apiRequest("/api/departments?limit=200");
    departmentMap = new Map(departments.map((dept) => [dept.id, dept.name || dept.id]));
    departmentSelect.innerHTML = defaultDepartmentOptions;
    departments.forEach((dept) => {
      const option = document.createElement("option");
      option.value = dept.id;
      option.textContent = dept.name || dept.id;
      if (!departmentSelect.querySelector(`option[value="${dept.id}"]`)) {
        departmentSelect.appendChild(option);
      }
    });
    applyProfileSelection();
  }

  async function loadCategories(departmentId) {
    categorySelect.innerHTML = defaultCategoryOptions;
    categoryMap = new Map();
    if (!departmentId) {
      return;
    }
    const categories = await apiRequest(`/api/departments/${departmentId}/categories?limit=200`);
    categoryMap = new Map(categories.map((cat) => [cat.id, cat.name || cat.id]));
    categories.forEach((cat) => {
      const option = document.createElement("option");
      option.value = cat.id;
      option.textContent = cat.name || cat.id;
      if (!categorySelect.querySelector(`option[value="${cat.id}"]`)) {
        categorySelect.appendChild(option);
      }
    });
  }

  async function loadQuests() {
    const quests = await apiRequest("/api/quests/manage?limit=200");
    questCache = new Map(quests.map((quest) => [quest.id, quest]));
    questCards.innerHTML = "";
    if (!quests.length) {
      const empty = document.createElement("div");
      empty.className = "quest-card";
      empty.innerHTML = `
        <div class="quest-title">No quests yet.</div>
        <div class="quest-desc">Create your first quest to get started.</div>
      `;
      questCards.appendChild(empty);
      return;
    }

    quests.forEach((quest) => {
      const card = createQuestCard(quest, userMap);
      attachCardEvents(card);
      questCards.appendChild(card);
    });
  }

  questForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = questForm.title.value.trim();
    const description = questForm.desc.value.trim();
    const expReward = Number(questForm.exp.value);
    const goldReward = Number(questForm.gold.value);
    const difficulty = Number(questForm.diff.value);
    const questType = questForm.questType.value;

    const payload = {
      title,
      description,
      expReward,
      goldReward,
      difficulty,
      questType,
    };

    if (questType === "specific") {
      payload.assignedUserIds = Array.from(specificUsersSelect.selectedOptions)
        .map((option) => option.value)
        .filter(Boolean);
    } else if (!currentEditId && questType === "open") {
      payload.assignedUserIds = [];
    }

    if (questType === "group") {
      const groupLimit = Number(questForm.groupLimit.value || 0);
      payload.groupLimit = groupLimit && groupLimit > 0 ? groupLimit : null;
    }

    payload.status = questForm.status.value || "open";
    payload.departmentId = departmentSelect.value || profileDepartmentId || "";
    payload.categoryId = categorySelect.value || profileCategoryId || "";

    try {
      if (currentEditId) {
        await apiRequest(`/api/quests/${currentEditId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        await apiRequest("/api/quests", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      questForm.reset();
      toggleQuestTypeFields("");
      questModal.style.display = "none";
      await loadQuests();
    } catch (error) {
      alert(error.message);
    }
  });

  function attachCardEvents(card) {
    const editBtn = card.querySelector(".editQuestBtn");
    const deleteBtn = card.querySelector(".deleteQuestBtn");
    const viewBtn = card.querySelector(".viewDetailsBtn");
    const completeBtn = card.querySelector(".completeQuestBtn");
    const questId = card.dataset.id;

    editBtn.onclick = (e) => {
      e.preventDefault();
      const quest = questCache.get(questId);
      if (!quest) return;
      currentEditId = questId;
      questModalTitle.innerText = "✏️ Edit Quest";
      questForm.title.value = quest.title || "";
      questForm.desc.value = quest.description || "";
      questForm.exp.value = quest.expReward || 0;
      questForm.gold.value = quest.goldReward || 0;
      questForm.diff.value = quest.difficulty || 0;
      questForm.questType.value = quest.questType || "open";
      questForm.status.value = quest.status || "open";
      toggleQuestTypeFields(quest.questType || "open");

      if (quest.questType === "specific") {
        const ids = Array.isArray(quest.assignedUserIds) ? quest.assignedUserIds : [];
        Array.from(specificUsersSelect.options).forEach((option) => {
          option.selected = ids.includes(option.value);
        });
      }
      if (quest.questType === "group") {
        questForm.groupLimit.value = quest.groupLimit || "";
      }
      departmentSelect.value = quest.departmentId || "";
      if (quest.departmentId) {
        loadCategories(quest.departmentId).then(() => {
          categorySelect.value = quest.categoryId || "";
        });
      } else {
        categorySelect.value = "";
      }
      questModal.style.display = "block";
    };

    deleteBtn.onclick = (e) => {
      e.preventDefault();
      currentDeleteId = questId;
      deleteModal.style.display = "block";
    };

    if (viewBtn) {
      viewBtn.onclick = (e) => {
        e.preventDefault();
        const quest = questCache.get(questId);
        if (!quest) return;
        viewQuestTitle.textContent = quest.title || "Quest Details";
        viewQuestDesc.textContent = quest.description || "No description.";
        viewQuestExp.textContent = quest.expReward || 0;
        viewQuestGold.textContent = quest.goldReward || 0;
        viewQuestDiff.textContent = quest.difficulty || 0;
        viewQuestType.textContent = quest.questType || "open";
        viewQuestStatus.textContent = quest.status || "open";
        viewQuestDepartment.textContent =
          departmentMap.get(quest.departmentId) || quest.departmentId || "—";
        viewQuestCategory.textContent =
          categoryMap.get(quest.categoryId) || quest.categoryId || "—";
        const assignedIds = Array.isArray(quest.assignedUserIds) ? quest.assignedUserIds : [];
        const assignedNames = assignedIds
          .map((id) => userMap.get(id))
          .filter(Boolean)
          .join(", ");
        viewAssignedUser.textContent = assignedNames || "None";
        viewModal.style.display = "block";
      };
    }

    if (completeBtn) {
      completeBtn.onclick = async (e) => {
        e.preventDefault();
        try {
          await apiRequest(`/api/quests/${questId}`, {
            method: "PATCH",
            body: JSON.stringify({ status: "completed", isActive: false }),
          });
          await loadQuests();
        } catch (error) {
          alert(error.message);
        }
      };
    }
  }

  confirmDeleteBtn.onclick = async () => {
    if (!currentDeleteId) return;
    try {
      await apiRequest(`/api/quests/${currentDeleteId}`, { method: "DELETE" });
      deleteModal.style.display = "none";
      currentDeleteId = null;
      await loadQuests();
    } catch (error) {
      alert(error.message);
    }
  };

  cancelDeleteBtn.onclick = () => {
    deleteModal.style.display = "none";
    currentDeleteId = null;
  };

  Promise.all([loadCurrentProfile(), loadUsers(), loadDepartments(), loadQuests()]).catch(
    (error) => {
    const fallback = document.createElement("div");
    fallback.className = "quest-card";
    fallback.innerHTML = `
      <div class="quest-title">Unable to load quests</div>
      <div class="quest-desc">${error.message}</div>
    `;
    questCards.appendChild(fallback);
    },
  );
    return true;
  }

  function ensureManageQuestReady() {
    initManageQuest();
  }

  document.addEventListener("DOMContentLoaded", ensureManageQuestReady);

  window.addEventListener("hashchange", () => {
    setTimeout(ensureManageQuestReady, 600);
  });

  const mainContent = document.getElementById("main-content");
  if (mainContent) {
    const observer = new MutationObserver(() => {
      ensureManageQuestReady();
    });
    observer.observe(mainContent, { childList: true, subtree: true });
  }
})();
