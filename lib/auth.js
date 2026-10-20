/**
 * Firebase Google Auth + Backend /api/auth/*
 * Theo tài liệu huong-dan-dang-nhap-google.md
 */
(function () {
  const AUTH_CACHE_KEY = "birthdayCreateAuth";

  function getConfig() {
    return window.APP_CONFIG || {};
  }

  function apiBase() {
    return String(getConfig().apiBase || "").replace(/\/$/, "");
  }

  function isFirebaseConfigured() {
    const fb = getConfig().firebase || {};
    const key = String(fb.apiKey || "");
    return Boolean(
      key &&
        !key.includes("REPLACE") &&
        fb.projectId &&
        fb.appId &&
        !String(fb.appId).includes("REPLACE"),
    );
  }

  // Kiểm tra có phải môi trường mobile hay in-app browser (Zalo, Facebook, TikTok webview)
  function isMobileOrInAppBrowser() {
    const ua = navigator.userAgent || "";
    return /Android|iPhone|iPad|iPod|FBAN|FBAV|Instagram|Zalo|TikTok/i.test(ua);
  }

  // Dịch thông báo lỗi chuẩn và thân thiện theo tài liệu huong-dan-dang-nhap-google.md
  function formatAuthError(err) {
    if (!err) return "Đăng nhập thất bại, vui lòng thử lại.";
    const code = err.code || "";
    const msg = err.message || "";
    if (code === "auth/popup-closed-by-user") {
      return ""; // Không hiện alert báo lỗi khi người dùng tự tắt popup
    }
    if (code === "auth/cancelled-popup-request") {
      return "Yêu cầu đăng nhập trước đó đã bị hủy do có yêu cầu mới.";
    }
    if (code === "auth/popup-blocked") {
      return "Trình duyệt đã chặn popup. Đang chuyển sang chế độ chuyển hướng (Redirect)...";
    }
    if (code === "auth/unauthorized-domain") {
      const currentHost = typeof window !== "undefined" ? window.location.hostname : "domain hiện tại";
      return `Tên miền '${currentHost}' chưa được thêm vào Authorized domains trong Firebase Console (Authentication > Settings > Authorized domains).`;
    }
    if (code === "auth/network-request-failed") {
      return "Lỗi kết nối mạng, vui lòng kiểm tra lại đường truyền hoặc tạm tắt AdBlock.";
    }
    if (code === "auth/operation-not-supported-in-this-environment") {
      return "Trình duyệt không hỗ trợ popup. Đang chuyển sang chế độ chuyển hướng...";
    }
    return msg || "Đăng nhập thất bại, vui lòng thử lại.";
  }

  let auth = null;
  let googleProvider = null;
  let initError = null;

  function initFirebase() {
    if (auth) return auth;
    if (typeof firebase === "undefined") {
      initError = "Chưa tải Firebase SDK.";
      throw new Error(initError);
    }
    if (!isFirebaseConfigured()) {
      initError =
        "Chưa cấu hình Firebase Web (lib/app-config.js). Lấy firebaseConfig từ Firebase Console.";
      throw new Error(initError);
    }

    if (!firebase.apps.length) {
      firebase.initializeApp(getConfig().firebase);
    }
    auth = firebase.auth();
    googleProvider = new firebase.auth.GoogleAuthProvider();
    googleProvider.setCustomParameters({ prompt: "select_account" });
    return auth;
  }

  function readCache() {
    try {
      const raw = localStorage.getItem(AUTH_CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed?.email) return null;
      return {
        email: String(parsed.email).trim(),
        name: typeof parsed.name === "string" ? parsed.name : "",
        avatarUrl:
          typeof parsed.avatarUrl === "string" ? parsed.avatarUrl : "",
        id: parsed.id || "",
        uid: parsed.uid || "",
      };
    } catch {
      return null;
    }
  }

  function syncPaymentIdentity(user) {
    try {
      if (user?.uid) {
        localStorage.setItem("user_uid", String(user.uid));
      } else {
        localStorage.removeItem("user_uid");
      }
      if (user?.email) {
        localStorage.setItem("customerEmail", String(user.email));
      } else {
        localStorage.removeItem("customerEmail");
      }
    } catch {
      /* ignore */
    }
  }

  function writeCache(user) {
    if (!user?.email) {
      localStorage.removeItem(AUTH_CACHE_KEY);
      syncPaymentIdentity(null);
      return;
    }
    localStorage.setItem(
      AUTH_CACHE_KEY,
      JSON.stringify({
        email: user.email,
        name: user.name || "",
        avatarUrl: user.avatarUrl || "",
        id: user.id || "",
        uid: user.uid || "",
      }),
    );
    syncPaymentIdentity(user);
  }

  function mapApiUser(user) {
    if (!user?.email) return null;
    return {
      id: user.id || user.uid || "",
      uid: user.uid || user.id || "",
      email: String(user.email).trim(),
      name: user.name || user.displayName || "",
      avatarUrl: user.avatarUrl || user.photoURL || user.picture || "",
      provider: user.provider || "google",
    };
  }

  async function getIdToken(forceRefresh = false) {
    initFirebase();
    const user = auth.currentUser;
    if (!user) return null;
    return user.getIdToken(forceRefresh);
  }

  // Xác thực token với Backend qua /api/auth/google (hoặc /api/auth/login)
  async function verifyTokenWithBackend(firebaseUser) {
    const idToken = await firebaseUser.getIdToken(true);
    const base = apiBase();
    let resData = null;
    let response = null;

    // 1. Thử gọi /api/auth/google
    try {
      response = await fetch(`${base}/api/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      if (response.ok) {
        resData = await response.json();
      }
    } catch (e) {
      // ignore, fallback sang /api/auth/login
    }

    // 2. Fallback sang /api/auth/login nếu cần
    if (!resData || !resData.success) {
      try {
        response = await fetch(`${base}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken }),
        });
        resData = await response.json();
      } catch (err) {
        // network error
      }
    }

    if (!response || !response.ok || !resData?.success) {
      throw new Error(
        resData?.message ||
          `Xác thực token tại máy chủ thất bại (${response ? response.status : "Mất kết nối"})`,
      );
    }

    const user = mapApiUser(resData.user) || {
      id: firebaseUser.uid,
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      name: firebaseUser.displayName || "",
      avatarUrl: firebaseUser.photoURL || "",
      provider: "google",
    };

    writeCache(user);
    return user;
  }

  async function apiLogin(idToken) {
    const res = await fetch(`${apiBase()}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });
    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    if (!res.ok || !data?.success) {
      const err = new Error(
        data?.message || `Đăng nhập thất bại (${res.status})`,
      );
      err.status = res.status;
      throw err;
    }
    return mapApiUser(data.user);
  }

  async function apiMe(idToken) {
    const res = await fetch(`${apiBase()}/api/auth/me`, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (res.status === 401) return null;
    let data = null;
    try {
      data = await res.json();
    } catch {
      return null;
    }
    if (!res.ok || !data?.success) return null;
    return mapApiUser(data.user);
  }

  async function apiLogout() {
    try {
      await fetch(`${apiBase()}/api/auth/logout`, { method: "POST" });
    } catch {
      /* ignore */
    }
  }

  async function signInWithGoogle() {
    if (window.AuthLogger) {
      window.AuthLogger.info(`Bắt đầu đăng nhập Google. Hostname: ${window.location.hostname}, Protocol: ${window.location.protocol}`);
      window.AuthLogger.info(`User-Agent: ${navigator.userAgent}`);
    }

    try {
      initFirebase();
    } catch (e) {
      if (window.AuthLogger) window.AuthLogger.error(`Khởi tạo Firebase thất bại: ${e.message}`);
      throw e;
    }

    // Kiểm tra nhanh domain
    const host = window.location.hostname;
    const isLocalhost = host === "localhost" || host === "127.0.0.1";
    if (!isLocalhost && !host.includes("firebaseapp.com") && !host.includes("web.app")) {
      if (window.AuthLogger) {
        window.AuthLogger.warn(
          `Domain '${host}' cần có trong Firebase Console > Authentication > Settings > Authorized domains`
        );
      }
    }

    let authResult = null;

    // Chiến lược Popup First (kể cả trên Mobile):
    // Trên iOS Safari và Android Chrome hiện đại, popup mở trực tiếp từ thao tác chạm của user (direct gesture)
    // hoạt động rất tốt và TRÁNH ĐƯỢC lỗi mất cookie/session bên thứ ba của redirect!
    try {
      if (window.AuthLogger) window.AuthLogger.info("Đang mở cửa sổ đăng nhập Google (signInWithPopup)...");
      authResult = await auth.signInWithPopup(googleProvider);
      if (window.AuthLogger) window.AuthLogger.success("signInWithPopup thành công! Đang lấy thông tin user...");
    } catch (err) {
      const code = err?.code || "";
      if (window.AuthLogger) window.AuthLogger.warn(`signInWithPopup không thành công: [${code}] ${err?.message}`);

      // Nếu user chủ động đóng popup -> không làm gì thêm
      if (code === "auth/popup-closed-by-user") {
        if (window.AuthLogger) window.AuthLogger.info("Người dùng đã đóng popup đăng nhập.");
        throw err;
      }

      // Nếu lỗi unauthorized domain -> dừng và báo lỗi cấu hình, không redirect vì redirect cũng sẽ lỗi
      if (code === "auth/unauthorized-domain") {
        if (window.AuthLogger) {
          window.AuthLogger.error(
            `Domain '${host}' chưa được thêm vào Authorized Domains của Firebase! Vui lòng vào Firebase Console thêm '${host}' vào danh sách.`
          );
        }
        throw err;
      }

      // Các trường hợp bị chặn popup hoặc môi trường webview không cho popup:
      // Tự động chuyển sang signInWithRedirect
      if (window.AuthLogger) {
        window.AuthLogger.info("Popup bị chặn hoặc không khả dụng, chuyển sang chế độ chuyển hướng (signInWithRedirect)...");
      }

      try {
        await auth.signInWithRedirect(googleProvider);
        if (window.AuthLogger) window.AuthLogger.info("Đang chuyển trang sang Google Identity...");
        return null;
      } catch (redirectErr) {
        if (window.AuthLogger) {
          window.AuthLogger.error(`signInWithRedirect thất bại: [${redirectErr?.code}] ${redirectErr?.message}`);
        }
        throw redirectErr;
      }
    }

    if (authResult && authResult.user) {
      if (window.AuthLogger) {
        window.AuthLogger.success(`Đã nhận Firebase User: ${authResult.user.email} (UID: ${authResult.user.uid})`);
      }
      try {
        if (window.AuthLogger) window.AuthLogger.info("Đang xác thực token với backend...");
        const verified = await verifyTokenWithBackend(authResult.user);
        if (window.AuthLogger) window.AuthLogger.success("Backend xác thực thành công!");
        return verified;
      } catch (e) {
        if (window.AuthLogger) {
          window.AuthLogger.warn(`Backend verify thất bại (dùng Firebase user trực tiếp): ${e.message}`);
        }
        var fbUser = authResult.user;
        var fallback = {
          id: fbUser.uid,
          uid: fbUser.uid,
          email: fbUser.email || "",
          name: fbUser.displayName || "",
          avatarUrl: fbUser.photoURL || "",
          provider: "google"
        };
        writeCache(fallback);
        return fallback;
      }
    }
    return null;
  }

  async function completeRedirectIfAny() {
    try {
      initFirebase();
    } catch {
      return null;
    }
    try {
      if (window.AuthLogger) window.AuthLogger.info("Kiểm tra getRedirectResult()...");
      const result = await auth.getRedirectResult();
      if (!result?.user) {
        if (window.AuthLogger) window.AuthLogger.info("getRedirectResult: không có phiên redirect chờ xử lý.");
        return null;
      }
      if (window.AuthLogger) {
        window.AuthLogger.success(`getRedirectResult thành công: ${result.user.email}`);
      }
      try {
        return await verifyTokenWithBackend(result.user);
      } catch (e) {
        if (window.AuthLogger) {
          window.AuthLogger.warn(`Backend verify redirect user failed, using directly: ${e.message}`);
        }
        var fbUser = result.user;
        var fallback = {
          id: fbUser.uid,
          uid: fbUser.uid,
          email: fbUser.email || "",
          name: fbUser.displayName || "",
          avatarUrl: fbUser.photoURL || "",
          provider: "google"
        };
        writeCache(fallback);
        return fallback;
      }
    } catch (err) {
      if (window.AuthLogger) {
        window.AuthLogger.error(`Lỗi getRedirectResult: [${err?.code}] ${err?.message}`);
      }
      throw err;
    }
  }

  async function resolveSessionUser() {
    try {
      initFirebase();
    } catch {
      return null;
    }

    const firebaseUser = auth.currentUser;
    if (!firebaseUser) {
      writeCache(null);
      return null;
    }

    try {
      return await verifyTokenWithBackend(firebaseUser);
    } catch {
      writeCache(null);
      return null;
    }
  }

  function onAuthStateChanged(callback) {
    try {
      initFirebase();
    } catch (err) {
      callback(null, err);
      return () => {};
    }
    return auth.onAuthStateChanged((firebaseUser) => {
      callback(firebaseUser, null);
    });
  }

  async function signOut() {
    await apiLogout();
    try {
      initFirebase();
      await auth.signOut();
    } catch {
      /* ignore */
    }
    writeCache(null);
  }

  window.BirthdayAuth = {
    AUTH_CACHE_KEY,
    isFirebaseConfigured,
    getInitError: () => initError,
    isMobileOrInAppBrowser,
    formatAuthError,
    verifyTokenWithBackend,
    readCache,
    writeCache,
    getIdToken,
    apiLogin,
    apiMe,
    signInWithGoogle,
    completeRedirectIfAny,
    resolveSessionUser,
    onAuthStateChanged,
    signOut,
    mapApiUser,
  };
})();
