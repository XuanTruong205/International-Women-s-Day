/**
 * Falling Love API Client
 * Các hàm gọi API thuần — không phụ thuộc DOM.
 * Phụ thuộc: FirebaseHelper (api/firebase-helper.js)
 */
(function () {
  'use strict';

  /**
   * POST /api/falling-loves — Tạo bản ghi FallingLove.
   * @param {FormData} formData - FormData chứa field `data` (JSON string), `images[]`, `musicFile`
   * @param {string} idToken - Firebase idToken
   * @returns {Promise<Object>} { id, shareUrl, checkout }
   */
  async function createFallingLove(formData, idToken) {
    const API_BASE = FirebaseHelper.getApiBase();

    // Debug log
    console.log('📤 [API] POST /api/falling-loves');

    const res = await fetch(`${API_BASE}/api/falling-loves`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${idToken}`
      },
      body: formData
    });

    const text = await res.text();
    console.log('📥 [API] falling-loves status:', res.status);
    console.log('📥 [API] falling-loves response:', text);

    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      throw new Error('Server response invalid: ' + text.substring(0, 300));
    }

    if (!res.ok || !data.success) {
      throw new Error(data.message || `Tạo bản ghi thất bại (${res.status})`);
    }

    return data.data;
  }

  /**
   * POST /api/products — Tạo bản ghi Product.
   * @param {Object} productBody - { uid, orderCode, configId, name, type, price, images, linkproduct, status }
   * @param {string} idToken - Firebase idToken
   * @returns {Promise<Object>}
   */
  async function createProduct(productBody, idToken) {
    const API_BASE = FirebaseHelper.getApiBase();

    console.log('📤 [API] POST /api/products', productBody);

    const res = await fetch(`${API_BASE}/api/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      },
      body: JSON.stringify(productBody)
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || `Tạo sản phẩm thất bại (${res.status})`);
    }

    return data.data;
  }

  /**
   * POST /api/payments/create — Tạo đơn thanh toán.
   * @param {Object} paymentBody - { orderCode, amount, description, uid, paymentMethod, customerEmail }
   * @param {string} idToken - Firebase idToken
   * @returns {Promise<string>} checkoutUrl
   */
  async function createPayment(paymentBody, idToken) {
    const API_BASE = FirebaseHelper.getApiBase();

    console.log('📤 [API] POST /api/payments/create', paymentBody);

    const res = await fetch(`${API_BASE}/api/payments/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      },
      body: JSON.stringify(paymentBody)
    });

    const data = await res.json();
    if (!res.ok || (data.code && data.code !== '00')) {
      throw new Error(data.desc || data.message || `Tạo thanh toán thất bại (${res.status})`);
    }

    const checkoutUrl = data.data?.checkoutUrl;
    if (!checkoutUrl) {
      throw new Error('Không nhận được link thanh toán từ server');
    }

    return checkoutUrl;
  }

  /**
   * GET /api/payments/:orderCode — Lấy thông tin payment đã tồn tại.
   * Dùng cho luồng thanh toán lại (retry).
   * @param {string} orderCode - Mã đơn hàng
   * @param {string} idToken - Firebase idToken
   * @returns {Promise<Object>} { checkoutUrl, status, ... }
   */
  async function getPaymentInfo(orderCode, idToken) {
    const API_BASE = FirebaseHelper.getApiBase();

    console.log('📤 [API] GET /api/payments/' + orderCode);

    const res = await fetch(`${API_BASE}/api/payments/${orderCode}`, {
      headers: { 'Authorization': `Bearer ${idToken}` }
    });

    const data = await res.json();
    console.log('📥 [API] payment info response:', data);

    if (!res.ok || !data.success) {
      throw new Error(data.message || `Lấy thông tin thanh toán thất bại (${res.status})`);
    }

    return data.data || data;
  }

  /**
   * GET /api/falling-loves/orders/me — Lấy danh sách đơn hàng của user.
   * Backend trả về tất cả trạng thái: paid, pending, free.
   * Trả raw data để module order-history.js tự normalize.
   * @param {string} idToken - Firebase idToken
   * @returns {Promise<Array>} orders
   */
  async function getMyOrders(idToken) {
    const API_BASE = FirebaseHelper.getApiBase();

    const res = await fetch(`${API_BASE}/api/falling-loves/orders/me`, {
      headers: { 'Authorization': `Bearer ${idToken}` }
    });

    const data = await res.json();
    console.log('📥 [API] orders/me response:', data);

    if (data.success && data.data && data.data.orders) {
      return data.data.orders.map(o => ({
        id: o.id || o.giftId || '',
        orderCode: o.orderCode || o.id || '',
        code: o.id || '',
        createdAt: o.createdAt || null,
        createdAtRaw: o.createdAt || null,
        status: o.status || 'pending',
        statusCode: o.statusCode || o.status || 'pending',
        statusText: o.status || '',
        title: o.title || 'Falling Love Gift',
        summary: o.title || 'Falling Love Gift',
        amount: o.amount || 0,
        total: o.amount || 0,
        giftUrl: o.giftUrl || '',
        shareUrl: o.shareUrl || '',
        linkproduct: o.linkproduct || '',
        url: o.giftUrl || o.shareUrl || o.linkproduct || '',
        giftId: o.giftId || '',
        configId: o.configId || '',
        checkoutUrl: o.checkoutUrl || '',
        paymentMethod: o.paymentMethod || 'PAYOS'
      }));
    }

    return [];
  }

  // Export ra global
  window.FallingLoveAPI = {
    createFallingLove,
    createProduct,
    createPayment,
    getPaymentInfo,
    getMyOrders
  };
})();
