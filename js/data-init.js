/**
 * data-init.js
 * Khởi tạo dữ liệu (messages, music, images, popup...) từ các nguồn:
 *   1. URL param ?c=<base64-gzip-json>  (ưu tiên cao nhất)
 *   2. URL param đơn lẻ: ?music=, ?messages=, ?image=, ?title=, ?popupMessage=
 *   3. ?id=<serverKey> — fetch từ API (xem loader.js / server trả về)
 *   4. defaultData (fallback)
 *
 * Sau khi data sẵn sàng, ghi vào window.dataChristmasTree và window.Heartlove,
 * rồi dispatch Event "configLoaded" để các module khác lắng nghe.
 */

/* ── Giải mã blob nén ?c= ─────────────────────────────────── */
function decodeData(encoded) {
  try {
    let b64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const raw = atob(b64);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    return JSON.parse(pako.inflate(bytes, { to: 'string' }));
  } catch (e) {
    console.error('Lỗi giải mã dữ liệu:', e);
    return null;
  }
}

/* ── Đọc param từ URL (hỗ trợ ?c= blob) ─────────────────── */
function getUrlParam(key) {
  const params = new URLSearchParams(window.location.search);
  const blob = params.get('c');
  if (blob) {
    const decoded = decodeData(blob);
    if (decoded && decoded[key] !== undefined) return decoded[key];
  }
  const raw = params.get(key);
  return raw ? decodeURIComponent(raw) : null;
}

/**
 * Trích URL nhạc từ giá trị music trong API.
 * API có thể trả:
 *   - string: "assets/music/xxx.mp3" hoặc "https://cdn.../xxx.mp3"
 *   - object: { type: "sample"|"custom", path: "...", url: "...", name: "..." }
 * @param {string|Object} music
 * @returns {string} URL nhạc hoặc chuỗi rỗng
 */
function resolveMusicUrl(music) {
  if (!music) return '';
  if (typeof music === 'string') return music;
  if (typeof music === 'object') {
    // Ưu tiên: url → path
    return music.url || music.path || '';
  }
  return '';
}
// Export cho loader.js dùng chung
window.resolveMusicUrl = resolveMusicUrl;

const DEFAULT_IMAGES = [
  'assets/image/chi1.png',
  'assets/image/chi2.jpg',
  'assets/image/chi3.jpg',
  'assets/image/chi4.png',
  'assets/image/chi5.jpg',
];

/* ── Dữ liệu mặc định (fallback khi không có server) ────── */
const DEFAULT = {
  title:        'Chúc Mừng 20/10 - Gửi Chi ✨',
  music:        'assets/music/cho-anh-chut-thoi.mp3',
  popupMessage: 'Chúc Chi ngày 20/10 thật nhiều niềm vui, luôn xinh đẹp rạng ngời và hạnh phúc trọn vẹn! Cảm ơn Chi vì đã luôn mang lại những điều tuyệt vời và nụ cười ấm áp. Mong mọi điều tốt lành, may mắn và ngọt ngào nhất luôn đồng hành cùng Chi! 💐✨',
  messages: [
    'Chúc Mừng 20/10 💐',
    'Gửi Đến Chi Re ✨',
    'Chúc Chi Luôn Xinh Đẹp ✨',
    'Rạng Rỡ & Hạnh Phúc ✨'
  ],
  images:   DEFAULT_IMAGES,
};

/* ── Đọc URL params ──────────────────────────────────────── */
const _urlMusic   = getUrlParam('music');
const _urlMsgs    = getUrlParam('messages');
const _urlImages  = getUrlParam('image');
const _urlTitle   = getUrlParam('title');
const _urlPopup   = getUrlParam('popupMessage');

function toArray(val) {
  if (!val) return null;
  if (Array.isArray(val)) return val;
  return val.split(',').map(s => s.trim());
}

/* ── Đọc dữ liệu xem trước (nếu có param ?preview=1 và không phải ?sample) ─── */
const _urlParams = new URLSearchParams(window.location.search);
const _isSample = _urlParams.has('sample');
const _isPreview = !_isSample && _urlParams.has('preview');
let _preview = null;
if (_isPreview && typeof PreviewStorage !== 'undefined') {
  _preview = PreviewStorage.getSync();
}

