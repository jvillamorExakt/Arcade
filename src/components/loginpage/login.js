  // Create starfield
        function createStarfield() {
            const stars = document.getElementById('stars');
            for (let i = 0; i < 150; i++) {
                const star = document.createElement('div');
                star.className = 'star';
                star.style.width = Math.random() * 3 + 1 + 'px';
                star.style.height = star.style.width;
                star.style.left = Math.random() * 100 + '%';
                star.style.top = Math.random() * 100 + '%';
                star.style.animationDelay = Math.random() * 3 + 's';
                stars.appendChild(star);
            }
        }
        createStarfield();

        // Create floating particles
        function createParticles() {
            const container = document.getElementById('particles');
            for (let i = 0; i < 30; i++) {
                const particle = document.createElement('div');
                particle.className = 'particle';
                particle.style.left = Math.random() * 100 + '%';
                particle.style.animationDelay = Math.random() * 15 + 's';
                particle.style.animationDuration = (Math.random() * 10 + 10) + 's';
                
                // Random colors
                const colors = ['var(--neon-cyan)', 'var(--neon-pink)', 'var(--neon-purple)'];
                const color = colors[Math.floor(Math.random() * colors.length)];
                particle.style.background = color;
                particle.style.boxShadow = `0 0 10px ${color}`;
                
                container.appendChild(particle);
            }
        }
        createParticles();

        // Animate stats
        function animateStats() {
            const stats = [
                { id: 'onlineCount', target: 1247, suffix: '' },
                { id: 'questCount', target: 342, suffix: '' },
                { id: 'rewardCount', target: 89, suffix: 'K' }
            ];

            stats.forEach(stat => {
                let current = 0;
                const element = document.getElementById(stat.id);
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
        animateStats();
// Loading sound
const loadingSound = new Audio('../../sounds/loading1.wav'); // adjust path if needed
loadingSound.volume = 0.7; // optional: reduce volume
loadingSound.preload = 'auto';
        
document.getElementById('loginForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const btn = this.querySelector('.neon-btn');
    const loadingBar = document.getElementById('loadingBar');
    const overlay = document.getElementById('transitionOverlay'); // Get overlay
    
    // Start login
    btn.textContent = '▸ CONNECTING...';
    btn.disabled = true;
    loadingBar.classList.add('active');

    // Play loading sound
    loadingSound.currentTime = 0;
    loadingSound.play().catch(() => {}); // prevent errors if autoplay blocked
    
    // Disable all inputs during login
    this.querySelectorAll('input').forEach(input => input.disabled = true);
    
    // Simulate login
    setTimeout(() => {
        btn.textContent = '✓ ACCESS GRANTED';
        btn.style.background = 'linear-gradient(135deg, #00ff00, #00aa00)';

        // Stop loading sound when access is granted
        loadingSound.pause();
        loadingSound.currentTime = 0;
        
        setTimeout(() => {
            // Show transition overlay
            overlay.classList.add('active');
            
            // Wait for transition, then redirect
            setTimeout(() => {
                window.location.href = '../maindashboard/MainDashboard.html';
            }, 600); // Delay for smooth fade
        }, 1000);
    }, 2000);
});


        function showRegister() {
            alert('🎮 NEW OPERATOR REGISTRATION\n\nInitialize your cyber profile and join the quest network!\n\n(Registration interface loading...)');
        }

        // Keyboard shortcuts
        document.addEventListener('keydown', function(e) {
            // Only trigger if not already in an input field
            if ((e.key === 's' || e.key === 'S') && document.activeElement.tagName !== 'INPUT') {
                document.querySelector('.cyber-input').focus();
            }
        });
// Create Audio object for typing
const typingSound = new Audio('../../sounds/typing1.wav');
 // adjust path if needed
typingSound.volume = 0.5; // optional: reduce volume
typingSound.preload = 'auto'; // preload for smoother playback
       // Play sound function
function playSound(type) {
    if (type === 'type') {
        typingSound.currentTime = 0; // reset each time
        typingSound.play().catch(() => {}); // prevent errors if blocked
    }
}
// Hook to your inputs
let lastTypeTime = 0; // throttle
document.querySelectorAll('.cyber-input').forEach(input => {
    input.addEventListener('input', () => {
        const now = Date.now();
        if (now - lastTypeTime > 80) {
            playSound('type');
            lastTypeTime = now;
        }
    });
});
        document.querySelectorAll('.cyber-input').forEach(input => {
            input.addEventListener('focus', () => playSound('select'));
            input.addEventListener('input', () => playSound('type'));
        });

        // Glitch effect on logo
        setInterval(() => {
            const logo = document.querySelector('.logo-text');
            if (Math.random() > 0.95) {
                logo.style.animation = 'none';
                setTimeout(() => {
                    logo.style.animation = 'gradientShift 3s ease infinite';
                }, 100);
            }
        }, 3000);