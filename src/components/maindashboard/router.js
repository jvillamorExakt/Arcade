// router.js - Simple Hash Router
// Click sound for navigation
const clickSound = new Audio("../../sounds/click1.wav");
clickSound.volume = 0.7;
clickSound.preload = "auto";

// Level up sound
const levelUpSound = new Audio("../../sounds/levelup.wav");
levelUpSound.volume = 0.8;
levelUpSound.preload = "auto";

// Success sound
const successSound = new Audio("../../sounds/success.wav");
successSound.volume = 0.8;
successSound.preload = "auto";
// Make levelUpSound globally accessible
window.levelUpSound = levelUpSound;
window.successSound = successSound;

console.log("Router loaded!");

const routes = {
  home: null,
  quests: "../QuestBoard/QuestPage.html",
  campaigns: "../campaigns/Campaigns.html",
  referrals: "../referrals/Referrals.html",
  rewards: "../Rewards/RewardsPage.html",
  questmanagement: "../QuestManagement/ManageQuest.html",
  queststats: "../QuestManagement/QuestStats.html",
  usermanagement: "../UserManagement/CreateUser.html",
};

let homeContent = "";
let isLevelingUp = false;
let hasCheckedInitialXP = false;

// Function to show reward popup with selection
function showRewardPopup() {
  // Create popup container
  const popup = document.createElement('div');
  popup.className = 'reward-popup';
  popup.innerHTML = `
    <div class="reward-popup-overlay"></div>
    <div class="reward-popup-content">
      <div class="gift-box">🎁</div>
      <div class="reward-title">LEVEL UP!</div>
      <div class="reward-subtitle">Choose Your Reward</div>
      <div class="reward-items">
        <div class="reward-item selectable" data-reward="gems">
          <div class="reward-icon">💎</div>
          <div class="reward-text">+50 Gems</div>
          <div class="reward-select-btn">SELECT</div>
        </div>
        <div class="reward-item selectable" data-reward="gold">
          <div class="reward-icon">🪙</div>
          <div class="reward-text">+100 Gold</div>
          <div class="reward-select-btn">SELECT</div>
        </div>
      </div>
      <div class="reward-instruction">Click on a reward to claim it</div>
    </div>
  `;
  
  document.body.appendChild(popup);
  
  // Trigger animation
  setTimeout(() => {
    popup.classList.add('show');
  }, 10);
  
  // Handle reward selection
  const rewardItems = popup.querySelectorAll('.reward-item.selectable');
  rewardItems.forEach(item => {
    item.addEventListener('click', function() {
      const rewardType = this.getAttribute('data-reward');
      
      // Add selected animation
      this.classList.add('selected');
      // Play success sound
      successSound.currentTime = 0;
      successSound.play().catch(() => {});
      // Disable other rewards
      rewardItems.forEach(otherItem => {
        if (otherItem !== this) {
          otherItem.classList.add('disabled');
        }
      });
      
      // Show claimed message
      const subtitle = popup.querySelector('.reward-subtitle');
      const instruction = popup.querySelector('.reward-instruction');
      subtitle.textContent = 'Reward Claimed!';
      instruction.textContent = `You received ${rewardType === 'gems' ? '+50 Gems' : '+100 Gold'}!`;
      
      console.log(`Player claimed: ${rewardType}`);
      
      // Close popup after selection animation
      setTimeout(() => {
        popup.classList.remove('show');
        setTimeout(() => {
          popup.remove();
        }, 300);
      }, 1500);
    });
  });
  
  // Remove auto-close functionality - only closes when reward is selected
}

// Function to update level display
function updateLevel(newLevel) {
  const levelElement = document.querySelector('.profile-text:nth-child(2)');
  if (levelElement) {
    levelElement.textContent = `LEVEL: ${newLevel}`;
  }
}

// Function to update XP and check for level up
function updateXP(currentXP, maxXP) {
  const xpFill = document.querySelector('.xp-fill');
  const xpText = document.querySelector('.xp-text');
  
  if (!xpFill || !xpText) return;
  
  const percentage = (currentXP / maxXP) * 100;
  xpFill.style.width = percentage + '%';
  xpText.textContent = `${currentXP} / ${maxXP}`;
  
  // Play level up sound when reaching 100%
  if (percentage >= 100 && !isLevelingUp) {
    isLevelingUp = true;
    
    levelUpSound.currentTime = 0;
    levelUpSound.play().catch(() => {});
    
    // Add visual feedback
    xpFill.style.animation = 'pulse 0.5s ease-in-out';
    
    // After animation, level up
    setTimeout(() => {
      xpFill.style.animation = '';
      
      // Get current level
      const levelElement = document.querySelector('.profile-text:nth-child(2)');
      if (levelElement) {
        const currentLevel = parseInt(levelElement.textContent.match(/\d+/)[0]);
        const newLevel = currentLevel + 1;
        
        // Update level
        updateLevel(newLevel);
        
        // Reset XP to 0
        xpFill.style.width = '0%';
        xpText.textContent = '0 / 100';
        
        console.log(`Level up! New level: ${newLevel}`);
        
        // Show reward popup after level up
        setTimeout(() => {
          showRewardPopup();
        }, 200);
      }
      
      // Reset flag after level up is complete
      setTimeout(() => {
        isLevelingUp = false;
      }, 100);
    }, 500);
  }
}

