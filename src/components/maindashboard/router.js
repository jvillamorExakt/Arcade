// router.js - Simple Hash Router
// Click sound for navigation
const clickSound = new Audio("../../sounds/click1.wav"); // adjust path if needed
clickSound.volume = 0.7; // subtle volume
clickSound.preload = "auto";
console.log("Router loaded!"); // Debug line

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

const ROUTE_BASE_URL = (() => {
  if (document.currentScript?.src) {
    return new URL(".", document.currentScript.src);
  }
  return new URL(".", window.location.href);
})();

function resolveRouteUrl(route) {
  return new URL(route, ROUTE_BASE_URL).toString();
}

const API_BASE = window.API_BASE || "http://localhost:3001";
const ROLE_ACCESS = {
  member: new Set(["home", "quests", "campaigns", "referrals", "rewards"]),
  questmaker: new Set(["questmanagement", "queststats"]),
  superadmin: new Set(["usermanagement"]),
};

function normalizeRole(role) {
  if (!role) return null;
  const normalized = String(role).trim().toLowerCase().replace(/[_-]+/g, " ");
  if (normalized === "quester" || normalized === "member") return "member";
  if (normalized === "questmaster" || normalized === "quest maker") return "questmaker";
  if (normalized === "superadmin" || normalized === "super admin") return "superadmin";
  return normalized;
}

function getUserRoles() {
  const fromStorage = localStorage.getItem("userRoles");
  if (fromStorage) {
    try {
      const parsed = JSON.parse(fromStorage);
      if (Array.isArray(parsed)) {
        return parsed.map(normalizeRole).filter(Boolean);
      }
      if (typeof parsed === "string") {
        return parsed
          .split(",")
          .map((role) => normalizeRole(role))
          .filter(Boolean);
      }
    } catch (error) {
      // ignore parse issues
    }
  }

  const profileRaw = localStorage.getItem("userProfile");
  if (!profileRaw) return [];
  try {
    const profile = JSON.parse(profileRaw);
    let roles = [];
    if (Array.isArray(profile.roles)) {
      roles = profile.roles;
    } else if (typeof profile.roles === "string") {
      roles = profile.roles.split(",").map((role) => role.trim());
    } else if (typeof profile.role === "string") {
      roles = profile.role.split(",").map((role) => role.trim());
    }
    return roles.map(normalizeRole).filter(Boolean);
  } catch (error) {
    return [];
  }
}

