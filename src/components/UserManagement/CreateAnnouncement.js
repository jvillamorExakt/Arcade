function initManageAnnouncement() {
  const titleInput = document.getElementById("title");
  const typeSelect = document.getElementById("type");
  const messageInput = document.getElementById("message");
  const tagsInput = document.getElementById("tags");

  const previewCard = document.getElementById("previewCard");
  const previewTitle = previewCard.querySelector("h3");
  const previewMessage = previewCard.querySelector("p");
  const previewBadge = previewCard.querySelector(".create-announcement-badge");
  const previewTags = previewCard.querySelector(".create-announcement-tags");

  function updatePreview() {
    previewTitle.textContent = titleInput.value || "Announcement Title";
    previewMessage.textContent =
      messageInput.value || "Your message will appear here.";

    // Reset classes
    previewCard.className = "create-announcement-card";

    // Add type class
    if (typeSelect.value) {
      previewCard.classList.add("create-announcement-" + typeSelect.value);
      previewBadge.textContent = typeSelect.value.toUpperCase();
    } else {
      previewBadge.textContent = "TYPE";
    }

    // Update tags
    previewTags.innerHTML = "";
    if (tagsInput.value.trim()) {
      tagsInput.value.split(",").forEach((tag) => {
        const span = document.createElement("span");
        span.textContent = tag.trim();
        previewTags.appendChild(span);
      });
    }
  }

  [titleInput, typeSelect, messageInput, tagsInput].forEach((el) =>
    el.addEventListener("input", updatePreview),
  );

  document
    .getElementById("announcementForm")
    .addEventListener("submit", (e) => {
      e.preventDefault();
      alert("Announcement published! (Hook this to backend)");
    });

  updatePreview(); // initialize preview on load
}
document.addEventListener("DOMContentLoaded", initManageAnnouncement);

window.addEventListener("hashchange", () => {
  setTimeout(initManageAnnouncement, 600);
});