// Function to check XP on page load
function checkInitialXP() {
  if (hasCheckedInitialXP || isLevelingUp) {
    console.log("XP already checked or currently leveling up, skipping");
    return;
  }
  
  const xpFill = document.querySelector('.xp-fill');
  const xpText = document.querySelector('.xp-text');
  
  if (!xpFill || !xpText) {
    console.log("XP elements not found");
    return;
  }
  
  hasCheckedInitialXP = true;
  
  const xpTextContent = xpText.textContent.trim();
  const match = xpTextContent.match(/(\d+)\s*\/\s*(\d+)/);
  
  if (match) {
    const currentXP = parseInt(match[1]);
    const maxXP = parseInt(match[2]);
    
    console.log(`XP Check: ${currentXP}/${maxXP}`);
    
    if (currentXP >= maxXP) {
      isLevelingUp = true;
      
      console.log("Playing level up sound!");
      levelUpSound.currentTime = 0;
      levelUpSound.play().catch((error) => {
        console.log("Sound play blocked:", error);
      });
      
      xpFill.style.animation = 'pulse 0.5s ease-in-out';
      
      setTimeout(() => {
        xpFill.style.animation = '';
        
        const levelElement = document.querySelector('.profile-text:nth-child(2)');
        if (levelElement) {
          const currentLevel = parseInt(levelElement.textContent.match(/\d+/)[0]);
          const newLevel = currentLevel + 1;
          
          updateLevel(newLevel);
          
          xpFill.style.width = '0%';
          xpText.textContent = '0 / 100';
          
          console.log(`Level up! New level: ${newLevel}`);
          
          // Show reward popup after level up
          setTimeout(() => {
            showRewardPopup();
          }, 200);
        }
        
        setTimeout(() => {
          isLevelingUp = false;
        }, 100);
      }, 500);
    }
  }
}

// Export functions for use in other files
window.updateXP = updateXP;
window.updateLevel = updateLevel;
window.showRewardPopup = showRewardPopup;

function updateActiveNav(page) {
  console.log("Updating active nav for:", page);
  document.querySelectorAll(".nav a").forEach((link) => {
    link.classList.remove("active");
    const linkPage = link.getAttribute("href").replace("#", "");
    if (linkPage === page) {
      link.classList.add("active");
    }
  });
}

async function loadPage(page) {
  console.log("Loading page:", page);

  const mainContent = document.getElementById("main-content");

  if (!mainContent) {
    console.error("main-content element not found!");
    return;
  }

  if (!homeContent) {
    homeContent = mainContent.innerHTML;
    console.log("Home content stored");
  }

  if (page === "home" || !page) {
    mainContent.style.opacity = "0";
    setTimeout(() => {
      mainContent.innerHTML = homeContent;
      updateActiveNav("home");
      mainContent.style.opacity = "1";
    }, 300);
    return;
  }

  const route = routes[page];

  if (!route) {
    console.error("Route not found:", page);
    return;
  }

  mainContent.style.opacity = "0";

  setTimeout(async () => {
    try {
      console.log("Fetching:", route);
      const response = await fetch(route);

      if (!response.ok) {
        throw new Error(`Failed to load: ${response.status}`);
      }

      const html = await response.text();
      console.log("Content loaded successfully");

      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      const content =
        doc.querySelector("main") || doc.querySelector(".main") || doc.body;

      mainContent.innerHTML = content.innerHTML;
      updateActiveNav(page);

      setTimeout(() => {
        mainContent.style.opacity = "1";
      }, 50);
    } catch (error) {
      console.error("Error loading page:", error);
      mainContent.innerHTML = `
                <main class="main">
                    <h1 style="color: #ff0000;">⚠️ ERROR</h1>
                    <p>Could not load: ${route}</p>
                    <p>Error: ${error.message}</p>
                    <a href="#home" style="color: #00ffff;">← Return to Home</a>
                </main>
            `;
      mainContent.style.opacity = "1";
    }
  }, 300);
}

window.addEventListener("hashchange", function () {
  clickSound.currentTime = 0;
  clickSound.play().catch(() => {});

  console.log("Hash changed to:", window.location.hash);
  const page = window.location.hash.replace("#", "") || "home";
  loadPage(page);
});

window.addEventListener("DOMContentLoaded", function () {
  console.log("DOM loaded, initializing router");

  const mainContent = document.getElementById("main-content");
  if (mainContent) {
    homeContent = mainContent.innerHTML;
    const page = window.location.hash.replace("#", "") || "home";
    console.log("Initial page:", page);

    if (page !== "home") {
      loadPage(page);
    } else {
      updateActiveNav("home");
    }
  } else {
    console.error("CRITICAL: #main-content not found in DOM!");
  }
});

document.querySelectorAll(".nav a").forEach((link) => {
  link.addEventListener("click", () => {
    clickSound.currentTime = 0;
    clickSound.play().catch(() => {});
  });
});

window.addEventListener('load', () => {
  console.log("Window loaded, checking XP");
  setTimeout(checkInitialXP, 300);
});