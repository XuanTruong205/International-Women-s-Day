/**
 * loading-manager.js
 * Quản lý Màn chờ Tải Dữ liệu (Loading Overlay Manager)
 * Triển khai theo cấu trúc Section 2.4 của LOADING_SCREEN_GUIDE.md
 */
const LoadingScreen = {
  // Lấy các phần tử DOM
  getElements() {
    return {
      overlay: document.getElementById('transition-loading-overlay') || document.getElementById('loading-overlay'),
      bar: document.getElementById('loading-bar'),
      pct: document.getElementById('loading-pct'),
      title: document.getElementById('loading-title'),
      sub: document.getElementById('loading-sub')
    };
  },

  /**
   * Hiển thị màn chờ
   * @param {string} [title] - Tiêu đề tùy chọn (mặc định: "Đang tải dữ liệu")
   * @param {string} [sub] - Phụ đề tùy chọn (mặc định: "Đang tải ảnh và câu chúc...")
   */
  show(title, sub) {
    const el = this.getElements();
    if (!el.overlay) return;

    if (title && el.title) el.title.textContent = title;
    if (sub && el.sub) el.sub.textContent = sub;

    el.overlay.removeAttribute('hidden');
    el.overlay.hidden = false;
    el.overlay.style.opacity = '1';
    el.overlay.style.visibility = 'visible';
    el.overlay.setAttribute('aria-busy', 'true');
    el.overlay.setAttribute('aria-hidden', 'false');
    this.setProgress(0);
  },

  /**
   * Cập nhật tiến độ % (0 -> 100)
   * @param {number} percent
   */
  setProgress(percent) {
    const el = this.getElements();
    const clamped = Math.max(0, Math.min(100, Math.round(percent)));
    if (el.bar) el.bar.style.width = clamped + '%';
    if (el.pct) el.pct.textContent = clamped + '%';
  },

  /**
   * Cập nhật thông điệp phụ đề
   * @param {string} text
   */
  setMessage(text) {
    const el = this.getElements();
    if (el.sub) el.sub.textContent = text;
  },

  /**
   * Ẩn màn chờ mượt mà
   */
  hide() {
    const el = this.getElements();
    if (!el.overlay) return;
    el.overlay.style.opacity = '0';
    setTimeout(() => {
      el.overlay.setAttribute('hidden', '');
      el.overlay.hidden = true;
      el.overlay.style.visibility = 'hidden';
      el.overlay.setAttribute('aria-busy', 'false');
      el.overlay.setAttribute('aria-hidden', 'true');
    }, 500);
  },

  /**
   * Chờ một số lượng khung hình animation (giúp UI render mượt)
   * @param {number} count
   */
  waitFrames(count = 1) {
    return new Promise((resolve) => {
      function step(left) {
        if (left <= 0) return resolve();
        requestAnimationFrame(() => step(left - 1));
      }
      step(count);
    });
  },

  /**
   * Helper tải trước 1 ảnh (Preload Image vào browser cache)
   * @param {string} src
   * @returns {Promise<boolean>}
   */
  preloadImage(src) {
    return new Promise((resolve) => {
      if (!src) return resolve(false);
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = src;
    });
  },

  /**
   * Helper nạp trước 1 file script
   * @param {string} src
   * @param {boolean} [isModule=false]
   * @returns {Promise<void>}
   */
  loadScript(src, isModule = false) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) return resolve();

      const script = document.createElement('script');
      if (isModule) script.type = 'module';
      script.src = src;
      script.async = false;
      script.onload = () => resolve();
      script.onerror = (e) => {
        console.warn('Lỗi load script:', src, e);
        resolve(); // resolve để không làm kẹt tiến trình
      };
      document.body.appendChild(script);
    });
  }
};

window.LoadingScreen = LoadingScreen;
