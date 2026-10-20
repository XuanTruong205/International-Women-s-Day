/**
 * Payment Flow — Orchestration logic
 * Điều phối luồng thanh toán: validate → auth → gọi 3 API → mở dialog.
 * Phụ thuộc: FirebaseHelper, FallingLoveAPI, BirthdayAuth
 * Phụ thuộc DOM: showOrderToast, checkMandatoryFields, openValidationDialog,
 *               getStoredUser, checkAuthState, introItems, wishItems, selectedImages,
 *               selectedMusicSrc, selectedMusicName, musicFileBlob, selectedMethod,
 *               isForever, BASE_PRICE, FREE_INTRO, FREE_PHOTO, FREE_WISH,
 *               PRICE_INTRO, PRICE_PHOTO, PRICE_WISH, FOREVER_PRICE
 */
(function () {
  'use strict';

  /* ══════════════════════════════════════
     GOOGLE AUTH — LOGIN / LOGOUT
     ══════════════════════════════════════ */

  /**
   * Hiển thị thông báo lỗi đăng nhập ra giao diện.
   */
  function setLoginError(message) {
    const errorEl = document.getElementById('loginError');
    if (!errorEl) return;
    if (!message) {
      errorEl.textContent = '';
      errorEl.hidden = true;
    } else {
      errorEl.textContent = message;
      errorEl.hidden = false;
    }
  }

  /**
   * Cập nhật thông tin phiên người dùng khi đăng nhập thành công.
   */
  function applyLoginSuccess(user) {
    const AUTH_STORAGE_KEY = 'fl_google_user';
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
      isLoggedIn: true,
      email: user.email || '',
      name: user.name || '',
      avatar: user.avatarUrl || '',
      uid: user.uid || ''
    }));

    setLoginError('');
    if (typeof checkAuthState === 'function') {
      checkAuthState(true);
    }
    if (typeof showOrderToast === 'function') {
      showOrderToast('Đăng nhập thành công! Bắt đầu tạo quà thôi nào 💕');
    }

    setTimeout(() => {
      const introSec = document.getElementById('section-intro');
      if (introSec) {
        introSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 300);
  }

  /**
   * Đăng nhập Google qua Firebase Popup (Desktop) hoặc Redirect (Mobile/In-app).
   */
  async function loginWithGoogle() {
    const btn = document.getElementById('btnGoogleLogin');
    const btnText = document.getElementById('btnGoogleText');
    if (btn && (btn.classList.contains('loading') || btn.classList.contains('is-loading'))) return;

    setLoginError('');

    if (btn) {
      btn.classList.add('loading');
      btn.classList.add('is-loading');
      btn.disabled = true;
    }
    if (btnText) {
      btnText.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Đang kết nối Google…';
    }

    try {
      const user = await BirthdayAuth.signInWithGoogle();
      if (!user) return; // Đang chuyển hướng bằng signInWithRedirect

      applyLoginSuccess(user);
    } catch (err) {
      console.error('Lỗi đăng nhập Google:', err);
      if (window.AuthLogger) {
        window.AuthLogger.error(`Lỗi đăng nhập: [${err?.code || 'UNKNOWN'}] ${err?.message || err}`, err);
      }

      // Người dùng chủ động đóng popup -> âm thầm bỏ qua theo tài liệu
      if (err?.code === 'auth/popup-closed-by-user') {
        if (window.AuthLogger) window.AuthLogger.info('Người dùng đã đóng popup.');
        return;
      }
      const friendlyMsg = (typeof BirthdayAuth !== 'undefined' && BirthdayAuth.formatAuthError)
        ? BirthdayAuth.formatAuthError(err)
        : (err?.message || 'Đăng nhập thất bại, vui lòng thử lại.');
      if (friendlyMsg) {
        setLoginError(friendlyMsg);
        if (typeof showOrderToast === 'function') {
          showOrderToast(friendlyMsg);
        }
      }
    } finally {
      if (btn) {
        btn.classList.remove('loading');
        btn.classList.remove('is-loading');
        btn.disabled = false;
      }
      if (btnText) {
        btnText.textContent = 'Đăng nhập với Google';
      }
    }
  }

  /**
   * Fallback: Dùng thông tin Firebase user trực tiếp khi backend verification thất bại.
   * Đảm bảo người dùng vẫn vào được giao diện tạo quà (backend sẽ verify lazily sau).
   */
  function applyLoginFromFirebaseUser(firebaseUser) {
    const AUTH_STORAGE_KEY = 'fl_google_user';
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
      isLoggedIn: true,
      email: firebaseUser.email || '',
      name: firebaseUser.displayName || '',
      avatar: firebaseUser.photoURL || '',
      uid: firebaseUser.uid || ''
    }));

    // Đồng bộ identity cho payment/order
    if (firebaseUser.uid) localStorage.setItem('user_uid', firebaseUser.uid);
    if (firebaseUser.email) localStorage.setItem('customerEmail', firebaseUser.email);

    setLoginError('');
    if (typeof checkAuthState === 'function') {
      checkAuthState(true);
    }
    if (typeof showOrderToast === 'function') {
      showOrderToast('Đăng nhập thành công! Bắt đầu tạo quà thôi nào 💕');
    }

    setTimeout(() => {
      const introSec = document.getElementById('section-intro');
      if (introSec) {
        introSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 300);
  }

  /**
   * Xác thực Firebase user với backend, có timeout và fallback.
   * @param {firebase.User} firebaseUser
   * @param {number} timeoutMs - Thời gian chờ tối đa (ms)
   */
  function verifyWithFallback(firebaseUser, timeoutMs) {
    timeoutMs = timeoutMs || 10000;

    var timeoutPromise = new Promise(function (_, reject) {
      setTimeout(function () {
        reject(new Error('Backend verification timeout (' + timeoutMs + 'ms)'));
      }, timeoutMs);
    });

    Promise.race([
      BirthdayAuth.verifyTokenWithBackend(firebaseUser),
      timeoutPromise
    ])
      .then(function (user) {
        if (user) {
          applyLoginSuccess(user);
        } else {
          applyLoginFromFirebaseUser(firebaseUser);
        }
      })
      .catch(function (err) {
        console.warn('[Auth] Backend verification failed, fallback to Firebase user:', err.message);
        applyLoginFromFirebaseUser(firebaseUser);
      });
  }

  /**
   * Khôi phục phiên làm việc khi tải trang.
   * Xử lý redirect result + onAuthStateChanged (cơ chế chính cho mobile).
   */
  async function checkAuthOnPageLoad() {
    // Kiểm tra nếu đã đăng nhập trong localStorage
    var currentStored = typeof getStoredUser === 'function' ? getStoredUser() : null;
    if (currentStored && currentStored.isLoggedIn) {
      if (window.AuthLogger) window.AuthLogger.info(`Phiên đăng nhập hiện có: ${currentStored.email}`);
      return; // Đã đăng nhập, không cần xử lý thêm
    }

    if (window.AuthLogger) {
      window.AuthLogger.info('Kiểm tra phiên đăng nhập từ Redirect / AuthState...');
    }

    // 1. Thử getRedirectResult (hoạt động tốt trên Desktop, thường trả null trên mobile)
    try {
      if (typeof BirthdayAuth !== 'undefined' && BirthdayAuth.completeRedirectIfAny) {
        var redirectedUser = await BirthdayAuth.completeRedirectIfAny();
        if (redirectedUser) {
          if (window.AuthLogger) window.AuthLogger.success(`Đăng nhập thành công từ redirect: ${redirectedUser.email}`);
          applyLoginSuccess(redirectedUser);
          return;
        }
      }
    } catch (err) {
      console.warn('[Auth] getRedirectResult failed:', err.message);
      if (window.AuthLogger) {
        window.AuthLogger.warn(`getRedirectResult warning: [${err?.code}] ${err?.message}`);
      }
      if (err?.code === 'auth/unauthorized-domain') {
        const friendlyMsg = (typeof BirthdayAuth !== 'undefined' && BirthdayAuth.formatAuthError)
          ? BirthdayAuth.formatAuthError(err)
          : err.message;
        setLoginError(friendlyMsg);
      }
    }

    // 2. Cơ chế chính (đặc biệt quan trọng cho mobile Redirect Flow):
    //    Lắng nghe onAuthStateChanged — Firebase tự khôi phục auth state từ IndexedDB
    //    sau khi signInWithRedirect hoàn tất và trang reload.
    if (typeof BirthdayAuth !== 'undefined' && BirthdayAuth.onAuthStateChanged) {
      BirthdayAuth.onAuthStateChanged(function (firebaseUser) {
        if (!firebaseUser) {
          if (window.AuthLogger) window.AuthLogger.info('onAuthStateChanged: chưa có tài khoản đăng nhập.');
          return;
        }

        // Kiểm tra lại — có thể applyLoginSuccess đã chạy từ bước 1
        var stored = typeof getStoredUser === 'function' ? getStoredUser() : null;
        if (stored && stored.isLoggedIn) return;

        console.log('[Auth] onAuthStateChanged: user detected, verifying with backend...');
        if (window.AuthLogger) window.AuthLogger.success(`onAuthStateChanged phát hiện tài khoản: ${firebaseUser.email}`);
        verifyWithFallback(firebaseUser, 10000);
      });
    }
  }

  /**
   * Đăng xuất Google + Firebase và dọn sạch session.
   */
  async function logout() {
    try {
      if (typeof BirthdayAuth !== 'undefined') {
        await BirthdayAuth.signOut();
      }
    } catch (e) {
      console.warn('Lỗi signOut Firebase:', e);
    }
    localStorage.removeItem('fl_google_user');
    localStorage.removeItem('user_uid');
    localStorage.removeItem('customerEmail');
    setLoginError('');
    if (typeof checkAuthState === 'function') {
      checkAuthState(true);
    }
    if (typeof showOrderToast === 'function') {
      showOrderToast('Đã đăng xuất tài khoản! 👋');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ══════════════════════════════════════
     ORDER HISTORY — FETCH + RENDER
     ══════════════════════════════════════ */

  /**
   * Mở dialog Lịch sử đơn hàng — gọi API lấy dữ liệu thật.
   */
  async function openOrderHistory() {
    const dlg = document.getElementById('orderHistoryDialog');
    if (dlg) {
      dlg.classList.add('open');
      document.body.style.overflow = 'hidden';
    }

    // Loading state
    const container = document.getElementById('orderHistoryContent');
    if (container) {
      container.innerHTML = `
        <div class="order-empty-state">
          <div class="order-empty-icon-wrap">
            <div class="order-empty-icon">
              <i class="fa-solid fa-circle-notch fa-spin"></i>
            </div>
          </div>
          <h3 class="order-empty-title">Đang tải đơn hàng…</h3>
        </div>
      `;
    }

    try {
      const idToken = await FirebaseHelper.getIdTokenSafe();
      if (!idToken) {
        setOrderHistory([]);
        showOrderToast('Vui lòng đăng nhập để xem lịch sử đơn hàng!');
        return;
      }

      const orders = await FallingLoveAPI.getMyOrders(idToken);
      setOrderHistory(orders);
    } catch (err) {
      console.error('Lỗi tải lịch sử đơn hàng:', err);
      setOrderHistory([]);
      showOrderToast('Không thể tải lịch sử đơn hàng!');
    }
  }

  /* ══════════════════════════════════════
     PAY GIFT — 3-STEP API FLOW
     ══════════════════════════════════════ */

  function generateOrderCode() {
    if (window.generateOrderCode && typeof window.generateOrderCode === 'function' && window.generateOrderCode !== generateOrderCode) {
      return window.generateOrderCode();
    }
    const firstDigit = Math.floor(1 + Math.random() * 9); // Số từ 1-9
    return (
      firstDigit.toString() +
      Date.now().toString().slice(-8) +
      Math.floor(100 + Math.random() * 900)
    );
  }

  /**
   * Luồng thanh toán chính:
   * 1) Validate → 2) Auth → 3) POST falling-loves → 4) POST products → 5) POST payments → 6) Mở dialog
   */
  async function payGift() {
    const btn = document.getElementById('btn-pay');
    if (btn && btn.classList.contains('loading')) return;

    // 1. Validate
    const missing = checkMandatoryFields();
    if (missing.length > 0) {
      openValidationDialog(missing, 'thanh toán');
      return;
    }

    // 2. Auth
    const storedUser = getStoredUser();
    if (!storedUser || !storedUser.isLoggedIn) {
      showOrderToast('Vui lòng đăng nhập trước khi thanh toán!');
      return;
    }

    // 3. Firebase idToken
    let idToken;
    try {
      idToken = await FirebaseHelper.getIdTokenSafe();
      if (!idToken) {
        showOrderToast('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại!');
        return;
      }
    } catch (e) {
      console.error('Lỗi lấy idToken:', e);
      showOrderToast('Lỗi xác thực. Vui lòng đăng nhập lại!');
      return;
    }

    // 4. Thu thập dữ liệu form
    const introTexts = introItems.map(s => s.trim()).filter(Boolean);
    const wishTexts = wishItems.map(s => s.trim()).filter(Boolean);
    const imageFiles = selectedImages.map(item => item.file);

    // Tính tổng tiền
    const extraIntro = Math.max(0, introItems.length - FREE_INTRO);
    const extraPhoto = Math.max(0, selectedImages.length - FREE_PHOTO);
    const extraWish = Math.max(0, wishItems.length - FREE_WISH);
    const totalPrice = BASE_PRICE
      + extraIntro * PRICE_INTRO
      + extraPhoto * PRICE_PHOTO
      + extraWish * PRICE_WISH
      + (isForever ? FOREVER_PRICE : 0);

    // JSON data theo schema
    const dataPayload = {
      title: 'Gửi Người Anh Yêu 💖',
      popupMessage: '💖 Gửi em — người con gái khiến mỗi ngày của anh trở nên đáng nhớ...',
      intro: introTexts,
      wishes: wishTexts,
      music: selectedMusicSrc || '',
      musicName: selectedMusicName || '',
      color: '#ff6b9d',
      fontName: 'Mali',
      keepForever: isForever,
      checkout: {
        paymentMethod: selectedMethod === 'domestic' ? 'domestic' : 'international',
        pricing: { total: totalPrice }
      },
      metadata: {
        source: 'falling-love',
        feVersion: '1.0.0'
      }
    };

    // Loading state
    const originalBtnHtml = btn ? btn.innerHTML : '';
    if (btn) {
      btn.classList.add('loading');
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Đang xử lý…';
    }

    try {
      // ═══ BƯỚC 1: Tạo FallingLove ═══
      if (btn) btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Đang tạo quà tặng…';

      const formData = new FormData();
      formData.append('data', JSON.stringify(dataPayload));
      imageFiles.forEach(file => { formData.append('images', file); });
      if (musicFileBlob) { formData.append('musicFile', musicFileBlob); }

      const fallingLoveResult = await FallingLoveAPI.createFallingLove(formData, idToken);
      const configId = fallingLoveResult.id;
      const shareUrl = fallingLoveResult.shareUrl || '';
      const serverTotal = fallingLoveResult.checkout?.pricing?.total || totalPrice;
      console.log('✅ Tạo FallingLove thành công — ID:', configId);

      // ═══ BƯỚC 2: Tạo Product ═══
      if (btn) btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Đang tạo đơn hàng…';

      const orderCode = generateOrderCode();
      await FallingLoveAPI.createProduct({
        uid: storedUser.uid || '',
        orderCode: orderCode,
        configId: configId,
        name: 'Falling Love Gift',
        type: 'falling-love',
        price: serverTotal,
        images: '',
        linkproduct: shareUrl || `${window.location.origin}/index.html?id=${configId}`,
        status: 'PENDING'
      }, idToken);
      console.log('✅ Tạo Product thành công — orderCode:', orderCode);

      // ═══ BƯỚC 3: Tạo Payment ═══
      if (btn) btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Đang tạo thanh toán…';

      const paymentMethod = selectedMethod === 'domestic' ? 'PAYOS' : 'POLAR';
      const checkoutUrl = await FallingLoveAPI.createPayment({
        orderCode: paymentMethod === 'PAYOS' ? Number(orderCode) : orderCode,
        amount: serverTotal,
        description: 'Falling Love Gift',
        uid: storedUser.uid || '',
        paymentMethod: paymentMethod,
        customerEmail: storedUser.email || ''
      }, idToken);
      console.log('✅ Tạo Payment thành công — checkoutUrl:', checkoutUrl);

      // Lưu trữ thông tin đơn hàng chờ thanh toán để Optimistic Rendering
      const pendingOrderData = {
        orderCode: String(orderCode),
        configId: configId,
        linkproduct: shareUrl || `${window.location.origin}/index.html?id=${configId}`,
        shareUrl: shareUrl || `${window.location.origin}/index.html?id=${configId}`,
        url: shareUrl || `${window.location.origin}/index.html?id=${configId}`,
        giftUrl: shareUrl || `${window.location.origin}/index.html?id=${configId}`,
        amount: serverTotal,
        title: 'Falling Love Gift',
        createdAt: new Date().toISOString()
      };

      // ═══ BƯỚC 4: Mở Dialog thanh toán & Kích hoạt Realtime Watcher ═══
      openPaymentDialog(checkoutUrl, orderCode, pendingOrderData);

    } catch (err) {
      console.error('❌ Lỗi thanh toán:', err);
      showOrderToast('Lỗi: ' + (err.message || 'Có lỗi xảy ra, vui lòng thử lại!'));
    } finally {
      if (btn) {
        btn.classList.remove('loading');
        btn.disabled = false;
        btn.innerHTML = originalBtnHtml;
      }
    }
  }

  /* ══════════════════════════════════════
     REALTIME TRACKING & SOCKET.IO / POLLING
     ══════════════════════════════════════ */

  let _socket = null;
  let _activeOrderCode = null;
  let _activePendingOrder = null;
  let _pollingTimer = null;
  let _isSuccessTriggered = false;

  /**
   * Khởi tạo kết nối Socket.io tới backend server.
   */
  function getSocket() {
    if (!window.io) return null;
    if (!_socket) {
      const apiBase = FirebaseHelper.getApiBase();
      try {
        _socket = window.io(apiBase, {
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000
        });

        _socket.on('connect', () => {
          console.log('⚡ [Socket.io] Đã kết nối server realtime:', _socket.id);
          if (_activeOrderCode) {
            joinOrderSocketRoom(_activeOrderCode);
          }
        });

        _socket.on('payment_status_update', (payload) => {
          console.log('⚡ [Socket.io] Nhận event payment_status_update:', payload);
          const status = String(payload?.status || payload?.paymentStatus || '').toUpperCase();
          const code = String(payload?.orderCode || '');
          if (status === 'PAID' || status === 'SUCCESS') {
            handlePaymentSuccess(code || _activeOrderCode);
          }
        });

        _socket.on('payment_success', (payload) => {
          console.log('⚡ [Socket.io] Nhận event payment_success:', payload);
          const code = String(payload?.orderCode || '');
          handlePaymentSuccess(code || _activeOrderCode);
        });
      } catch (err) {
        console.warn('⚠️ [Socket.io] Lỗi kết nối Socket.io:', err);
      }
    }
    return _socket;
  }

  function joinOrderSocketRoom(orderCode) {
    const socket = getSocket();
    if (!socket || !orderCode) return;
    const join = () => {
      socket.emit('join-order', orderCode);
      socket.emit('join', 'order-' + orderCode);
      console.log('⚡ [Socket.io] Joined room order:', orderCode);
    };
    if (socket.connected) join();
    else socket.once('connect', join);
  }

  function stopPaymentWatcher() {
    if (_pollingTimer) {
      clearInterval(_pollingTimer);
      _pollingTimer = null;
    }
  }

  /**
   * Kích hoạt cơ chế phát hiện thanh toán Realtime + Fallback Polling (Smart Polling).
   */
  function startPaymentWatcher(orderCode, orderData) {
    stopPaymentWatcher();
    _activeOrderCode = String(orderCode);
    _activePendingOrder = orderData;
    _isSuccessTriggered = false;

    // 1. Socket.io join room
    joinOrderSocketRoom(orderCode);

    // 2. Smart Polling Fallback (2.5 giây 1 lần)
    const pollInterval = 2500;
    const maxAttempts = 120; // 5 phút
    let attempts = 0;

    _pollingTimer = setInterval(async () => {
      attempts++;
      if (attempts > maxAttempts || _isSuccessTriggered) {
        stopPaymentWatcher();
        return;
      }

      try {
        const idToken = await FirebaseHelper.getIdTokenSafe();
        if (!idToken) return;

        // Kiểm tra danh sách đơn hàng của user
        const orders = await FallingLoveAPI.getMyOrders(idToken);
        if (Array.isArray(orders)) {
          const found = orders.find(o => String(o.orderCode || o.id) === String(orderCode));
          if (found) {
            const st = String(found.statusCode || found.status || '').toLowerCase();
            if (st === 'paid' || st === 'success') {
              console.log('🎉 [Polling] Đơn hàng đã thanh toán thành công:', found);
              handlePaymentSuccess(orderCode, found);
              return;
            }
          }
        }
      } catch (err) {
        console.warn('⚠️ [Polling] Kiểm tra trạng thái đơn thất bại:', err);
      }
    }, pollInterval);

    // 3. Iframe postMessage listener
    const onPostMessage = (e) => {
      try {
        const d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        if (d && (d.status === 'PAID' || d.type === 'payment_success' || d.status === 'SUCCESS')) {
          console.log('📩 [PostMessage] Nhận message thanh toán thành công:', d);
          handlePaymentSuccess(orderCode);
        }
      } catch (err) {}
    };
    window.addEventListener('message', onPostMessage, { once: true });
  }

  /**
   * XỬ LÝ THANH TOÁN THÀNH CÔNG:
   * 1. Đóng iframe thanh toán
   * 2. Thông báo thành công
   * 3. Dựng và hiển thị item sản phẩm vừa mua (Optimistic UI - 0ms delay)
   * 4. Mở Dialog thành công
   * 5. Đồng bộ ngầm với backend
   */
  async function handlePaymentSuccess(orderCode, serverOrder) {
    if (_isSuccessTriggered) return;
    _isSuccessTriggered = true;
    stopPaymentWatcher();

    console.log('🎉🎉🎉 [PaymentFlow] THANH TOÁN THÀNH CÔNG CHO ĐƠN:', orderCode);

    // 1. Đóng dialog thanh toán
    closePaymentDialog();

    // 2. Bật Toast chúc mừng
    showOrderToast('Thanh toán thành công! Món quà đã sẵn sàng 💕');

    // 3. Chuẩn bị dữ liệu order hoàn chỉnh
    const basePending = _activePendingOrder || {};
    const linkUrl = serverOrder?.giftUrl || serverOrder?.shareUrl || serverOrder?.linkproduct || basePending.linkproduct || `${window.location.origin}/index.html?id=${basePending.configId || ''}`;

    const paidOrder = {
      id: String(orderCode || basePending.orderCode || Date.now()),
      orderCode: String(orderCode || basePending.orderCode || ''),
      code: String(orderCode || basePending.orderCode || ''),
      title: serverOrder?.title || basePending.title || 'Falling Love Gift',
      summary: serverOrder?.summary || 'Falling Love Gift',
      createdAt: serverOrder?.createdAt || basePending.createdAt || new Date().toISOString(),
      createdAtRaw: serverOrder?.createdAtRaw || new Date().toISOString(),
      status: 'paid',
      statusCode: 'paid',
      statusText: 'Đã thanh toán',
      amount: serverOrder?.amount || basePending.amount || 0,
      total: serverOrder?.amount || basePending.amount || 0,
      giftUrl: linkUrl,
      shareUrl: linkUrl,
      linkproduct: linkUrl,
      url: linkUrl,
      configId: serverOrder?.configId || basePending.configId || '',
      giftId: serverOrder?.giftId || basePending.configId || '',
      paymentMethod: 'PAYOS'
    };

    // 4. Lưu vào OrderHistory state để các nút thao tác (Xem quà, Copy link, Tạo QR) hoạt động chuẩn xác
    if (window.OrderHistory && typeof window.OrderHistory.upsertOrder === 'function') {
      window.OrderHistory.upsertOrder(paidOrder);
    }

    // 5. Render thẻ item sản phẩm vào Dialog Thành Công
    renderPaySuccessCard(paidOrder);

    // 6. Mở Dialog Thành Công
    openPaySuccessDialog();

    // 7. Background Sync: Âm thầm fetch danh sách đơn mới nhất từ DB
    try {
      const idToken = await FirebaseHelper.getIdTokenSafe();
      if (idToken) {
        const freshOrders = await FallingLoveAPI.getMyOrders(idToken);
        if (window.OrderHistory && typeof window.OrderHistory.setOrders === 'function') {
          window.OrderHistory.setOrders(freshOrders);
        }
        const freshMatch = freshOrders.find(o => String(o.orderCode || o.id) === String(orderCode));
        if (freshMatch) {
          renderPaySuccessCard(freshMatch);
        }
      }
    } catch (e) {
      console.warn('Lỗi sync orders sau thanh toán:', e);
    }
  }

  /**
   * Render thẻ item sản phẩm vào #paySuccessList.
   */
  function renderPaySuccessCard(order) {
    const list = document.getElementById('paySuccessList');
    if (!list) return;

    list.innerHTML = '';
    let cardEl;
    if (window.OrderHistory && typeof window.OrderHistory.createOrderCardElement === 'function') {
      cardEl = window.OrderHistory.createOrderCardElement(order);
    } else {
      // Fallback
      cardEl = document.createElement('article');
      cardEl.className = 'order-card is-paid';
      cardEl.dataset.orderCode = order.orderCode;
      cardEl.innerHTML = `
        <div class="order-card-glow" aria-hidden="true"></div>
        <div class="order-card-top">
          <div class="order-card-code">
            <span class="order-card-code-label">Mã đơn</span>
            <span class="order-card-code-value">${order.orderCode}</span>
            <button type="button" class="order-card-copy-code" data-order-action="copy-code" title="Sao chép mã đơn">
              <i class="fa-regular fa-copy"></i>
            </button>
          </div>
          <span class="order-card-status is-paid">
            <i class="fa-solid fa-circle-check"></i>
            <span>Đã thanh toán</span>
          </span>
        </div>
        <div class="order-card-grid">
          <div class="order-card-field">
            <span class="order-card-field-label"><i class="fa-regular fa-calendar"></i> Ngày tạo</span>
            <span class="order-card-field-value">${new Date(order.createdAt).toLocaleString('vi-VN')}</span>
          </div>
          <div class="order-card-field is-price">
            <span class="order-card-field-label"><i class="fa-solid fa-coins"></i> Tổng tiền</span>
            <span class="order-card-field-value order-card-price">${new Intl.NumberFormat('vi-VN').format(order.amount)} đ</span>
          </div>
        </div>
        <div class="order-card-actions is-paid">
          <button type="button" class="order-card-btn order-card-btn-view" data-order-action="view">
            <i class="fa-regular fa-eye"></i> Xem quà
          </button>
          <button type="button" class="order-card-btn order-card-btn-copy" data-order-action="copy-link">
            <i class="fa-regular fa-copy"></i> Copy link
          </button>
          <button type="button" class="order-card-btn order-card-btn-qr" data-order-action="qr">
            <i class="fa-solid fa-qrcode"></i> Tạo QR
          </button>
        </div>
      `;
    }

    list.appendChild(cardEl);

    // Gắn event delegation cho thẻ vừa render
    list.onclick = function (e) {
      if (window.OrderHistory && typeof window.OrderHistory.handleOrderCardAction === 'function') {
        window.OrderHistory.handleOrderCardAction(e);
      }
    };
  }

  function openPaySuccessDialog() {
    const dlg = document.getElementById('paySuccessDialog');
    if (dlg) {
      dlg.classList.add('open');
      document.body.style.overflow = 'hidden';
    }
  }

  function closePaySuccessDialog(e) {
    if (e && e.target && !e.target.classList.contains('pay-success-overlay') && e.type === 'click') return;
    const dlg = document.getElementById('paySuccessDialog');
    if (dlg) {
      dlg.classList.remove('open');
      document.body.style.overflow = '';
    }
  }

  /* ══════════════════════════════════════
     PAYMENT CHECKOUT DIALOG
     ══════════════════════════════════════ */

  function openPaymentDialog(url, orderCode, orderData) {
    const dlg = document.getElementById('paymentCheckoutDialog');
    const iframe = document.getElementById('paymentIframe');
    const loading = document.getElementById('paymentIframeLoading');

    if (!dlg || !iframe) {
      window.open(url, '_blank');
      return;
    }

    try {
      localStorage.setItem('payment_in_progress', 'true');
      if (orderCode) localStorage.setItem('current_order_code', String(orderCode));
    } catch (_) {}

    if (loading) loading.classList.remove('hidden');
    iframe.src = 'about:blank';

    dlg.classList.add('open');
    document.body.style.overflow = 'hidden';

    iframe.src = url;
    iframe.onload = function () {
      if (loading) loading.classList.add('hidden');
    };

    setTimeout(() => {
      if (loading) loading.classList.add('hidden');
    }, 8000);

    showOrderToast('Đang mở cổng thanh toán… 💳');

    // Bắt đầu theo dõi trạng thái thanh toán Realtime + Smart Polling
    if (orderCode) {
      startPaymentWatcher(orderCode, orderData);
    }
  }

  function closePaymentDialog(e) {
    if (e && e.target && !e.target.classList.contains('payment-checkout-overlay') && e.type === 'click') return;
    const dlg = document.getElementById('paymentCheckoutDialog');
    const iframe = document.getElementById('paymentIframe');
    if (dlg) {
      dlg.classList.remove('open');
      document.body.style.overflow = '';
    }
    if (iframe) iframe.src = 'about:blank';
    try {
      localStorage.removeItem('payment_in_progress');
      localStorage.removeItem('current_order_code');
    } catch (_) {}
    stopPaymentWatcher();
  }

  /**
   * Mở dialog thanh toán cho đơn hàng theo orderCode (dùng cho order history).
   */
  async function openCheckoutByOrderCode(orderCode, showToast, fallbackCheckoutUrl = '') {
    const toast = typeof showToast === 'function' ? showToast : showOrderToast;
    const code = orderCode ? String(orderCode).trim() : '';
    if (!code) {
      toast('Không có mã đơn hợp lệ.');
      return false;
    }
    toast('Đang lấy link thanh toán… 💳');
    let url = '';
    try {
      const idToken = await FirebaseHelper.getIdTokenSafe();
      if (idToken) {
        const info = await FallingLoveAPI.getPaymentInfo(code, idToken);
        url = (info && info.checkoutUrl) || '';
      }
    } catch (e) {
      console.warn('[PaymentFlow] getPaymentInfo failed:', e);
    }
    if (!url && typeof fallbackCheckoutUrl === 'string' && fallbackCheckoutUrl.trim()) {
      url = fallbackCheckoutUrl.trim();
    }
    if (!url) {
      toast('Không lấy được link thanh toán cho đơn này.');
      return false;
    }
    openPaymentDialog(url, code, { orderCode: code });
    return true;
  }

  /**
   * Thanh toán lại đơn hàng pending — gọi API tạo payment mới rồi mở Dialog.
   * @param {string} orderCode - Mã đơn hàng
   * @param {number} amount - Số tiền
   */
  async function retryPayment(orderCode, amount) {
    showOrderToast('Đang tạo link thanh toán… 💳');

    try {
      const idToken = await FirebaseHelper.getIdTokenSafe();
      if (!idToken) {
        showOrderToast('Vui lòng đăng nhập để thanh toán!');
        return;
      }

      const storedUser = getStoredUser();
      const checkoutUrl = await FallingLoveAPI.createPayment({
        orderCode: Number(orderCode) || orderCode,
        amount: amount,
        description: 'Falling Love Gift',
        uid: storedUser?.uid || '',
        paymentMethod: 'PAYOS',
        customerEmail: storedUser?.email || ''
      }, idToken);

      console.log('✅ Tạo Payment lại thành công — checkoutUrl:', checkoutUrl);
      
      const pendingOrderData = {
        orderCode: String(orderCode),
        amount: amount,
        title: 'Falling Love Gift',
        createdAt: new Date().toISOString()
      };
      openPaymentDialog(checkoutUrl, orderCode, pendingOrderData);
    } catch (err) {
      console.error('❌ Lỗi tạo thanh toán:', err);
      showOrderToast('Lỗi: ' + (err.message || 'Không thể tạo link thanh toán!'));
    }
  }

  // Export ra global — cho onclick trong HTML và test console
  window.loginWithGoogle = loginWithGoogle;
  window.logout = logout;
  window.checkAuthOnPageLoad = checkAuthOnPageLoad;
  window.setLoginError = setLoginError;
  window.openOrderHistory = openOrderHistory;
  window.payGift = payGift;
  window.openPaymentDialog = openPaymentDialog;
  window.closePaymentDialog = closePaymentDialog;
  window.openCheckoutByOrderCode = openCheckoutByOrderCode;
  window.retryPayment = retryPayment;
  window.openPaySuccessDialog = openPaySuccessDialog;
  window.closePaySuccessDialog = closePaySuccessDialog;
  window.handlePaymentSuccess = handlePaymentSuccess;

  // Hàm test thủ công cho dev/kiểm thử
  window.testPaymentSuccess = function (orderCode) {
    const testCode = orderCode || 'TEST_' + String(Date.now()).slice(-6);
    handlePaymentSuccess(testCode, {
      orderCode: testCode,
      amount: 77000,
      title: 'Falling Love Gift (Demo)',
      linkproduct: window.location.origin + '/index.html',
      createdAt: new Date().toISOString()
    });
  };
})();
