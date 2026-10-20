/**
 * shooting-stars.js
 * Tạo các sao băng ngẫu nhiên vào #shooting-stars container.
 */
function createShootingStars() {
  ['shooting-stars', 'shooting-stars-rain'].forEach(function (id) {
    const container = document.getElementById(id);
    if (!container) return;
    container.innerHTML = '';
    for (let i = 0; i < 24; i++) {
      const star = document.createElement('div');
      star.className = 'shooting-star';
      star.style.left  = (Math.random() * window.innerWidth) + 'px';
      star.style.top   = (Math.random() * 0.45 * window.innerHeight) + 'px';
      star.style.animationDelay = (Math.random() * 8) + 's';
      const size = 3 + Math.random() * 3;
      star.style.width  = size + 'px';
      star.style.height = size + 'px';
      container.appendChild(star);
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', createShootingStars);
} else {
  createShootingStars();
}
