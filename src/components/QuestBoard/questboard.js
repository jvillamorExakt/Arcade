function initManageTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', function() {
      const targetTab = this.getAttribute('data-tab');
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      this.classList.add('active');
      document.getElementById(targetTab).classList.add('active');
    });
  });
}
// Initialize on DOM load
document.addEventListener("DOMContentLoaded", initManageTabs);

// Re-initialize when navigating via router
window.addEventListener("hashchange", () => {
  setTimeout(initManageTabs, 600); // Wait for router to load content
});