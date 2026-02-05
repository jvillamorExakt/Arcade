(() => {
  const API_BASE = window.API_BASE || "http://localhost:3001";

  function setMessage(messageEl, text, type = "info") {
    if (!messageEl) return;
    messageEl.textContent = text;
    messageEl.dataset.type = type;
  }

  function createStarfield() {
    const stars = document.getElementById("stars");
    if (!stars) return;
    for (let i = 0; i < 150; i++) {
      const star = document.createElement("div");
      star.className = "star";
      star.style.width = `${Math.random() * 3 + 1}px`;
      star.style.height = star.style.width;
      star.style.left = `${Math.random() * 100}%`;
      star.style.top = `${Math.random() * 100}%`;
      star.style.animationDelay = `${Math.random() * 3}s`;
      stars.appendChild(star);
    }
  }

  function createParticles() {
    const container = document.getElementById("particles");
    if (!container) return;
    for (let i = 0; i < 30; i++) {
      const particle = document.createElement("div");
      particle.className = "particle";
      particle.style.left = `${Math.random() * 100}%`;
      particle.style.animationDelay = `${Math.random() * 15}s`;
      particle.style.animationDuration = `${Math.random() * 10 + 10}s`;

      const colors = ["var(--neon-cyan)", "var(--neon-pink)", "var(--neon-purple)"];
      const color = colors[Math.floor(Math.random() * colors.length)];
      particle.style.background = color;
      particle.style.boxShadow = `0 0 10px ${color}`;

      container.appendChild(particle);
    }
  }

  function animateStats() {
    const stats = [
      { id: "onlineCount", target: 1247, suffix: "" },
      { id: "questCount", target: 342, suffix: "" },
      { id: "rewardCount", target: 89, suffix: "K" },
    ];

    stats.forEach((stat) => {
      let current = 0;
      const element = document.getElementById(stat.id);
      if (!element) return;
      const interval = setInterval(() => {
        current += Math.ceil(stat.target / 50);
        if (current >= stat.target) {
          current = stat.target;
          clearInterval(interval);
        }
        element.textContent = current.toLocaleString() + stat.suffix;
      }, 30);
    });
  }

  async function login(identifier, password) {
    const response = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, password }),
    });

    const rawText = await response.text();
    let data = {};
    try {
      data = rawText ? JSON.parse(rawText) : {};
    } catch (error) {
      data = { error: rawText || "Login failed" };
    }

    if (!response.ok) {
      const messageText =
        data.error || data.errors || rawText || `Login failed (${response.status})`;
      throw new Error(messageText);
    }

    return data;
  }

  function initLogin() {
    createStarfield();
    createParticles();
    animateStats();

    const form = document.getElementById("loginForm");
    const operatorInput = document.getElementById("operatorId");
    const accessInput = document.getElementById("accessCode");
    const messageEl = document.getElementById("loginMessage");
    const loadingBar = document.getElementById("loadingBar");
    const overlay = document.getElementById("transitionOverlay");

    const loadingSound = new Audio("../../sounds/loading1.wav");
    loadingSound.volume = 0.7;
    loadingSound.preload = "auto";

    const typingSound = new Audio("../../sounds/typing1.wav");
    typingSound.volume = 0.5;
    typingSound.preload = "auto";

    function playSound(type) {
      if (type === "type") {
        typingSound.currentTime = 0;
        typingSound.play().catch(() => {});
      }
    }

    document.querySelectorAll(".cyber-input").forEach((input) => {
      input.addEventListener("input", () => playSound("type"));
    });

    document.addEventListener("keydown", (event) => {
      if ((event.key === "s" || event.key === "S") && document.activeElement.tagName !== "INPUT") {
        const firstInput = document.querySelector(".cyber-input");
        if (firstInput) {
          firstInput.focus();
        }
      }
    });

    window.showRegister = () => {
      alert(
        "🎮 NEW OPERATOR REGISTRATION\n\nInitialize your cyber profile and join the quest network!\n\n(Registration interface loading...)"
      );
    };

    if (!form || !operatorInput || !accessInput) {
      setMessage(messageEl, "Login form not initialized. Check page markup.", "error");
      return;
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      setMessage(messageEl, "");

      const identifier = operatorInput.value.trim();
      const password = accessInput.value.trim();

      if (!identifier || !password) {
        setMessage(messageEl, "Please enter your username/email and password.", "error");
        return;
      }

      const btn = form.querySelector(".neon-btn");
      if (btn) {
        btn.textContent = "▸ CONNECTING...";
        btn.disabled = true;
      }
      if (loadingBar) {
        loadingBar.classList.add("active");
      }
      loadingSound.currentTime = 0;
      loadingSound.play().catch(() => {});

      form.querySelectorAll("input").forEach((input) => {
        input.disabled = true;
      });

      try {
        const data = await login(identifier, password);
        localStorage.setItem("userId", data.userId);
        localStorage.setItem("authToken", data.idToken);
        if (data.name) {
          localStorage.setItem("userName", data.name);
        }

        setMessage(messageEl, `Access granted. Welcome, ${data.name || data.userId}.`, "success");

        if (btn) {
          btn.textContent = "✓ ACCESS GRANTED";
          btn.style.background = "linear-gradient(135deg, #00ff00, #00aa00)";
        }

        loadingSound.pause();
        loadingSound.currentTime = 0;

        setTimeout(() => {
          if (overlay) {
            overlay.classList.add("active");
          }
          setTimeout(() => {
            window.location.href = "../maindashboard/MainDashboard.html";
          }, 600);
        }, 1000);
      } catch (error) {
        setMessage(messageEl, error.message, "error");
        if (btn) {
          btn.textContent = "▸ JACK IN ◂";
          btn.disabled = false;
          btn.style.background = "";
        }
        if (loadingBar) {
          loadingBar.classList.remove("active");
        }
        form.querySelectorAll("input").forEach((input) => {
          input.disabled = false;
        });
        loadingSound.pause();
        loadingSound.currentTime = 0;
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initLogin);
  } else {
    initLogin();
  }
})();