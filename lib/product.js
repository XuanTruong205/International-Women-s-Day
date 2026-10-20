// service/product.js - Product Management
import { API_PRODUCT_URL } from "./config.js";

/**
 * Tạo orderCode theo thuật toán
 * @returns {string} - Order code
 */
export function generateOrderCode() {
  const firstDigit = Math.floor(1 + Math.random() * 9); // Số từ 1-9
  const orderCode =
    firstDigit.toString() +
    Date.now().toString().slice(-8) +
    Math.floor(100 + Math.random() * 900);
  return orderCode;
}

/**
 * Tạo sản phẩm
 * @param {string} shareUrl - Link web
 * @param {string} imageUrl - Link ảnh sản phẩm
 * @param {number} totalPrice - Giá sản phẩm
 * @param {string} orderCode - Mã đơn hàng
 * @param {string} configId - ID
 * @returns {Promise<string>} - Kết quả tạo sản phẩm
 */
export async function createProduct(
  shareUrl,
  imageUrl,
  totalPrice,
  orderCode,
  configId,
  introText,
) {
  const name =
    introText && String(introText).trim()
      ? String(introText).trim()
      : "Falling Love Gift";
  const type = "falling-love";
  const uid = localStorage.getItem("user_uid");
  const images = imageUrl;

  const productData = {
    uid,
    orderCode,
    name,
    type,
    price: totalPrice,
    images,
    linkproduct: shareUrl,
    configId,
  };
  try {
    const response = await fetch(`${API_PRODUCT_URL}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(productData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Server error response:", errorText);
      return {
        success: false,
        message: `Lỗi server ${response.status}: ${errorText}`,
      };
    }

    const data = await response.json();
    if (data.success) {
      return { success: true, message: "Đã lưu sản phẩm lên hệ thống!" };
    } else {
      return {
        success: false,
        message:
          "Lưu sản phẩm thất bại: " + (data.message || "Lỗi không xác định"),
      };
    }
  } catch (err) {
    console.error("[Product] Lỗi kết nối:", err);
    return { success: false, message: "Lỗi kết nối server: " + err.message };
  }
}

/**
 * Danh sách Product theo user — GET /api/products/user/:uid (BACKEND_RECORD_SCHEMA mục 6.6)
 * @param {string} uid
 * @param {{ page?: number, limit?: number, status?: string, sortBy?: string, sortOrder?: string }} [options]
 * @returns {Promise<{ success: boolean, data: object[], pagination?: object|null, message?: string }>}
 */
export async function fetchProductsByUser(uid, options = {}) {
  const { page = 1, limit = 100, status, sortBy, sortOrder } = options;
  if (!uid || !String(uid).trim()) {
    return {
      success: false,
      message: "Thiếu uid",
      data: [],
      pagination: null,
    };
  }
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (status != null && status !== "") params.set("status", String(status));
  if (sortBy) params.set("sortBy", sortBy);
  if (sortOrder) params.set("sortOrder", sortOrder);
  const url = `${API_PRODUCT_URL}/user/${encodeURIComponent(uid)}?${params}`;
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        success: false,
        message:
          json.message ||
          json.error ||
          `HTTP ${response.status}`,
        data: [],
        pagination: null,
      };
    }
    if (json.success === false) {
      return {
        success: false,
        message: json.message || "Lỗi lấy danh sách sản phẩm",
        data: [],
        pagination: json.pagination || null,
      };
    }
    const raw = json.data;
    const data = Array.isArray(raw) ? raw : [];
    return {
      success: true,
      data,
      pagination: json.pagination || null,
    };
  } catch (err) {
    console.error("[Product] fetchProductsByUser:", err);
    return {
      success: false,
      message: err?.message || "Lỗi kết nối",
      data: [],
      pagination: null,
    };
  }
}

// Export ra window cho non-module scripts
if (typeof window !== "undefined") {
  window.generateOrderCode = generateOrderCode;
  window.createProduct = createProduct;
  window.fetchProductsByUser = fetchProductsByUser;
  window.ProductAPI = {
    generateOrderCode,
    createProduct,
    fetchProductsByUser,
  };
}

