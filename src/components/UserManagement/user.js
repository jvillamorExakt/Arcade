(function () {
  if (window.__userManagementLoaded) {
    return;
  }
  window.__userManagementLoaded = true;

  const API_BASE = window.API_BASE || "http://localhost:3001";

  const ROLE_MAP = {
    member: "quester",
    questmaker: "questmaster",
    superadmin: "superadmin",
  };

  function getAuthHeaders() {
    const token = localStorage.getItem("authToken");
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  function getUserRoles() {
    const raw = localStorage.getItem("userRoles");
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.map((role) => String(role).toLowerCase());
        }
      } catch (error) {
        // ignore
      }
    }
    return [];
  }

  function isSuperAdmin() {
    return getUserRoles().some((role) => ["superadmin", "super admin"].includes(role));
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

  function toggleExtraFields(role, extraFieldsDiv) {
    const needsDept = role === "member" || role === "questmaker";
    if (needsDept) {
      extraFieldsDiv.style.display = "block";
    } else {
      extraFieldsDiv.style.display = "none";
      const selects = extraFieldsDiv.querySelectorAll("select");
      selects.forEach((s) => (s.value = ""));
    }
  }

  function mapRoleForApi(role) {
    return ROLE_MAP[role] || role;
  }

  function renderEmptyState(container, message) {
    container.innerHTML = `
      <div class="user-card">
        <div class="user-title">${message}</div>
        <div class="user-detail">Create a new account to get started.</div>
      </div>
    `;
  }

  function buildUserCard(user, departmentMap, categoryMap) {
    const card = document.createElement("div");
    card.className = "user-card";
    card.dataset.id = user.id;

    const roles = Array.isArray(user.roles)
      ? user.roles
      : user.role
        ? [user.role]
        : [];
    const displayRoles = roles.map((role) => role).join(", ");
    const deptName = departmentMap.get(user.departmentId) || user.departmentId || "";
    const categoryName =
      categoryMap.get(user.categoryIds?.[0]) || user.categoryIds?.[0] || "";

    card.innerHTML = `
      <div class="user-title">${user.name || user.username || "Unnamed User"}</div>
      <div class="user-detail">Email: ${user.email || "—"}</div>
      <div class="user-detail">Role: ${displayRoles || "—"}</div>
      ${
        deptName
          ? `<div class="user-detail">Department: ${deptName}</div>
             <div class="user-detail">Sub Department: ${categoryName || "—"}</div>`
          : ""
      }
      <div class="user-actions">
        <a href="#" class="editUserBtn">✏️ Edit</a>
        <a href="#" class="deleteUserBtn">🗑️ Delete</a>
      </div>
    `;
    return card;
  }

  function initManageUsers() {
    const addModal = document.getElementById("userModal");
    const editModal = document.getElementById("editModal");
    const deleteModal = document.getElementById("deleteModal");
    const userCards = document.getElementById("userCards");

    if (!addModal || !userCards) {
      return;
    }

    if (!isSuperAdmin()) {
      userCards.innerHTML = `
        <div class="user-card">
          <div class="user-title">Access restricted</div>
          <div class="user-detail">Super Admin only.</div>
        </div>
      `;
      return;
    }

    const openAddBtn = document.getElementById("openModal");
    const closeBtns = document.querySelectorAll(".modal .close");

    const addRoleSelect = document.getElementById("role");
    const addExtraFields = document.getElementById("extraFields");
    const editRoleSelect = document.getElementById("editRole");
    const editExtraFields = document.getElementById("editExtraFields");

    const departmentSelect = document.getElementById("department");
    const subdepartmentSelect = document.getElementById("subdepartment");
    const editDepartmentSelect = document.getElementById("editDepartment");
    const editSubdepartmentSelect = document.getElementById("editSubdepartment");
    const defaultDepartmentOptions = departmentSelect.innerHTML;
    const defaultEditDepartmentOptions = editDepartmentSelect.innerHTML;
    const defaultSubdepartmentOptions = subdepartmentSelect.innerHTML;
    const defaultEditSubdepartmentOptions = editSubdepartmentSelect.innerHTML;

    let currentEditId = null;
    let currentDeleteId = null;
    let departmentMap = new Map();
    let categoryMap = new Map();
    let userCache = new Map();

    addRoleSelect.addEventListener("change", () =>
      toggleExtraFields(addRoleSelect.value, addExtraFields),
    );
    editRoleSelect.addEventListener("change", () =>
      toggleExtraFields(editRoleSelect.value, editExtraFields),
    );

    departmentSelect.addEventListener("change", () => {
      loadCategories(departmentSelect.value, subdepartmentSelect);
    });
    editDepartmentSelect.addEventListener("change", () => {
      loadCategories(editDepartmentSelect.value, editSubdepartmentSelect);
    });

    openAddBtn.onclick = () => (addModal.style.display = "block");

    closeBtns.forEach(
      (btn) =>
        (btn.onclick = () => (btn.closest(".modal").style.display = "none")),
    );
    window.onclick = (e) => {
      if (e.target.classList.contains("modal")) e.target.style.display = "none";
    };

    async function loadDepartments() {
      const departments = await apiRequest("/api/departments?limit=200");
      if (!departments.length) {
        return;
      }
      departmentMap = new Map(departments.map((dept) => [dept.id, dept.name || dept.id]));
      departmentSelect.innerHTML = defaultDepartmentOptions;
      editDepartmentSelect.innerHTML = defaultEditDepartmentOptions;
      departments.forEach((dept) => {
        const option = document.createElement("option");
        option.value = dept.id;
        option.textContent = dept.name || dept.id;
        if (!departmentSelect.querySelector(`option[value="${dept.id}"]`)) {
          departmentSelect.appendChild(option);
        }
        if (!editDepartmentSelect.querySelector(`option[value="${dept.id}"]`)) {
          editDepartmentSelect.appendChild(option.cloneNode(true));
        }
      });
    }

    async function loadCategories(departmentId, selectEl) {
      if (!departmentId) {
        if (selectEl === subdepartmentSelect) {
          selectEl.innerHTML = defaultSubdepartmentOptions;
        } else {
          selectEl.innerHTML = defaultEditSubdepartmentOptions;
        }
        return;
      }
      const categories = await apiRequest(
        `/api/departments/${departmentId}/categories?limit=200`,
      );
      if (!categories.length) {
        return;
      }
      categoryMap = new Map(categories.map((cat) => [cat.id, cat.name || cat.id]));
      if (selectEl === subdepartmentSelect) {
        selectEl.innerHTML = defaultSubdepartmentOptions;
      } else {
        selectEl.innerHTML = defaultEditSubdepartmentOptions;
      }
      categories.forEach((cat) => {
        const option = document.createElement("option");
        option.value = cat.id;
        option.textContent = cat.name || cat.id;
        if (!selectEl.querySelector(`option[value="${cat.id}"]`)) {
          selectEl.appendChild(option);
        }
      });
    }

    async function loadUsers() {
      const users = await apiRequest("/api/users?limit=200");
      userCache = new Map(users.map((user) => [user.id, user]));
      userCards.innerHTML = "";
      if (!users.length) {
        renderEmptyState(userCards, "No users yet.");
        return;
      }
      users.forEach((user) => {
        const card = buildUserCard(user, departmentMap, categoryMap);
        attachCardEvents(card);
        userCards.appendChild(card);
      });
    }

    function attachCardEvents(card) {
      const editBtn = card.querySelector(".editUserBtn");
      const delBtn = card.querySelector(".deleteUserBtn");
      const userId = card.dataset.id;

      editBtn.onclick = (e) => {
        e.preventDefault();
        const user = userCache.get(userId);
        if (!user) return;
        currentEditId = userId;
        document.getElementById("editFullName").value = user.name || "";
        document.getElementById("editUsername").value = user.username || user.id;
        document.getElementById("editEmail").value = user.email || "";
        document.getElementById("editLevel").value = user.level || "";

        const role = Array.isArray(user.roles)
          ? user.roles[0]
          : user.role || "";
        editRoleSelect.value = role.toLowerCase();
        toggleExtraFields(editRoleSelect.value, editExtraFields);
        editDepartmentSelect.value = user.departmentId || "";
        if (user.departmentId) {
          loadCategories(user.departmentId, editSubdepartmentSelect).then(() => {
            editSubdepartmentSelect.value = user.categoryIds?.[0] || "";
          });
        } else {
          editSubdepartmentSelect.value = "";
        }
        editModal.style.display = "block";
      };

      delBtn.onclick = (e) => {
        e.preventDefault();
        currentDeleteId = userId;
        document.getElementById("deleteUsername").innerText =
          userCache.get(userId)?.name || "this user";
        deleteModal.style.display = "block";
      };
    }

    const addForm = document.getElementById("addUserForm");
    addForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fullName = document.getElementById("fullName").value.trim();
      const username = document.getElementById("username").value.trim();
      const email = document.getElementById("email").value.trim();
      const password = document.getElementById("password").value.trim();
      const role = mapRoleForApi(addRoleSelect.value);

      const payload = {
        fullName,
        username,
        email,
        password,
        roles: role ? [role] : [],
        role,
      };

      const departmentId = departmentSelect.value;
      const categoryId = subdepartmentSelect.value;
      if (departmentId) {
        payload.departmentId = departmentId;
      }
      if (categoryId) {
        payload.categoryIds = [categoryId];
      }

      try {
        await apiRequest("/api/auth/register", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        addModal.style.display = "none";
        addForm.reset();
        addExtraFields.style.display = "none";
        await loadUsers();
      } catch (error) {
        alert(error.message);
      }
    });

    document.getElementById("editUserForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!currentEditId) return;

      const payload = {
        name: document.getElementById("editFullName").value.trim(),
        email: document.getElementById("editEmail").value.trim(),
        role: mapRoleForApi(editRoleSelect.value) || "quester",
        roles: [mapRoleForApi(editRoleSelect.value) || "quester"],
      };

      const departmentId = editDepartmentSelect.value;
      const categoryId = editSubdepartmentSelect.value;
      payload.departmentId = departmentId || "";
      payload.categoryIds = categoryId ? [categoryId] : [];

      try {
        await apiRequest(`/api/users/${currentEditId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        editModal.style.display = "none";
        await loadUsers();
      } catch (error) {
        alert(error.message);
      }
    });

    document.getElementById("confirmDelete").onclick = async () => {
      if (!currentDeleteId) return;
      try {
        await apiRequest(`/api/users/${currentDeleteId}`, { method: "DELETE" });
        deleteModal.style.display = "none";
        currentDeleteId = null;
        await loadUsers();
      } catch (error) {
        alert(error.message);
      }
    };
    document.getElementById("cancelDelete").onclick = () =>
      (deleteModal.style.display = "none");

    Promise.all([loadDepartments(), loadUsers()]).catch((error) => {
      renderEmptyState(userCards, error.message || "Unable to load users.");
    });
  }

  document.addEventListener("DOMContentLoaded", initManageUsers);

  window.addEventListener("hashchange", () => {
    setTimeout(initManageUsers, 600);
  });
})();
