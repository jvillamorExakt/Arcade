// router.js - Simple Hash Router
// Click sound for navigation
const clickSound = new Audio('../../sounds/click1.wav'); // adjust path if needed
clickSound.volume = 0.7;   // subtle volume
clickSound.preload = 'auto';
console.log('Router loaded!'); // Debug line

const routes = {
    'home': null,
    'quests': '../QuestBoard/QuestPage.html',
    'campaigns': '../campaigns/Campaigns.html',
    'referrals': '../referrals/Referrals.html',
    'rewards': '../rewards/Rewards.html'
};

let homeContent = '';

function updateActiveNav(page) {
    console.log('Updating active nav for:', page); // Debug
    document.querySelectorAll('.nav a').forEach(link => {
        link.classList.remove('active');
        const linkPage = link.getAttribute('href').replace('#', '');
        if (linkPage === page) {
            link.classList.add('active');
        }
    });
}

async function loadPage(page) {
    console.log('Loading page:', page); // Debug
    
    const mainContent = document.getElementById('main-content');
    
    if (!mainContent) {
        console.error('main-content element not found!');
        return;
    }

    // Store home content
    if (!homeContent) {
        homeContent = mainContent.innerHTML;
        console.log('Home content stored');
    }

    // Load home
    if (page === 'home' || !page) {
        mainContent.style.opacity = '0';
        setTimeout(() => {
            mainContent.innerHTML = homeContent;
            updateActiveNav('home');
            mainContent.style.opacity = '1';
        }, 300);
        return;
    }

    const route = routes[page];
    
    if (!route) {
        console.error('Route not found:', page);
        return;
    }

    // Fade out
    mainContent.style.opacity = '0';

    setTimeout(async () => {
        try {
            console.log('Fetching:', route);
            const response = await fetch(route);
            
            if (!response.ok) {
                throw new Error(`Failed to load: ${response.status}`);
            }
            
            const html = await response.text();
            console.log('Content loaded successfully');
            
            // Parse HTML
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const content = doc.querySelector('main') || doc.querySelector('.main') || doc.body;
            
            mainContent.innerHTML = content.innerHTML;
            updateActiveNav(page);

            // Fade in
            setTimeout(() => {
                mainContent.style.opacity = '1';
            }, 50);
            
        } catch (error) {
            console.error('Error loading page:', error);
            mainContent.innerHTML = `
                <main class="main">
                    <h1 style="color: #ff0000;">⚠️ ERROR</h1>
                    <p>Could not load: ${route}</p>
                    <p>Error: ${error.message}</p>
                    <a href="#home" style="color: #00ffff;">← Return to Home</a>
                </main>
            `;
            mainContent.style.opacity = '1';
        }
    }, 300);
}

// Hash change event
window.addEventListener('hashchange', function() {
    clickSound.currentTime = 0;
    clickSound.play().catch(() => {});
    
    console.log('Hash changed to:', window.location.hash);
    const page = window.location.hash.replace('#', '') || 'home';
    loadPage(page);
});

// Initial load
window.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing router');
    
    const mainContent = document.getElementById('main-content');
    if (mainContent) {
        homeContent = mainContent.innerHTML;
        const page = window.location.hash.replace('#', '') || 'home';
        console.log('Initial page:', page);
        
        if (page !== 'home') {
            loadPage(page);
        } else {
            updateActiveNav('home');
        }
    } else {
        console.error('CRITICAL: #main-content not found in DOM!');
    }
});
// Play click sound whenever a nav link is clicked
document.querySelectorAll('.nav a').forEach(link => {
    link.addEventListener('click', () => {
        clickSound.currentTime = 0; // reset so it plays every click
        clickSound.play().catch(() => {}); // ignore if blocked by browser
    });
});