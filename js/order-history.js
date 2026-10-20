/**
 * Order History Module
 * Quản lý danh sách đơn hàng, render order card, event delegation.
 * Theo tài liệu: lich-su-don-hang.md
 *
 * Phụ thuộc: FirebaseHelper, FallingLoveAPI, BirthdayAuth
 * DOM: orderHistoryContent, orderCountBadge, showOrderToast, openPaymentDialog
 */
(function () {
  'use strict';

  /* ══════════════════════════════════════
     STATE MANAGEMENT
     ══════════════════════════════════════ */

  const state = {
    orders: [],              // Danh sách đơn hàng đã fetch
    pendingOrderCode: '',    // Mã đơn đang chờ thanh toán
    pendingOrder: null,      // Object đơn đang chờ (khi tạo mới)
  };

  /* ══════════════════════════════════════
     UTILITY FUNCTIONS
     ══════════════════════════════════════ */

  /**
   * Chuẩn hoá trạng thái đơn hàng.
   * @param {string} status
   * @returns {'paid'|'pending'|string}
   */
  function normalizeOrderStatus(status) {
    const raw = String(status || '').trim();
    if (!raw) return 'pending';

    const upper = raw.toUpperCase();
    if (['PAID', 'SUCCESS', 'PAID_SUCCESS', 'FREE', 'COMPLETED'].includes(upper)) {
      return 'paid';
    }
    if (['PENDING', 'WAIT', 'WAITING'].includes(upper)) {
      return 'pending';
    }

    const lower = raw.toLowerCase();
    if (lower === 'paid' || lower === 'đã thanh toán') return 'paid';
    if (lower === 'pending' || lower === 'chờ thanh toán') return 'pending';

    return lower;
  }

  /**
   * Lấy mã đơn hàng — chỉ giữ số.
   * @param {Object} order
   * @returns {string}
   */
  function getOrderCode(order) {
    return String(
      (order && (order.orderCode || order.code || order.id)) || ''
    ).replace(/\D/g, '');
  }

  /**
   * Hiển thị mã đơn — cắt 12 số cuối nếu quá dài.
   * @param {Object} order
   * @returns {string}
   */
  function displayOrderCode(order) {
    const code = getOrderCode(order);
    if (!code) return '—';
    return code.length > 12 ? code.slice(-12) : code;
  }

  /**
   * Lấy tổng tiền đơn hàng.
   * @param {Object} order
   * @returns {number}
   */
  function getOrderAmount(order) {
    const amount = Number(
      (order &&
        (order.amount ||
          order.total ||
          (order.checkout && order.checkout.pricing && order.checkout.pricing.total))) ||
        0
    );
    return amount > 0 ? amount : 0;
  }

  /**
   * Format ngày theo locale vi-VN.
   * @param {string|Date} value
   * @returns {string}
   */
  function formatOrderDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (isNaN(date.getTime())) return String(value);
    return date.toLocaleString('vi-VN');
  }

  /**
   * Format tiền VND.
   * @param {number} amount
   * @returns {string}
   */
  function formatVnd(amount) {
    if (amount === 0) return 'Miễn phí';
    return new Intl.NumberFormat('vi-VN').format(amount) + ' đ';
  }

  /**
   * Lấy gift URL từ order với fallback chain.
   * @param {Object} order
   * @returns {string}
   */
  function getOrderGiftUrl(order) {
    const fromOrder = (order && (
      order.giftUrl || order.shareUrl || order.linkproduct || order.publicUrl || order.url
    )) || '';

    if (String(fromOrder).trim()) return String(fromOrder).trim();

    // Fallback: tự ghép từ giftId / configId
    const giftId = (order && (order.giftId || order.configId)) || '';
    return giftId ? location.origin + '/index.html?id=' + giftId : '';
  }

  /**
   * Copy text vào clipboard (có fallback cho trình duyệt cũ).
   * @param {string} text
   * @returns {Promise<boolean>}
   */
  async function copyTextToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      // Fallback cho trình duyệt cũ
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(textarea);
      return ok;
    }
  }

  /**
   * Ánh xạ payment method từ order sang API.
   * @param {Object} order
   * @returns {'PAYOS'|'POLAR'}
   */
  function resolvePaymentMethod(order) {
    const pm = String((order && order.paymentMethod) || '').toUpperCase();
    if (pm === 'POLAR' || pm === 'INTERNATIONAL') return 'POLAR';
    return 'PAYOS';
  }

  /* ══════════════════════════════════════
     STATE HELPERS
     ══════════════════════════════════════ */

  /**
   * Upsert — cập nhật hoặc thêm mới đơn hàng vào state.
   * @param {Object} order
   */
  function upsertOrder(order) {
    const code = getOrderCode(order);
    if (!code) return;
    const index = state.orders.findIndex(function (item) {
      return getOrderCode(item) === code;
    });
    if (index >= 0) {
      state.orders[index] = Object.assign({}, state.orders[index], order);
    } else {
      state.orders.unshift(order); // Thêm mới lên đầu
    }
  }

  /**
   * Tìm đơn hàng theo mã.
   * @param {string} code
   * @returns {Object|null}
   */
  function findOrderByCode(code) {
    var key = String(code || '');
    if (!key) return null;
    var fromList = state.orders.find(function (order) {
      return getOrderCode(order) === key;
    });
    if (fromList) return fromList;
    // Fallback: kiểm tra đơn đang pending
    if (state.pendingOrder && getOrderCode(state.pendingOrder) === key) {
      return state.pendingOrder;
    }
    return null;
  }

  /* ══════════════════════════════════════
     RENDER ORDER CARD
     ══════════════════════════════════════ */

  /**
   * Tạo DOM element cho 1 order card theo spec.
   * @param {Object} order
   * @returns {HTMLElement}
   */
  function createOrderCardElement(order) {
    const statusCode = normalizeOrderStatus(order.statusCode || order.status);
    const isPaid = statusCode === 'paid';
    const isPending = statusCode === 'pending';
    const code = getOrderCode(order);
    const displayCode = displayOrderCode(order);
    const amount = getOrderAmount(order);
    const dateStr = formatOrderDate(order.createdAt || order.createdAtRaw);
    const priceStr = formatVnd(amount);

    // Status badge config
    let statusIcon, statusText, statusClass;
    if (isPaid) {
      statusIcon = 'fa-solid fa-circle-check';
      statusText = 'Đã thanh toán';
      statusClass = 'is-paid';
    } else if (isPending) {
      statusIcon = 'fa-solid fa-clock';
      statusText = 'Chờ thanh toán';
      statusClass = 'is-pending';
    } else {
      statusIcon = 'fa-solid fa-circle-info';
      statusText = order.statusText || order.status || statusCode;
      statusClass = '';
    }

    // Create card article
    const card = document.createElement('article');
    card.className = 'order-card' + (statusClass ? ' ' + statusClass : '');
    card.setAttribute('data-order-code', code);

    // ── Glow effect ──
    const glow = document.createElement('div');
    glow.className = 'order-card-glow';
    glow.setAttribute('aria-hidden', 'true');
    card.appendChild(glow);

    // ── Header: Mã đơn + Badge trạng thái ──
    const top = document.createElement('div');
    top.className = 'order-card-top';

    // Code section
    const codeWrap = document.createElement('div');
    codeWrap.className = 'order-card-code';

    const codeLabel = document.createElement('span');
    codeLabel.className = 'order-card-code-label';
    codeLabel.textContent = 'Mã đơn';

    const codeValue = document.createElement('span');
    codeValue.className = 'order-card-code-value';
    codeValue.textContent = displayCode;

    const copyCodeBtn = document.createElement('button');
    copyCodeBtn.type = 'button';
    copyCodeBtn.className = 'order-card-copy-code';
    copyCodeBtn.setAttribute('data-order-action', 'copy-code');
    copyCodeBtn.setAttribute('aria-label', 'Sao chép mã đơn');
    copyCodeBtn.title = 'Sao chép mã đơn';
    copyCodeBtn.innerHTML = '<i class="fa-regular fa-copy" aria-hidden="true"></i>';

    codeWrap.appendChild(codeLabel);
    codeWrap.appendChild(codeValue);
    codeWrap.appendChild(copyCodeBtn);

    // Status badge
    const badge = document.createElement('span');
    badge.className = 'order-card-status' + (statusClass ? ' ' + statusClass : '');
    badge.innerHTML = '<i class="' + statusIcon + '" aria-hidden="true"></i><span>' + statusText + '</span>';

    top.appendChild(codeWrap);
    top.appendChild(badge);
    card.appendChild(top);

    // ── Grid thông tin: Ngày tạo + Tổng tiền ──
    const grid = document.createElement('div');
    grid.className = 'order-card-grid';

    // Ngày tạo
    const dateField = document.createElement('div');
    dateField.className = 'order-card-field';
    dateField.innerHTML =
      '<span class="order-card-field-label"><i class="fa-regular fa-calendar" aria-hidden="true"></i> Ngày tạo</span>' +
      '<span class="order-card-field-value order-card-date">' + (dateStr || '—') + '</span>';

    // Tổng tiền
    const priceField = document.createElement('div');
    priceField.className = 'order-card-field is-price';
    priceField.innerHTML =
      '<span class="order-card-field-label"><i class="fa-solid fa-coins" aria-hidden="true"></i> Tổng tiền</span>' +
      '<span class="order-card-field-value order-card-price">' + priceStr + '</span>';

    grid.appendChild(dateField);
    grid.appendChild(priceField);
    card.appendChild(grid);

    // ── Action buttons (thay đổi theo trạng thái) ──
    const actions = document.createElement('div');
    actions.className = 'order-card-actions' + (isPaid ? ' is-paid' : '');

    if (isPending) {
      // Chờ thanh toán → 1 button "Thanh toán ngay"
      const payBtn = document.createElement('button');
      payBtn.type = 'button';
      payBtn.className = 'order-card-btn order-card-btn-pay';
      payBtn.setAttribute('data-order-action', 'pay');
      payBtn.innerHTML = '<i class="fa-solid fa-credit-card"></i> Thanh toán ngay';
      actions.appendChild(payBtn);
    } else if (isPaid) {
      // Đã thanh toán → 3 buttons
      const viewBtn = document.createElement('button');
      viewBtn.type = 'button';
      viewBtn.className = 'order-card-btn order-card-btn-view';
      viewBtn.setAttribute('data-order-action', 'view');
      viewBtn.innerHTML = '<i class="fa-regular fa-eye"></i> Xem quà';

      const copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className = 'order-card-btn order-card-btn-copy';
      copyBtn.setAttribute('data-order-action', 'copy-link');
      copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i> Copy link';

      const qrBtn = document.createElement('button');
      qrBtn.type = 'button';
      qrBtn.className = 'order-card-btn order-card-btn-qr';
      qrBtn.setAttribute('data-order-action', 'qr');
      qrBtn.innerHTML = '<i class="fa-solid fa-qrcode"></i> Tạo QR';

      actions.appendChild(viewBtn);
      actions.appendChild(copyBtn);
      actions.appendChild(qrBtn);
    }

    card.appendChild(actions);

    return card;
  }

  /* ══════════════════════════════════════
     RENDER ORDER HISTORY
     ══════════════════════════════════════ */

  /**
   * Render toàn bộ danh sách lịch sử đơn hàng.
   */
  function renderOrderHistory() {
    var container = document.getElementById('orderHistoryContent');
    var countBadge = document.getElementById('orderCountBadge');
    if (!container) return;

    var list = Array.isArray(state.orders) ? state.orders : [];

    // Lọc bỏ đơn pending quá 1 tiếng (link thanh toán đã hết hạn)
    var ONE_HOUR_MS = 60 * 60 * 1000;
    var now = Date.now();
    var filteredList = list.filter(function (order) {
      var statusCode = normalizeOrderStatus(order.statusCode || order.status);
      if (statusCode === 'pending') {
        var rawDate = order.createdAtRaw || order.createdAt;
        if (rawDate) {
          var createdTime = new Date(rawDate).getTime();
          if (!isNaN(createdTime) && (now - createdTime > ONE_HOUR_MS)) return false;
        }
      }
      return true;
    });

    if (!filteredList.length) {
      // Empty state
      if (countBadge) countBadge.textContent = '0 đơn hàng';
      container.innerHTML =
        '<div class="order-empty-state">' +
          '<div class="order-empty-icon-wrap">' +
            '<div class="order-empty-icon-glow"></div>' +
            '<div class="order-empty-icon">' +
              '<i class="fa-solid fa-box-open"></i>' +
            '</div>' +
            '<span class="empty-sparkle sp1">✨</span>' +
            '<span class="empty-sparkle sp2">💖</span>' +
            '<span class="empty-sparkle sp3">🌸</span>' +
          '</div>' +
          '<h3 class="order-empty-title">Chưa có đơn hàng nào được tạo</h3>' +
        '</div>';
      return;
    }

    // Hiện danh sách
    if (countBadge) countBadge.textContent = filteredList.length + ' đơn hàng';

    // Xóa nội dung cũ
    container.innerHTML = '';

    var listWrap = document.createElement('div');
    listWrap.className = 'order-list';
    listWrap.id = 'orderHistoryList';

    filteredList.forEach(function (order) {
      listWrap.appendChild(createOrderCardElement(order));
    });

    container.appendChild(listWrap);

    // Bind event delegation
    listWrap.addEventListener('click', handleOrderCardAction);
  }

  /* ══════════════════════════════════════
     EVENT DELEGATION
     ══════════════════════════════════════ */

  /**
   * Xử lý tất cả button actions trong order card.
   * @param {Event} event
   */
  async function handleOrderCardAction(event) {
    var btn = event.target.closest('[data-order-action]');
    if (!btn) return;

    event.preventDefault();
    event.stopPropagation();

    var card = btn.closest('.order-card');
    var order = findOrderByCode(card && card.dataset.orderCode);
    if (!order) return;

    var action = btn.getAttribute('data-order-action');

    switch (action) {
      case 'copy-code': {
        var codeVal = getOrderCode(order);
        var codeOk = await copyTextToClipboard(codeVal);
        showOrderToast(codeOk ? 'Đã sao chép mã đơn.' : 'Không sao chép được mã đơn.');
        // Visual feedback trên button
        if (codeOk) {
          var oldIcon = btn.innerHTML;
          btn.innerHTML = '<i class="fa-solid fa-check" style="color:#059669;" aria-hidden="true"></i>';
          setTimeout(function () { btn.innerHTML = oldIcon; }, 1600);
        }
        break;
      }

      case 'copy-link': {
        var url = getOrderGiftUrl(order);
        if (!url) { showOrderToast('Không tìm thấy link quà.'); break; }
        var linkOk = await copyTextToClipboard(url);
        showOrderToast(linkOk ? 'Đã sao chép link quà.' : 'Không sao chép được link.');
        // Visual feedback
        if (linkOk) {
          var oldBtnHtml = btn.innerHTML;
          btn.innerHTML = '<i class="fa-solid fa-check"></i> Đã chép';
          setTimeout(function () { btn.innerHTML = oldBtnHtml; }, 1600);
        }
        break;
      }

      case 'view': {
        var viewUrl = getOrderGiftUrl(order);
        if (!viewUrl) { showOrderToast('Không tìm thấy link quà.'); break; }
        window.open(viewUrl, '_blank');
        break;
      }

      case 'qr': {
        var qrUrl = getOrderGiftUrl(order);
        if (!qrUrl) { showOrderToast('Không tìm thấy link quà để tạo QR.'); break; }
        redirectToQr(qrUrl);
        break;
      }

      case 'pay': {
        btn.disabled = true;
        try {
          await resumeOrderPayment(order);
        } finally {
          btn.disabled = false;
        }
        break;
      }
    }
  }

  /**
   * Mở trang tạo QR code cho link quà tặng.
   * @param {string} link
   */
  function redirectToQr(link) {
    if (!link) return;
    var qrPageUrl = 'https://dlove.vn/createqr.html?link=' + encodeURIComponent(link);
    window.open(qrPageUrl, '_blank');
  }

  /* ══════════════════════════════════════
     RESUME ORDER PAYMENT (PAY ACTION)
     ══════════════════════════════════════ */

  /**
   * Thanh toán lại đơn hàng pending.
   * Luồng: checkoutUrl có sẵn → GET payment → POST payment/create → mở dialog.
   * @param {Object} order
   */
  async function resumeOrderPayment(order) {
    // 1. Kiểm tra đăng nhập
    var storedUser;
    try {
      storedUser = window.getStoredUser && window.getStoredUser();
    } catch (e) {
      storedUser = null;
    }
    if (!storedUser || !storedUser.uid) {
      showOrderToast('Hãy đăng nhập lại để thanh toán.');
      return;
    }

    // 2. Kiểm tra mã đơn
    var orderCode = getOrderCode(order);
    if (!orderCode) {
      showOrderToast('Không tìm thấy mã đơn.');
      return;
    }

    showOrderToast('Đang lấy link thanh toán…');

    var checkoutUrl = '';

    try {
      // 3. Thử lấy checkoutUrl từ order object trước
      checkoutUrl = order.checkoutUrl || '';

      // 4. Nếu chưa có → gọi GET /api/payments/{orderCode}
      if (!checkoutUrl) {
        try {
          var idToken = await FirebaseHelper.getIdTokenSafe();
          if (idToken) {
            var paymentInfo = await FallingLoveAPI.getPaymentInfo(orderCode, idToken);
            checkoutUrl = (paymentInfo && paymentInfo.checkoutUrl) || '';
          }
        } catch (e) {
          console.warn('[OrderHistory] GET payment info failed:', e);
        }
      }

      // 5. Nếu vẫn chưa có → gọi POST /api/payments/create
      if (!checkoutUrl) {
        var idToken2 = await FirebaseHelper.getIdTokenSafe();
        if (!idToken2) {
          showOrderToast('Phiên đăng nhập hết hạn.');
          return;
        }

        var paymentMethod = resolvePaymentMethod(order);
        var amount = getOrderAmount(order);

        checkoutUrl = await FallingLoveAPI.createPayment({
          orderCode: paymentMethod === 'PAYOS' ? Number(orderCode) : orderCode,
          uid: storedUser.uid || '',
          amount: amount,
          description: 'Falling Love',
          paymentMethod: paymentMethod,
          customerEmail: storedUser.email || '',
        }, idToken2);
      }

      // 6. Mở dialog thanh toán
      if (checkoutUrl) {
        if (typeof window.openPaymentDialog === 'function') {
          window.openPaymentDialog(checkoutUrl, orderCode, order);
        } else {
          window.open(checkoutUrl, '_blank');
        }
      } else {
        showOrderToast('Không nhận được QR thanh toán.');
      }

    } catch (err) {
      console.error('[OrderHistory] Lỗi thanh toán lại:', err);
      showOrderToast('Không mở được thanh toán: ' + (err.message || ''));
    }
  }

  /* ══════════════════════════════════════
     TOAST HELPER (delegate to global)
     ══════════════════════════════════════ */

  function showOrderToast(msg) {
    if (typeof window.showOrderToast === 'function') {
      window.showOrderToast(msg);
    } else {
      console.log('[OrderHistory Toast]', msg);
    }
  }

  /* ══════════════════════════════════════
     PUBLIC API
     ══════════════════════════════════════ */

  /**
   * Cập nhật dữ liệu đơn hàng từ bên ngoài.
   * @param {Array} orders
   */
  function setOrders(orders) {
    state.orders = Array.isArray(orders) ? orders : [];
    var countBadge = document.getElementById('orderCountBadge');
    if (countBadge) {
      countBadge.textContent = state.orders.length + ' đơn hàng';
    }
    if (document.getElementById('orderHistoryDialog') &&
        document.getElementById('orderHistoryDialog').classList.contains('open')) {
      renderOrderHistory();
    }
  }

  /**
   * Lấy danh sách orders hiện tại.
   * @returns {Array}
   */
  function getOrders() {
    return state.orders;
  }

  // Export ra global
  window.OrderHistory = {
    // State
    state: state,
    setOrders: setOrders,
    getOrders: getOrders,
    upsertOrder: upsertOrder,
    findOrderByCode: findOrderByCode,

    // Render
    renderOrderHistory: renderOrderHistory,
    createOrderCardElement: createOrderCardElement,

    // Utilities
    normalizeOrderStatus: normalizeOrderStatus,
    getOrderCode: getOrderCode,
    displayOrderCode: displayOrderCode,
    getOrderAmount: getOrderAmount,
    formatOrderDate: formatOrderDate,
    formatVnd: formatVnd,
    getOrderGiftUrl: getOrderGiftUrl,
    copyTextToClipboard: copyTextToClipboard,

    // Actions
    handleOrderCardAction: handleOrderCardAction,
    resumeOrderPayment: resumeOrderPayment,
    redirectToQr: redirectToQr,
  };
})();
