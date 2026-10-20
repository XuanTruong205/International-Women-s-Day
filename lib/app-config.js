/**
 * Cấu hình app (public).
 * Firebase project Backend: heartly-8a4dd
 */
(function () {
  window.APP_CONFIG = {
    apiBase: "https://hearlyserver.onrender.com",
    firebase: {
      apiKey: "AIzaSyCzLPWcMyCW3klCNJ00O0Jxvt8t3pxR2n4",
      authDomain: "heartly-8a4dd.firebaseapp.com",
      projectId: "heartly-8a4dd",
      storageBucket: "heartly-8a4dd.firebasestorage.app",
      messagingSenderId: "534455229736",
      appId: "1:534455229736:web:fbc0679c4a12efe9ea041d",
      measurementId: "G-JNJ6DBF81N",
    },
  };

  /** Cho phép override trước khi load script (test/staging). */
  if (window.__APP_CONFIG__ && typeof window.__APP_CONFIG__ === "object") {
    window.APP_CONFIG = {
      ...window.APP_CONFIG,
      ...window.__APP_CONFIG__,
      firebase: {
        ...window.APP_CONFIG.firebase,
        ...(window.__APP_CONFIG__.firebase || {}),
      },
    };
  }
})();
