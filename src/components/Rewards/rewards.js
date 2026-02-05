function initManageRewards() {
  console.log("initManageRewards called!");

  const user = {
    avatar: "avatar.png",
    currentLevel: 5,
    currentEXP: 750,
    nextLevelEXP: 1000,
    currentPoints: 2000, // Test with 0 or higher
  };

  const userLevelElem = document.getElementById("user-level");
  const userExpElem = document.getElementById("user-exp-sub");
  const userPointsElem = document.getElementById("user-points");
  const userAvatar = document.querySelector(".user-icon img");

  if (!userLevelElem || !userExpElem || !userPointsElem || !userAvatar) {
    console.log("Rewards elements not found - not on rewards page");
    return;
  }

  userLevelElem.textContent = user.currentLevel;
  userExpElem.textContent = `${user.currentEXP} / ${user.nextLevelEXP} EXP`;
  userPointsElem.textContent = user.currentPoints;
  userAvatar.src = user.avatar;

  const rewardCards = document.querySelectorAll(".reward-card");

  function updateRewards() {
    rewardCards.forEach((card) => {
      const requiredPoints = Number(card.dataset.points);
      const btn = card.querySelector(".redeem-btn");

      if (!btn) return;

      // Enable/disable button based on points
      if (user.currentPoints >= requiredPoints) {
        btn.disabled = false;
        btn.textContent = "Redeem";
      } else {
        btn.disabled = true;
        btn.textContent = "Not enough points";
      }

      // Click handler
      btn.onclick = () => {
        if (user.currentPoints >= requiredPoints) {
          alert(
            `You redeemed ${requiredPoints} points for "${card.querySelector(".reward-title").textContent}"!`,
          );
          user.currentPoints -= requiredPoints;
          userPointsElem.textContent = user.currentPoints;
          updateRewards(); // Refresh buttons immediately
        }
      };
    });
  }

  updateRewards();
}

// Initialize on DOM load
document.addEventListener("DOMContentLoaded", initManageRewards);

// Re-initialize when navigating via router
window.addEventListener("hashchange", () => {
  setTimeout(initManageRewards, 600); // Wait for router to load rewards content
});
