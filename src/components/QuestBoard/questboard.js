// Create Audio object for jump sound
const jumpSound = new Audio('../../sounds/jump1.wav'); // adjust path if needed
jumpSound.volume = 0.5; // optional: reduce volume
jumpSound.preload = 'auto'; // preload for smoother playback

// Play sound function
function playSound(type) {
    if (type === 'jump') {
        jumpSound.currentTime = 0; // reset each time
        jumpSound.play().catch(() => {}); // prevent errors if blocked
    }
}

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

  // Add event listeners for DONE buttons
  const doneButtons = document.querySelectorAll('.quest-btn-success');
  
  doneButtons.forEach(btn => {
    btn.addEventListener('click', function() {
      // Play sound effect
      playSound('jump');
      
      // Replace the button with "FOR APPROVAL" text
      this.outerHTML = '<span class="approval-text">FOR APPROVAL</span>';
    });
  });
}

// Initialize on DOM load
document.addEventListener("DOMContentLoaded", initManageTabs);

// Re-initialize when navigating via router
window.addEventListener("hashchange", () => {
  setTimeout(initManageTabs, 600); // Wait for router to load content
});