/* ── Khởi tạo global data ────────────────────────────────── */
const _previewImages = (_preview && Array.isArray(_preview.imageUrls)) ? _preview.imageUrls : null;
const _data = _isSample
  ? {
      title:        DEFAULT.title,
      music:        DEFAULT.music,
      popupMessage: DEFAULT.popupMessage,
      messages:     DEFAULT.messages,
      images:       DEFAULT.images,
    }
  : {
      title:        _urlTitle  || DEFAULT.title,
      music:        (_preview && _preview.musicSrc) || _urlMusic || DEFAULT.music,
      popupMessage: _urlPopup  || DEFAULT.popupMessage,
      messages:     (_preview && _preview.intro && _preview.intro.length > 0) ? _preview.intro : (toArray(_urlMsgs) || DEFAULT.messages),
      images:       _previewImages !== null ? _previewImages : (toArray(_urlImages) || DEFAULT.images),
    };

window.dataChristmasTree = {
  template: 'love',
  data: {
    title:           _data.title,
    type_music:      'link',
    music_id:        _data.music,
    backgroundMusic: _data.music,
    popupMessage:    _data.popupMessage,
    messages:        _data.messages,
    images:          _data.images,
  },
};

window.Heartlove = {
  data: {
    popupMessage: _data.popupMessage,
    messages:     _data.messages,
    images:       _data.images,
    heartColor:   '#fd9595',
    music:        _data.music,
  },
};

if (!_isPreview) {
  window.LOVEGIFT_IMAGES = _data.images;
}

// Cấu hình chuyển tiếp cho loader.js và home.js khi xem trước
if (_isPreview) {
  const currentImgs = (_preview && _preview.imageUrls && _preview.imageUrls.length > 0) ? _preview.imageUrls : [];
  window.__previewConfig = {
    messages: (_preview && _preview.wishes && _preview.wishes.length > 0) ? _preview.wishes : null,
    images: currentImgs,
    music: (_preview && _preview.musicSrc) ? _preview.musicSrc : null,
  };
  window.LOVEGIFT_IMAGES = currentImgs;

  if (typeof PreviewStorage !== 'undefined') {
    PreviewStorage.getAsync().then(function (asyncData) {
      if (asyncData) {
        if (asyncData.musicSrc) {
          window.Heartlove.data.music = asyncData.musicSrc;
          window.dataChristmasTree.data.backgroundMusic = asyncData.musicSrc;
          if (window.__previewConfig) window.__previewConfig.music = asyncData.musicSrc;
        }
        const asyncImgs = (asyncData.imageUrls && asyncData.imageUrls.length > 0) ? asyncData.imageUrls : [];
        if (window.__previewConfig) window.__previewConfig.images = asyncImgs;
        window.LOVEGIFT_IMAGES = asyncImgs;
        window.Heartlove.data.images = asyncImgs;
        window.dataChristmasTree.data.images = asyncImgs;
      }
    });
  }
}

/**
 * applyConfig(cfg) — được gọi khi server trả về config (qua ?id= hoặc API).
 * Ghi đè các trường có trong cfg vào window.dataChristmasTree & window.Heartlove,
 * sau đó dispatch "configLoaded" để enhanced-effects.js nhận data mới.
 *
 * @param {Object} cfg - { music?, messages?, images?, popupMessage?, titleMessage? }
 */
window.applyConfig = function applyConfig(cfg) {
  const tree = window.dataChristmasTree.data;
  const hl   = window.Heartlove.data;

  if (cfg.music) {
    tree.music_id = tree.backgroundMusic = hl.music = cfg.music;
  }
  if (cfg.messages && cfg.messages.length > 0) {
    tree.messages = hl.messages = cfg.messages;
  }
  if (cfg.popupMessage) {
    tree.popupMessage = hl.popupMessage = cfg.popupMessage;
  }
  if (cfg.titleMessage) {
    const titleEl = document.querySelector('.popup-title');
    if (titleEl) titleEl.textContent = cfg.titleMessage;
  }
  if (cfg.images !== undefined) {
    const list = (cfg.images && cfg.images.length > 0) ? cfg.images : [];
    tree.images = hl.images = list;
    window.LOVEGIFT_IMAGES = list;
  }
  // Lưu wishes vào global để các component khác có thể đọc
  if (cfg.wishes && cfg.wishes.length > 0) {
    window.__lovegiftWishes = cfg.wishes;
  }

  window.dispatchEvent(new CustomEvent('configLoaded', { detail: cfg }));
};

/**
 * mapFallingLoveResponse(apiData) — Trích config từ API response.
 * Dùng chung cho cả data-init.js và loader.js (DRY — fetch 1 lần).
 * @param {Object} apiData - response.data từ API (object chứa intro, images, music, ...)
 * @returns {Object} cfg - { messages?, images?, music?, popupMessage?, titleMessage?, color?, wishes?, fontName? }
 */
