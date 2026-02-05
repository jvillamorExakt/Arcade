// manage.js

// Create Audio object for typing sound
const typingSound = new Audio('../../sounds/typing1.wav');
typingSound.volume = 0.5;
typingSound.preload = 'auto';

// Play sound function
function playSound(type) {
    if (type === 'type') {
        typingSound.currentTime = 0;
        typingSound.play().catch(() => {});
    }
}

function initManageQuest() {
    console.log("Initializing Manage Quest!");
    
    const questModal = document.getElementById("questModal");
    
    // Exit if not on manage quest page
    if (!questModal) {
        console.log("Quest modal not found - not on manage quest page");
        return;
    }
    
    const questModalTitle = document.getElementById("questModalTitle");
    const openAddQuestBtn = document.getElementById("openAddQuestBtn");
    const closeBtns = document.querySelectorAll(".close");
    const questForm = document.getElementById("questForm");
    const questCards = document.getElementById("questCards");
    const deleteModal = document.getElementById("deleteModal");
    const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");
    const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");

    // Quest Type Elements
    const questTypeSelect = document.getElementById("questType");
    const specificUsersWrapper = document.getElementById("specificUsersWrapper");
    const groupLimitWrapper = document.getElementById("groupLimitWrapper");

    let currentEditCard = null;
    let currentDeleteCard = null;

    // Add typing sound to all inputs
    let lastTypeTime = 0;
    const inputs = questForm.querySelectorAll('input, textarea');
    inputs.forEach(input => {
        input.addEventListener('input', () => {
            const now = Date.now();
            if (now - lastTypeTime > 80) {
                playSound('type');
                lastTypeTime = now;
            }
        });
    });

    // Handle Quest Type Change
    questTypeSelect.addEventListener('change', (e) => {
        const selectedType = e.target.value;
        
        // Hide all conditional fields first
        specificUsersWrapper.style.display = 'none';
        groupLimitWrapper.style.display = 'none';
        
        // Show appropriate fields based on selection
        if (selectedType === 'specific') {
            specificUsersWrapper.style.display = 'block';
            document.getElementById('specificUsers').setAttribute('required', 'required');
            document.getElementById('groupLimit').removeAttribute('required');
        } else if (selectedType === 'group') {
            groupLimitWrapper.style.display = 'block';
            document.getElementById('groupLimit').setAttribute('required', 'required');
            document.getElementById('specificUsers').removeAttribute('required');
        } else {
            // 'open' type - no additional fields needed
            document.getElementById('specificUsers').removeAttribute('required');
            document.getElementById('groupLimit').removeAttribute('required');
        }
    });

    // Open Add Quest modal
    openAddQuestBtn.onclick = () => {
        questModalTitle.innerText = "➕ Add Quest";
        questForm.reset();
        currentEditCard = null;
        
        // Reset conditional fields
        specificUsersWrapper.style.display = 'none';
        groupLimitWrapper.style.display = 'none';
        
        questModal.style.display = "block";
    };

    // Close modals
    closeBtns.forEach(
        (btn) =>
            (btn.onclick = () => {
                questModal.style.display = "none";
                deleteModal.style.display = "none";
            }),
    );
    
    window.onclick = (e) => {
        if (e.target === questModal) questModal.style.display = "none";
        if (e.target === deleteModal) deleteModal.style.display = "none";
    };

    // Add/Edit quest
    questForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const title = questForm.title.value;
        const desc = questForm.desc.value;
        const exp = questForm.exp.value;
        const gold = questForm.gold.value;
        const questType = questForm.questType.value;
        
        // Get conditional values
        let questTypeLabel = questType.charAt(0).toUpperCase() + questType.slice(1);
        let additionalInfo = '';
        
        if (questType === 'specific') {
            const specificUsers = document.getElementById('specificUsers');
            const selectedUserText = specificUsers.options[specificUsers.selectedIndex].text;
            additionalInfo = ` | Assigned to: ${selectedUserText}`;
        } else if (questType === 'group') {
            const groupLimit = questForm.groupLimit.value;
            additionalInfo = ` | Max Members: ${groupLimit}`;
        }

        if (currentEditCard) {
            currentEditCard.querySelector(".quest-title").innerText = title;
            currentEditCard.querySelector(".quest-desc").innerText = desc;
            currentEditCard.querySelectorAll(".stat-value")[0].innerText = `+${exp} 🌟`;
            currentEditCard.querySelectorAll(".stat-value")[1].innerText = `+${gold} 🪙`;
            
            // Update quest type badge if it exists
            const typeBadge = currentEditCard.querySelector(".quest-type-badge");
            if (typeBadge) {
                typeBadge.innerHTML = `${questTypeLabel}${additionalInfo}`;
            }
        } else {
            const newCard = document.createElement("div");
            newCard.className = "quest-card";
            newCard.innerHTML = `
                <div class="quest-info">
                    <div class="quest-title">${title}</div>
                    <div class="quest-desc">${desc}</div>
                    <div class="quest-type-badge" style="font-size: 0.5rem; color: #ff8c00; margin-top: 8px;">
                        ${questTypeLabel}${additionalInfo}
                    </div>
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
                </div>
            `;
            questCards.appendChild(newCard);
            attachCardEvents(newCard);
        }

        questForm.reset();
        specificUsersWrapper.style.display = 'none';
        groupLimitWrapper.style.display = 'none';
        questModal.style.display = "none";
    });

    // Attach Edit/Delete events to a quest card
    function attachCardEvents(card) {
        const editBtn = card.querySelector(".editQuestBtn");
        const deleteBtn = card.querySelector(".deleteQuestBtn");

        editBtn.onclick = (e) => {
            e.preventDefault();
            currentEditCard = card;
            questModalTitle.innerText = "✏️ Edit Quest";
            questForm.title.value = card.querySelector(".quest-title").innerText;
            questForm.desc.value = card.querySelector(".quest-desc").innerText;
            questForm.exp.value = card
                .querySelectorAll(".stat-value")[0]
                .innerText.replace("🌟", "")
                .replace("+", "")
                .trim();
            questForm.gold.value = card
                .querySelectorAll(".stat-value")[1]
                .innerText.replace("🪙", "")
                .replace("+", "")
                .trim();
            questModal.style.display = "block";
        };

        deleteBtn.onclick = (e) => {
            e.preventDefault();
            currentDeleteCard = card;
            deleteModal.style.display = "block";
        };
    }

    // Initialize existing cards
    document.querySelectorAll(".quest-card").forEach(attachCardEvents);

    // Delete modal buttons
    confirmDeleteBtn.onclick = () => {
        if (currentDeleteCard) currentDeleteCard.remove();
        deleteModal.style.display = "none";
    };
    
    cancelDeleteBtn.onclick = () => {
        deleteModal.style.display = "none";
        currentDeleteCard = null;
    };
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', initManageQuest);

// Re-initialize when navigating via router
window.addEventListener('hashchange', () => {
    setTimeout(initManageQuest, 600); // Wait for router to load content
});