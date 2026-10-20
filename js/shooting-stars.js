/**
 * shooting-stars.js
 * Tạo các sao băng ngẫu nhiên vào #shooting-stars container.
 */
function createShootingStars() {
  const container = document.getElementById('shooting-stars');
  if (!container) return;
  for (let i = 0; i < 20; i++) {
    const star = document.createElement('div');
    star.className = 'shooting-star';
    star.style.left  = (Math.random() * 0.8 * window.innerWidth + 0.2 * window.innerWidth) + 'px';
    star.style.top   = (Math.random() * 0.3 * window.innerHeight) + 'px';
    star.style.animationDelay = (Math.random() * 10) + 's';
    const size = 3 + Math.random() * 3;
    star.style.width  = size + 'px';
    star.style.height = size + 'px';
    container.appendChild(star);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', createShootingStars);
} else {
  createShootingStars();
}
