// questboard.js

function initQuestBoard() {
    console.log("Initializing Quest Board!");

    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    // Check if elements exist
    if (!tabBtns.length || !tabContents.length) {
        console.log("Quest board elements not found");
        return;
    }

    // Tab switching logic
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');

            // Remove active class from all buttons and contents
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            // Add active class to clicked button and corresponding content
            btn.classList.add('active');
            document.getElementById(targetTab).classList.add('active');
        });
    });
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', initQuestBoard);

// Re-initialize when navigating via router
window.addEventListener('hashchange', () => {
    setTimeout(initQuestBoard, 600);
});