async function hydrateRolesFromProfile() {
  const roles = getUserRoles();
  if (roles.length) {
    return roles;
  }
  const token = localStorage.getItem("authToken");
  const userId = localStorage.getItem("userId");
  if (!token || !userId) {
    return [];
  }
  try {
    const response = await fetch(`${API_BASE}/api/users/${userId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      return [];
    }
    const profile = await response.json();
    localStorage.setItem("userProfile", JSON.stringify(profile));
    const roleList = Array.isArray(profile.roles)
      ? profile.roles
      : profile.role
        ? [profile.role]
        : [];
    localStorage.setItem("userRoles", JSON.stringify(roleList));
    return roleList.map(normalizeRole).filter(Boolean);
  } catch (error) {
    return [];
  }
}

function canAccessPage(page, roles) {
  if (page === "home" || !page) {
    return roles.some((role) => ROLE_ACCESS.member.has("home"));
  }
  return roles.some((role) => ROLE_ACCESS[role]?.has(page));
}

async function applyRoleVisibility() {
  let roles = await hydrateRolesFromProfile();
  if (!roles.length && localStorage.getItem("authToken")) {
    roles = ["member"];
  }
  const links = document.querySelectorAll(".nav a");
  links.forEach((link) => {
    const target = link.getAttribute("href").replace("#", "");
    if (!target || target === "home") {
      link.style.display = roles.length ? "" : "none";
      return;
    }
    const allowed = canAccessPage(target, roles);
    link.style.display = allowed ? "" : "none";
  });

  document.querySelectorAll(".nav-section").forEach((section) => {
    const linkTargets = Array.from(section.querySelectorAll("a"))
      .map((link) => link.getAttribute("href"))
      .filter(Boolean)
      .map((href) => href.replace("#", ""));
    if (!linkTargets.length) {
      return;
    }
    const allowed = linkTargets.some((target) => canAccessPage(target, roles));
    section.style.display = allowed ? "" : "none";
  });
}

let homeContent = "";

function updateActiveNav(page) {
  console.log("Updating active nav for:", page); // Debug
  document.querySelectorAll(".nav a").forEach((link) => {
    link.classList.remove("active");
    const linkPage = link.getAttribute("href").replace("#", "");
    if (linkPage === page) {
      link.classList.add("active");
    }
  });
}

async function loadPage(page) {
  console.log("Loading page:", page); // Debug

  const mainContent = document.getElementById("main-content");

  if (!mainContent) {
    console.error("main-content element not found!");
    return;
  }

  // Store home content
  if (!homeContent) {
    homeContent = mainContent.innerHTML;
    console.log("Home content stored");
  }

  // Load home
  if (page === "home" || !page) {
    mainContent.style.opacity = "0";
    setTimeout(() => {
      mainContent.innerHTML = homeContent;
      updateActiveNav("home");
      if (typeof window.loadDashboardData === "function") {
        window.loadDashboardData();
      }
      mainContent.style.opacity = "1";
    }, 300);
    return;
  }

  const route = routes[page];

  if (!route) {
    console.error("Route not found:", page);
    return;
  }

  const roles = getUserRoles();
  if (!canAccessPage(page, roles)) {
    mainContent.innerHTML = `
      <main class="main">
        <h1 style="color: #ff0000;">⚠️ ACCESS DENIED</h1>
        <p>You do not have permission to view this section.</p>
      </main>
    `;
    mainContent.style.opacity = "1";
    return;
  }

  // Fade out
  mainContent.style.opacity = "0";

  setTimeout(async () => {
    try {
      const resolvedRoute = resolveRouteUrl(route);
      console.log("Fetching:", resolvedRoute);
      const response = await fetch(resolvedRoute);

      if (!response.ok) {
        throw new Error(`Failed to load: ${response.status}`);
      }

      const html = await response.text();
      console.log("Content loaded successfully");

      // Parse HTML
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      const content =
        doc.querySelector("main") || doc.querySelector(".main") || doc.body;

      mainContent.innerHTML = content.innerHTML;
      updateActiveNav(page);

      // Fade in
      setTimeout(() => {
        mainContent.style.opacity = "1";
      }, 50);
    } catch (error) {
      console.error("Error loading page:", error);
      mainContent.innerHTML = `
                <main class="main">
                    <h1 style="color: #ff0000;">⚠️ ERROR</h1>
                    <p>Could not load: ${resolvedRoute}</p>
                    <p>Error: ${error.message}</p>
                    <a href="#home" style="color: #00ffff;">← Return to Home</a>
                </main>
            `;
      mainContent.style.opacity = "1";
    }
  }, 300);
}

// Hash change event
window.addEventListener("hashchange", function () {
  clickSound.currentTime = 0;
  clickSound.play().catch(() => {});

  console.log("Hash changed to:", window.location.hash);
  const page = window.location.hash.replace("#", "") || "home";
  loadPage(page);
});

// Initial load
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
    applyRoleVisibility();
  } else {
    console.error("CRITICAL: #main-content not found in DOM!");
  }
});
// Play click sound whenever a nav link is clicked
document.querySelectorAll(".nav a").forEach((link) => {
  link.addEventListener("click", () => {
    clickSound.currentTime = 0; // reset so it plays every click
    clickSound.play().catch(() => {}); // ignore if blocked by browser
  });
});

window.addEventListener("storage", () => {
  applyRoleVisibility();
});

const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("authToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("userId");
    localStorage.removeItem("userName");
    localStorage.removeItem("userProfile");
    localStorage.removeItem("userRoles");
    window.location.href = "../loginpage/loginpage.html";
  });
}
