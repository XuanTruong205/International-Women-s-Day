/**
 * start-button.js
 * Xử lý nút "Giữ để bắt đầu" / "Chạm để bắt đầu" (Android).
 * Khi hoàn thành dispatch window Event "__textStart" để enhanced-effects.js bắt đầu.
 */
(function () {
  const wrap     = document.getElementById('start-wrap');
  const ringFill = document.getElementById('ring-fill');
  const label    = document.getElementById('start-label');
  if (!wrap) return;

  const HOLD_MS   = 1000;
  const isAndroid = /Android/i.test(navigator.userAgent || '');
  let holdTimer = null, holdStart = 0, triggered = false;
  let _audio = null;

  /* Lấy URL nhạc từ data đã khởi tạo */
  function getMusicUrl() {
    return (window.Heartlove && window.Heartlove.data && window.Heartlove.data.music)
      || (window.dataChristmasTree && window.dataChristmasTree.data && window.dataChristmasTree.data.backgroundMusic)
      || null;
  }

  /**
   * Bước 1 — gọi trong pointerdown (user gesture context).
   * Tạo Audio + play() ngay để browser "unlock" audio context,
   * sau đó pause + seek về 0 để chờ complete().
   */
  function unlockMusic() {
    if (_audio) return;
    const url = getMusicUrl();
    if (!url) return;
    _audio = new Audio(url);
    _audio.loop   = true;
    _audio.volume = 0.8;
    _audio.play().then(() => {
      // Unlock thành công → chỉ pause nếu complete() chưa được kích hoạt
      if (!triggered) {
        _audio.pause();
        _audio.currentTime = 0;
      }
    }).catch(() => {
      // Browser vẫn chặn (rất hiếm) → thử play thẳng trong complete()
      _audio = null;
    });
    window.__introAudio = _audio;
  }

  /**
   * Bước 2 — gọi trong complete() khi giữ đủ.
   * Audio đã được unlock → chỉ cần .play() là phát được.
   */
  function startMusic() {
    const url = getMusicUrl();
    if (!url) return;
    if (_audio) {
      // Nếu src đã bị thay đổi bởi configLoaded → cập nhật
      if (url && _audio.src && !_audio.src.includes(url) && !_audio.src.endsWith(encodeURI(url))) {
        _audio.src = url;
        _audio.currentTime = 0;
      }
      // Đã unlock → resume nếu đang pause
      if (_audio.paused) {
        _audio.currentTime = 0;
        _audio.play().catch(() => {});
      }
    } else {
      // Fallback: tạo mới (Android tap — pointerdown = complete ngay)
      _audio = new Audio(url);
      _audio.loop   = true;
      _audio.volume = 0.8;
      _audio.play().catch(() => {});
      window.__introAudio = _audio;
    }
  }

  /* Lắng nghe config mới từ API (khi ?id= fetch xong) */
  window.addEventListener('configLoaded', function (e) {
    var cfg = e.detail;
    if (cfg && cfg.music && _audio) {
      var newUrl = cfg.music;
      // Chỉ cập nhật nếu URL thực sự khác
      if (newUrl && !_audio.src.includes(newUrl) && !_audio.src.endsWith(encodeURI(newUrl))) {
        var wasPaused = _audio.paused;
        var wasTime = _audio.currentTime;
        _audio.src = newUrl;
        _audio.currentTime = 0;
        if (!wasPaused) {
          _audio.play().catch(function () {});
        }
        console.log('🎵 [StartButton] Music cập nhật từ API:', newUrl);
      }
    }
  });

  /* Hiện nút sau khi loading overlay ẩn */
  function show() { wrap.classList.add('visible'); }
  const lo = document.getElementById('loading-overlay');
  if (!lo || lo.classList.contains('hidden')) {
    setTimeout(show, 200);
  } else {
    const obs = new MutationObserver(() => {
      if (lo.classList.contains('hidden')) { setTimeout(show, 200); obs.disconnect(); }
    });
    obs.observe(lo, { attributes: true, attributeFilter: ['class'] });
  }

  if (isAndroid && label) label.textContent = 'Chạm để bắt đầu';

  function complete() {
    if (triggered) return;
    triggered = true;
    startMusic(); // phát nhạc (đã unlock sẵn từ pointerdown)
    wrap.classList.add('done');
    setTimeout(() => { wrap.style.display = 'none'; }, 600);
    window.dispatchEvent(new Event('__textStart'));
  }

  function onDown(e) {
    if (triggered) return;
    e.preventDefault();

    /* Android: single-tap — unlock + complete cùng lúc trong user gesture */
    if (isAndroid) {
      complete();
      return;
    }

    /* Desktop / iOS: unlock audio ngay trong pointerdown (user gesture) */
    unlockMusic();
    holdStart = Date.now();
    ringFill.style.transition = 'stroke-dashoffset 1s linear';
    ringFill.style.strokeDashoffset = '163.36';
    void ringFill.offsetHeight; // force reflow
    ringFill.style.strokeDashoffset = '0';

    holdTimer = setInterval(() => {
      const elapsed = Date.now() - holdStart;
      if (elapsed >= 500)   wrap.classList.add('held');
      if (elapsed >= HOLD_MS) { clearInterval(holdTimer); holdTimer = null; complete(); }
    }, 80);
  }

  function onUp() {
    if (isAndroid || triggered) return;
    if (holdTimer) { clearInterval(holdTimer); holdTimer = null; }
    wrap.classList.remove('held');
    ringFill.style.transition = 'stroke-dashoffset .3s ease';
    ringFill.style.strokeDashoffset = '163.36';
  }

  wrap.addEventListener('pointerdown',  onDown);
  wrap.addEventListener('pointerup',    onUp);
  wrap.addEventListener('pointercancel', onUp);
  wrap.addEventListener('pointerleave', onUp);
})();
