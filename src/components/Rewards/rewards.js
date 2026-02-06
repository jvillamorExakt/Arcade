function initManageRewards() {
  console.log("initManageRewards called!");

  const GOLD_TO_POINT_RATE = 0.01; // 1 Gold = 0.01 Point

  const user = {
    avatar: "avatar.png",
    currentLevel: 5,
    currentEXP: 750,
    nextLevelEXP: 1000,

    currentGold: 100000, // 👈 MAIN CURRENCY
    get currentPoints() {
      return Math.floor(this.currentGold * GOLD_TO_POINT_RATE);
    },
  };

  const userLevelElem = document.getElementById("user-level");
  const userExpElem = document.getElementById("user-exp-sub");
  const userGoldElem = document.getElementById("user-gold");
  const userPointsElem = document.getElementById("user-points");
  const userAvatar = document.querySelector(".user-icon img");

  if (
    !userLevelElem ||
    !userExpElem ||
    !userGoldElem ||
    !userPointsElem ||
    !userAvatar
  ) {
    console.log("Rewards elements not found - not on rewards page");
    return;
  }

  /* ===== INITIAL UI SET ===== */
  userLevelElem.textContent = user.currentLevel;
  userExpElem.textContent = `${user.currentEXP} / ${user.nextLevelEXP} EXP`;
  userGoldElem.textContent = user.currentGold;
  userPointsElem.textContent = user.currentPoints;
  userAvatar.src = user.avatar;

  const rewardCards = document.querySelectorAll(".reward-card");

  function updateRewards() {
    // Always recalc points from gold
    userGoldElem.textContent = user.currentGold;
    userPointsElem.textContent = user.currentPoints;

    rewardCards.forEach((card) => {
      const requiredPoints = Number(card.dataset.points);
      const btn = card.querySelector(".redeem-btn");

      if (!btn) return;

      if (user.currentPoints >= requiredPoints) {
        btn.disabled = false;
        btn.textContent = "Redeem";
      } else {
        btn.disabled = true;
        btn.textContent = "Not enough points";
      }

      btn.onclick = () => {
        if (user.currentPoints >= requiredPoints) {
          const goldCost = requiredPoints / GOLD_TO_POINT_RATE;

          alert(
            `You redeemed "${card.querySelector(".reward-title").textContent}"\n\nCost: ${goldCost} Gold (${requiredPoints} Points)`,
          );

          user.currentGold -= goldCost;
          updateRewards(); // Refresh UI instantly
        }
      };
    });
  }

  updateRewards();
}

/* ===== INIT ===== */
document.addEventListener("DOMContentLoaded", initManageRewards);

window.addEventListener("hashchange", () => {
  setTimeout(initManageRewards, 600);
});
