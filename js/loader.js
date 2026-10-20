/**
 * loader.js
 * Khởi động LoveRain app sau khi intro animation kết thúc.
 * Đọc dữ liệu sản phẩm từ Promise global (data-init.js đã fetch)
 * rồi ghi vào data-page của #app trước khi inject js/app.js.
 *
 * Pattern: data-init.js fetch 1 lần → window._fallingLoveReady (Promise)
 *          loader.js await Promise → applyConfig → startApp
 */
(function () {
  var defaultPhotos = [
    "assets/image/chi1.png",
    "assets/image/chi2.jpg",
    "assets/image/chi3.jpg",
    "assets/image/chi4.png",
    "assets/image/chi5.jpg"
  ];

  if (!window.LOVEGIFT_IMAGES || window.LOVEGIFT_IMAGES.length === 0) {
    window.LOVEGIFT_IMAGES = (window.Heartlove && window.Heartlove.data && window.Heartlove.data.images && window.Heartlove.data.images.length > 0)
      ? window.Heartlove.data.images
      : defaultPhotos;
  }

  /**
   * Ghi đè cấu hình vào data-page + global objects.
   */
  function applyConfig(cfg) {
    var app = document.getElementById("app");
    var pageData;
    try {
      pageData = JSON.parse(app.dataset.page);
    } catch (e) {
      console.error("Parse data-page failed:", e);
      return;
    }

    // Wishes từ API → ghi vào client.messages (Love Rain đọc từ đây)
    // Ưu tiên wishes, nếu không có thì dùng messages (intro)
    if (cfg.wishes && cfg.wishes.length > 0) {
      pageData.props.client.messages = cfg.wishes;
    } else if (cfg.messages && cfg.messages.length > 0) {
      pageData.props.client.messages = cfg.messages;
    }

    // Images → ghi vào cả LOVEGIFT_IMAGES và client.images
    if (cfg.images !== undefined) {
      if (Array.isArray(cfg.images) && cfg.images.length > 0) {
        window.LOVEGIFT_IMAGES = cfg.images;
        window.LOVEGIFT_NO_IMAGES = false;
        pageData.props.client.images = cfg.images;
        console.log('🖼️ [Loader] Set LOVEGIFT_IMAGES:', cfg.images.length, 'ảnh', cfg.images);
      } else {
        window.LOVEGIFT_IMAGES = [];
        window.LOVEGIFT_NO_IMAGES = true;
        pageData.props.client.images = [];
        console.warn('🖼️ [Loader] Set LOVEGIFT_NO_IMAGES = true (images rỗng)');
      }
    }
    if (cfg.music) {
      pageData.props.client.music = cfg.music;
    }
    if (cfg.color) {
      pageData.props.client.color = cfg.color;
    }
    if (cfg.fontName) {
      pageData.props.client.fontName = cfg.fontName;
    }

    app.dataset.page = JSON.stringify(pageData);
  }

  function startApp() {
    window.__lovegiftConfigReady = true;
    window.dispatchEvent(new Event("lovegift-ready"));
    var s1 = document.createElement("script");
    s1.type = "module";
    s1.src = "js/app.js";
    s1.onerror = function () {
      console.error("Không tải được js/app.js");
    };
    document.body.appendChild(s1);
  }

  function autoStart() {
    if (window.__loveRainStarted) return;
    window.__loveRainStarted = true;

    // Intercept history.pushState/replaceState TRƯỚC khi Inertia chạy
    // Khi Inertia cố đổi URL sang "/" (từ data-page), ta giữ nguyên URL gốc
    // → không còn hiện tượng giật URL trên thanh địa chỉ
    var _origPush = history.pushState.bind(history);
    var _origReplace = history.replaceState.bind(history);
    var _guardCount = 0;
    var _maxGuard = 3; // chỉ chặn vài lần đầu (lúc Inertia init)

    history.pushState = function (state, title, url) {
      if (_guardCount < _maxGuard && url && _savedUrl) {
        var newPath = (typeof url === 'string') ? url : url.toString();
        if (newPath === '/' || (newPath.indexOf('?') === -1 && _savedUrl.indexOf('?') !== -1)) {
          _guardCount++;
          return _origReplace.call(history, state, title, _savedUrl);
        }
      }
      return _origPush.call(history, state, title, url);
    };

    history.replaceState = function (state, title, url) {
      if (_guardCount < _maxGuard && url && _savedUrl) {
        var newPath = (typeof url === 'string') ? url : url.toString();
        if (newPath === '/' || (newPath.indexOf('?') === -1 && _savedUrl.indexOf('?') !== -1)) {
          _guardCount++;
          return _origReplace.call(history, state, title, _savedUrl);
        }
      }
      return _origReplace.call(history, state, title, url);
    };

    startApp();

    // Gỡ intercept sau 3 giây (Inertia đã init xong)
    setTimeout(function () {
      history.pushState = _origPush;
      history.replaceState = _origReplace;
    }, 3000);
  }

  // Lưu URL gốc trước khi Inertia thay đổi
  var _savedUrl = window.location.pathname + window.location.search + window.location.hash;
  var params = new URLSearchParams(window.location.search);
  var cfgId = params.get("id");
  var isSample = params.has("sample");

  if (cfgId && !isSample) {
    // ★ Await Promise từ data-init.js — KHÔNG fetch lại API
    // data-init.js đã fetch và lưu vào window.FallingLoveData
    var ready = window._fallingLoveReady || Promise.resolve(null);
    ready.then(function () {
      var apiData = window.FallingLoveData;
      if (apiData) {
        // Dùng hàm mapping chung từ data-init.js
        var mapFn = window.mapFallingLoveResponse || function () { return {}; };
        var cfg = mapFn(apiData);
        console.log('📥 [Loader] Config from DataInit:', cfg);
        applyConfig(cfg);
      } else {
        console.warn('[Loader] Không có dữ liệu từ API — dùng default');
        window.LOVEGIFT_IMAGES = (window.Heartlove && window.Heartlove.data && window.Heartlove.data.images && window.Heartlove.data.images.length > 0)
          ? window.Heartlove.data.images
          : defaultPhotos;
      }
    }).catch(function (err) {
      console.error('[Loader] Lỗi await config:', err);
    }).finally(autoStart);

  } else if (isSample) {
    // ★ Chế độ Xem mẫu đầy đủ — Đảm bảo 100% dữ liệu mặc định chuẩn
    window.LOVEGIFT_IMAGES = defaultPhotos;
    window.LOVEGIFT_NO_IMAGES = false;
    var sampleApp = document.getElementById("app");
    if (sampleApp) {
      try {
        var pageData = JSON.parse(sampleApp.dataset.page);
        pageData.props.name = "Chi";
        pageData.props.client.messages = [
          "Chúc mừng ngày 20/10,\nChi nhé! 💐",
          "Chúc Chi luôn xinh đẹp,\nrạng rỡ & hạnh phúc ✨",
          "Mỗi ngày của Chi\nđều ngập tràn niềm vui ✨",
          "Mong những điều ngọt ngào\nluôn đến với Chi 🌸"
        ];
        pageData.props.client.images = defaultPhotos;
        pageData.props.client.music = "assets/music/cho-anh-chut-thoi.mp3";
        pageData.props.client.fontName = "Mali";
        pageData.props.client.color = "#ff6b9d";
        sampleApp.dataset.page = JSON.stringify(pageData);
      } catch (e) {
        console.warn("[Loader] Lỗi reset data-page cho sample:", e);
      }
    }
    autoStart();

  } else {
    // Chế độ Xem trước (Preview) — chỉ đọc PreviewStorage khi thực sự có ?preview
    var _isPreviewMode = params.has('preview');
    if (_isPreviewMode && window.__previewConfig) {
      applyConfig(window.__previewConfig);
    } else if (_isPreviewMode && typeof PreviewStorage !== 'undefined') {
      var prev = PreviewStorage.getSync();
      if (prev) {
        var pCfg = {};
        if (prev.wishes && prev.wishes.length > 0) pCfg.messages = prev.wishes;
        pCfg.images = (prev.imageUrls && prev.imageUrls.length > 0) ? prev.imageUrls : [];
        if (prev.musicSrc) pCfg.music = prev.musicSrc;
        applyConfig(pCfg);
        if (!prev.imageUrls || prev.imageUrls.length === 0) {
          window.LOVEGIFT_NO_IMAGES = true;
          window.LOVEGIFT_IMAGES = [];
        }
      } else {
        window.LOVEGIFT_IMAGES = (window.Heartlove && window.Heartlove.data && window.Heartlove.data.images && window.Heartlove.data.images.length > 0)
          ? window.Heartlove.data.images
          : defaultPhotos;
      }
    } else {
      window.LOVEGIFT_IMAGES = (window.Heartlove && window.Heartlove.data && window.Heartlove.data.images && window.Heartlove.data.images.length > 0)
        ? window.Heartlove.data.images
        : defaultPhotos;
    }
    autoStart();
  }
})();
