function initManageUsers() {
  console.log("initManageUsers called!");

  const addModal = document.getElementById("userModal");
  const editModal = document.getElementById("editModal");
  const deleteModal = document.getElementById("deleteModal");

  // Exit if not on user management page
  if (!addModal) {
    console.log("User modal not found - not on user management page");
    return;
  }

  const openAddBtn = document.getElementById("openModal");
  const closeBtns = document.querySelectorAll(".modal .close");

  let currentEditCard = null;
  let currentDeleteCard = null;

  // Show/hide extra fields (Department/Sub Department)
  const addRoleSelect = document.getElementById("role");
  const addExtraFields = document.getElementById("extraFields");

  const editRoleSelect = document.getElementById("editRole");
  const editExtraFields = document.getElementById("editExtraFields");

  function toggleExtraFields(roleValue, extraFieldsDiv) {
    if (roleValue === "member" || roleValue === "questmaker") {
      extraFieldsDiv.style.display = "block";
    } else {
      extraFieldsDiv.style.display = "none";
      const selects = extraFieldsDiv.querySelectorAll("select");
      selects.forEach((s) => (s.value = ""));
    }
  }

  // Add modal role change
  addRoleSelect.addEventListener("change", () =>
    toggleExtraFields(addRoleSelect.value, addExtraFields),
  );

  // Edit modal role change
  editRoleSelect.addEventListener("change", () =>
    toggleExtraFields(editRoleSelect.value, editExtraFields),
  );

  // Open Add Modal
  openAddBtn.onclick = () => (addModal.style.display = "block");

  // Close modals
  closeBtns.forEach(
    (btn) =>
      (btn.onclick = () => (btn.closest(".modal").style.display = "none")),
  );
  window.onclick = (e) => {
    if (e.target.classList.contains("modal")) e.target.style.display = "none";
  };

  // Add User
  const addForm = document.getElementById("addUserForm");
  addForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const username = document.getElementById("username").value;
    const email = document.getElementById("email").value;
    const level = document.getElementById("level").value;
    const role = addRoleSelect.value;

    // Get extra fields if visible
    const department =
      addExtraFields.style.display === "block"
        ? document.getElementById("department").value
        : "";
    const subdepartment =
      addExtraFields.style.display === "block"
        ? document.getElementById("subdepartment").value
        : "";

    const userCards = document.querySelector(".user-cards");
    const newCard = document.createElement("div");
    newCard.className = "user-card";
    newCard.innerHTML = `
      <div class="user-title">${username}</div>
      <div class="user-detail">Email: ${email}</div>
      <div class="user-detail">Level: ${level}</div>
      <div class="user-detail">Role: ${role}</div>
      ${
        department && subdepartment
          ? `<div class="user-detail">Department: ${department}</div>
             <div class="user-detail">Sub Department: ${subdepartment}</div>`
          : ""
      }
      <div class="user-actions">
        <a href="#">✏️ Edit</a>
        <a href="#">🗑️ Delete</a>
      </div>
    `;
    userCards.appendChild(newCard);
    addModal.style.display = "none";
    addForm.reset();
    addExtraFields.style.display = "none"; // reset extra fields visibility
    attachCardEvents(newCard);
  });

  // Attach Edit/Delete events to a card
  function attachCardEvents(card) {
    const editBtn = card.querySelector(".user-actions a:nth-child(1)");
    const delBtn = card.querySelector(".user-actions a:nth-child(2)");

    editBtn.onclick = (e) => {
      e.preventDefault();
      currentEditCard = card;
      document.getElementById("editUsername").value =
        card.querySelector(".user-title").innerText;
      document.getElementById("editEmail").value = card
        .querySelector(".user-detail:nth-child(2)")
        .innerText.replace("Email: ", "");
      document.getElementById("editLevel").value = card
        .querySelector(".user-detail:nth-child(3)")
        .innerText.replace("Level: ", "");
      document.getElementById("editRole").value = card
        .querySelector(".user-detail:nth-child(4)")
        .innerText.replace("Role: ", "");

      // Set extra fields if they exist
      if (card.querySelector(".user-detail:nth-child(5)")) {
        editExtraFields.style.display = "block";
        document.getElementById("editDepartment").value = card
          .querySelector(".user-detail:nth-child(5)")
          .innerText.replace("Department: ", "");
        document.getElementById("editSubdepartment").value = card
          .querySelector(".user-detail:nth-child(6)")
          .innerText.replace("Sub Department: ", "");
      } else {
        editExtraFields.style.display = "none";
        document.getElementById("editDepartment").value = "";
        document.getElementById("editSubdepartment").value = "";
      }

      editModal.style.display = "block";
    };

    delBtn.onclick = (e) => {
      e.preventDefault();
      currentDeleteCard = card;
      document.getElementById("deleteUsername").innerText =
        card.querySelector(".user-title").innerText;
      deleteModal.style.display = "block";
    };
  }

  // Attach events for existing cards
  document.querySelectorAll(".user-card").forEach(attachCardEvents);

  // Edit form submit
  document.getElementById("editUserForm").addEventListener("submit", (e) => {
    e.preventDefault();
    currentEditCard.querySelector(".user-title").innerText =
      document.getElementById("editUsername").value;
    currentEditCard.querySelector(".user-detail:nth-child(2)").innerText =
      "Email: " + document.getElementById("editEmail").value;
    currentEditCard.querySelector(".user-detail:nth-child(3)").innerText =
      "Level: " + document.getElementById("editLevel").value;
    currentEditCard.querySelector(".user-detail:nth-child(4)").innerText =
      "Role: " + document.getElementById("editRole").value;

    // Update extra fields
    if (editExtraFields.style.display === "block") {
      const dept = document.getElementById("editDepartment").value;
      const subDept = document.getElementById("editSubdepartment").value;

      if (currentEditCard.querySelector(".user-detail:nth-child(5)")) {
        currentEditCard.querySelector(".user-detail:nth-child(5)").innerText =
          "Department: " + dept;
        currentEditCard.querySelector(".user-detail:nth-child(6)").innerText =
          "Sub Department: " + subDept;
      } else {
        const deptDiv = document.createElement("div");
        deptDiv.className = "user-detail";
        deptDiv.innerText = "Department: " + dept;
        const subDeptDiv = document.createElement("div");
        subDeptDiv.className = "user-detail";
        subDeptDiv.innerText = "Sub Department: " + subDept;
        currentEditCard
          .querySelector(".user-actions")
          .insertAdjacentElement("beforebegin", deptDiv);
        currentEditCard
          .querySelector(".user-actions")
          .insertAdjacentElement("beforebegin", subDeptDiv);
      }
    } else {
      // remove extra fields if role changed to Super Admin
      if (currentEditCard.querySelector(".user-detail:nth-child(5)")) {
        currentEditCard.querySelector(".user-detail:nth-child(5)").remove();
        currentEditCard.querySelector(".user-detail:nth-child(5)").remove();
      }
    }

    editModal.style.display = "none";
  });

  // Delete confirm
  document.getElementById("confirmDelete").onclick = () => {
    currentDeleteCard.remove();
    deleteModal.style.display = "none";
  };
  document.getElementById("cancelDelete").onclick = () =>
    (deleteModal.style.display = "none");
}

// Initialize on DOM load
document.addEventListener("DOMContentLoaded", initManageUsers);

// Re-initialize when navigating via router
window.addEventListener("hashchange", () => {
  setTimeout(initManageUsers, 600); // Wait for router to load content
});
