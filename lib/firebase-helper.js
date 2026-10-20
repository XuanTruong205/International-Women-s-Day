/**
 * Firebase Auth Helper
 * Cung cấp hàm tiện ích để chờ Firebase khôi phục session
 * và lấy idToken an toàn cho các API call.
 */
(function () {
  'use strict';

  /**
   * Chờ Firebase khôi phục auth state (sau page refresh).
   * @returns {Promise<firebase.User|null>}
   */
  function waitForFirebaseUser() {
    return new Promise((resolve) => {
      if (typeof BirthdayAuth === 'undefined') {
        resolve(null);
        return;
      }
      const unsub = BirthdayAuth.onAuthStateChanged((user) => {
        unsub();
        resolve(user);
      });
    });
  }

  /**
   * Lấy idToken an toàn — tự chờ Firebase ready nếu cần.
   * @returns {Promise<string|null>}
   */
  async function getIdTokenSafe() {
    // Thử lấy ngay
    let token = null;
    try {
      token = await BirthdayAuth.getIdToken();
    } catch (e) {
      // ignore
    }

    if (token) return token;

    // Firebase chưa sẵn sàng → chờ onAuthStateChanged
    const firebaseUser = await waitForFirebaseUser();
    if (firebaseUser) {
      try {
        token = await firebaseUser.getIdToken();
      } catch (e) {
        console.error('[FirebaseHelper] Lỗi lấy idToken:', e);
      }
    }

    return token;
  }

  /**
   * Lấy API base URL từ APP_CONFIG.
   * @returns {string}
   */
  function getApiBase() {
    return (window.APP_CONFIG && window.APP_CONFIG.apiBase) || 'https://hearlyserver.onrender.com';
  }

  // Export ra global
  window.FirebaseHelper = {
    waitForFirebaseUser,
    getIdTokenSafe,
    getApiBase
  };
})();