window.mapFallingLoveResponse = function mapFallingLoveResponse(apiData) {
  var d = apiData;
  var cfg = {};

  // Messages / Intro (hiển thị trên intro screen)
  var msgs = d.intro || d.messages || d.arrayText;
  if (msgs && msgs.length > 0) cfg.messages = msgs;

  // Images
  var imgs = d.images || d.image;
  if (imgs !== undefined) {
    cfg.images = (Array.isArray(imgs) && imgs.length > 0) ? imgs : [];
  }

  // Music — API có thể trả object {type, path, url, name} hoặc string
  var musicSrc = resolveMusicUrl(d.music) || d.musicUrl || '';
  if (musicSrc) cfg.music = musicSrc;

  // Popup message
  if (d.popupMessage) cfg.popupMessage = d.popupMessage;

  // Title
  if (d.title) cfg.titleMessage = d.title;

  // Color
  if (d.color) cfg.color = d.color;

  // Font
  if (d.fontName) cfg.fontName = d.fontName;

  // Wishes (messages hiển thị trên love rain screen)
  if (d.wishes && d.wishes.length > 0) cfg.wishes = d.wishes;

  // Legacy format (settings)
  if (d.settings) {
    var s = d.settings;
    if (s.arrayText && s.arrayText.length > 0 && !cfg.messages) cfg.messages = s.arrayText;
    if (s.image !== undefined && cfg.images === undefined) {
      cfg.images = (s.image && s.image.length > 0) ? s.image : [];
    }
    if (s.music && !cfg.music) cfg.music = s.music;
    if (s.color && !cfg.color) cfg.color = s.color;
  }

  return cfg;
};

/* ── Fetch sớm từ API khi có ?id= (trước intro animation) ── */
/* Pattern: fetch 1 lần → Promise global → các module khác await */
var _serverId = new URLSearchParams(window.location.search).get('id');
if (_serverId && !_isPreview && !_isSample) {
  var _apiBase = (window.APP_CONFIG && window.APP_CONFIG.apiBase)
    ? window.APP_CONFIG.apiBase.replace(/\/$/, '')
    : 'https://hearlyserver.onrender.com';

  console.log('📥 [DataInit] Fetching config cho id:', _serverId);

  // ★ Tạo Promise global — loader.js sẽ await Promise này thay vì fetch lại
  window._fallingLoveReady = fetch(_apiBase + '/api/falling-loves/' + _serverId)
    .then(function (r) { return r.json(); })
    .then(function (data) {
      console.log('📥 [DataInit] API response:', data);
      if (data.success && data.data) {
        // ★ Lưu raw data vào global để loader.js đọc (Single Source of Truth)
        window.FallingLoveData = data.data;

        // Map và apply config ngay (intro screen cần data sớm)
        var cfg = window.mapFallingLoveResponse(data.data);
        window.applyConfig(cfg);
        console.log('✅ [DataInit] Config đã apply từ API');
        return data.data;
      }
      return null;
    })
    .catch(function (err) {
      console.error('[DataInit] Lỗi fetch config:', err);
      return null;
    })
    .finally(function () {
      // Ẩn loading overlay sau khi API trả về
      var overlay = document.getElementById('loading-overlay');
      var bar = document.getElementById('loading-progress');
      var pct = document.getElementById('loading-percent');
      if (bar) bar.style.width = '100%';
      if (pct) pct.textContent = '100%';
      if (overlay) {
        setTimeout(function () {
          overlay.classList.add('fade-out');
          setTimeout(function () { overlay.classList.add('hidden'); }, 800);
        }, 300);
      }
    });
} else {
  // Không có ?id= → Promise resolve ngay (null = dùng default/preview)
  window._fallingLoveReady = Promise.resolve(null);

  /* ── Ẩn loading overlay ngay (không cần fetch) ───── */
  (function hideLoading() {
    const overlay  = document.getElementById('loading-overlay');
    const bar      = document.getElementById('loading-progress');
    const pct      = document.getElementById('loading-percent');
    if (bar) bar.style.width = '100%';
    if (pct) pct.textContent = '100%';
    if (overlay) {
      setTimeout(() => {
        overlay.classList.add('fade-out');
        setTimeout(() => overlay.classList.add('hidden'), 800);
      }, 400);
    }
  })();
}

console.log('Dữ liệu đã load:', window.Heartlove);

