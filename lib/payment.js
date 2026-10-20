// js/payment.js - Logic xử lý thanh toán
import { API_PAYMENT_URL, SERVER_URL_PROD } from "./config.js";

// Constants
const SOCKET_CONFIG = {
  TIMEOUT: 20000,
  RECONNECTION_ATTEMPTS: 5,
  RECONNECTION_DELAY: 1000,
  PAYMENT_TIMEOUT: 900000, // 15 phút — chờ kết quả thanh toán
};

/**
 * Socket Manager Class - Quản lý WebSocket connection
 */
class SocketManager {
  constructor() {
    this.socket = null;
    this.currentOrder = null;
    this.eventHandlers = new Map();
    this.isConnected = false;
  }

  /**
   * Khởi tạo WebSocket connection
   */
  init() {
    try {
      if (typeof window === "undefined" || !window.io) {
        console.error(
          "[Thanh toán] Socket.IO chưa được load. Kiểm tra script socket.io trong HTML.",
        );
        return null;
      }
      this.socket = window.io(`${SERVER_URL_PROD}`, {
        transports: ["websocket", "polling"],
        timeout: SOCKET_CONFIG.TIMEOUT,
        reconnection: true,
        reconnectionDelay: SOCKET_CONFIG.RECONNECTION_DELAY,
        reconnectionAttempts: SOCKET_CONFIG.RECONNECTION_ATTEMPTS,
      });

      this._setupEventListeners();
      return this.socket;
    } catch (error) {
      console.error("Lỗi khởi tạo WebSocket:", error);
      return null;
    }
  }

  /**
   * Thiết lập event listeners
   */
  _setupEventListeners() {
    if (!this.socket) return;

    this.socket.on("connect", () => {
      this.isConnected = true;
      this._handleReconnection();
    });

    this.socket.on("disconnect", () => {
      this.isConnected = false;
    });

    this.socket.on("connect_error", (error) => {
      this.isConnected = false;
    });
  }

  /**
   * Xử lý kết nối lại khi reconnect
   */
  _handleReconnection() {
    const currentOrderCode = localStorage.getItem("current_order_code");
    const isPaymentInProgress =
      localStorage.getItem("payment_in_progress") === "true";

    if (currentOrderCode && isPaymentInProgress) {
      this.joinOrder(currentOrderCode);
    }
  }
  /**
   * Join vào room theo dõi order
   */
  joinOrder(orderCode) {
    if (!this.socket || !this.isConnected) {
      console.error("❌ Socket chưa kết nối");
      return false;
    }

    // Leave room cũ nếu có
    if (this.currentOrder && this.currentOrder !== orderCode) {
      this.leaveOrder(this.currentOrder);
    } else if (this.currentOrder === orderCode) {
      return true;
    }

    this.socket.emit("join-order", orderCode);
    this.currentOrder = orderCode;
    return true;
  }

  /**
   * Leave khỏi room
   */
  leaveOrder(orderCode) {
    if (!this.socket || !this.isConnected) return;

    this.socket.emit("leave-order", orderCode);
    if (this.currentOrder === orderCode) {
      this.currentOrder = null;
    }
  }

  /**
   * Đăng ký event handler với cleanup
   */
  on(event, handler) {
    if (!this.socket) return;

    // Lưu handler để có thể remove sau
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event).push(handler);

    this.socket.on(event, handler);
  }

  /**
   * Remove event handler
   */
  off(event, handler) {
    if (!this.socket) return;

    this.socket.off(event, handler);

    if (this.eventHandlers.has(event)) {
      const handlers = this.eventHandlers.get(event);
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Cleanup tất cả event handlers
   */
  cleanup() {
    if (!this.socket) return;

    // Remove tất cả event handlers
    for (const [event, handlers] of this.eventHandlers) {
      handlers.forEach((handler) => {
        this.socket.off(event, handler);
      });
    }
    this.eventHandlers.clear();

    // Leave current order
    if (this.currentOrder) {
      this.leaveOrder(this.currentOrder);
    }

    this.socket.disconnect();
    this.socket = null;
    this.currentOrder = null;
    this.isConnected = false;
  }

  /**
   * Kiểm tra trạng thái kết nối
   */
  isSocketConnected() {
    return this.socket && this.isConnected;
  }
}

// Tạo instance global
const socketManager = new SocketManager();

// Export socketManager để sử dụng ở nơi khác
export { socketManager };

/**
 * Khởi tạo WebSocket connection
 */
export function initWebSocket() {
  const socket = socketManager.init();

  // Lưu reference cho backward compatibility
  window.socket = socketManager.socket;

  return socket;
}

export function getPaymentModalElement() {
  return (
    document.getElementById("paymentCheckoutDialog") ||
    document.getElementById("paymentModal")
  );
}

export function showPaymentModal(checkoutUrl) {
  const modal = getPaymentModalElement();
  const iframe = document.getElementById("paymentIframe");
  if (!modal || !iframe) return false;

  suspendTopLayerDialogs();
  if (checkoutUrl) iframe.src = checkoutUrl;

  if (modal.classList.contains("dialog-overlay")) {
    modal.classList.add("open");
    document.body.style.overflow = "hidden";
  } else {
    modal.style.display = "block";
  }

  const loading = document.getElementById("paymentIframeLoading");
  if (loading) {
    loading.classList.remove("hidden");
    iframe.onload = () => loading.classList.add("hidden");
    setTimeout(() => loading.classList.add("hidden"), 8000);
  }
  return true;
}

export function hidePaymentModal() {
  const modal = getPaymentModalElement();
  if (modal) {
    if (modal.classList.contains("dialog-overlay")) {
      modal.classList.remove("open");
      document.body.style.overflow = "";
    } else {
      modal.style.display = "none";
    }
  }
  const iframe = document.getElementById("paymentIframe");
  if (iframe) iframe.src = "about:blank";
}

/**
 * Hàm xử lý thanh toán
 * @param {number} finalPrice - Giá tiền cần thanh toán
 * @param {Function} showToast - Hàm hiển thị thông báo
 * @param {HTMLElement} loading - Element loading (nếu có)
 * @param {string} orderCode - Mã đơn hàng (nếu có)
 * @returns {Promise<boolean>} - Trả về true nếu thanh toán thành công, false nếu thất bại
 */
export async function processPayment(
  finalPrice,
  showToast,
  loading = null,
  orderCode = null,
  paymentMethod = "PAYOS",
) {
  // --- BẮT ĐẦU: Thanh toán trước ---
  // Chuẩn bị dữ liệu thanh toán (định nghĩa trước try để dùng trong catch)
  const paymentData = {
    amount: finalPrice,
    description: "Falling Love Gift",
    orderCode: Number(orderCode),
    uid: localStorage.getItem("user_uid"),
    customerEmail: localStorage.getItem("customerEmail"),
    paymentMethod: paymentMethod,
  };
  try {
    const paymentMethodText = paymentMethod === "POLAR" ? "Polar" : "PAYOS";
    showToast(`Đang mở trang thanh toán`);

    const res = await fetch(`${API_PAYMENT_URL}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(paymentData),
    });

    const resultData = await res.json().catch(() => ({}));

    if (!res.ok) {
      const msg =
        resultData?.message ||
        resultData?.desc ||
        resultData?.details ||
        resultData?.error ||
        `Lỗi ${res.status}`;
      console.error("[Thanh toán] API lỗi", res.status, resultData);
      if (res.status === 503) {
        showToast("Phương thức thanh toán tạm thời không khả dụng.", "error");
      } else {
        showToast(msg, "error");
      }
      if (typeof window.setPaymentLoading === "function") {
        window.setPaymentLoading(false);
      }
      return false;
    }

    // PAYOS và POLAR: dùng chung luồng iframe + WebSocket (backend emit payment_status_update cho cả hai)
    const codeOk = resultData.code === "00";
    const checkoutUrl = resultData.data?.checkoutUrl || "";
    const isExistingOrder =
      !!resultData.data?.isExistingOrder && !!resultData.data?.orderCode;
    const existingOrderCode = resultData.data?.orderCode;
    const orderCodeForSocket = isExistingOrder
      ? existingOrderCode
      : paymentData.orderCode;

    if (!codeOk || !checkoutUrl) {
      const errMsg =
        resultData?.message ||
        resultData?.desc ||
        resultData?.details ||
        "Không nhận được URL thanh toán";
      console.error("❌ [PAYMENT]", errMsg, resultData);
      showToast(errMsg || "Lỗi tạo thanh toán! Vui lòng thử lại.", "error");
      if (typeof window.setPaymentLoading === "function") {
        window.setPaymentLoading(false);
      }
      return false;
    }

    showToast(
      paymentMethod === "POLAR"
        ? "Đang mở trang thanh toán"
        : "Đang mở trang thanh toán",
    );

    if (isExistingOrder) {
      localStorage.setItem("current_order_code", existingOrderCode);
      if (socketManager.socket && paymentData.orderCode !== existingOrderCode) {
        socketManager.leaveOrder(paymentData.orderCode);
      }
    }

    const dashboard = document.querySelector(".dashboard");
    if (dashboard) dashboard.style.display = "none";

    const paymentModal = getPaymentModalElement();
    const paymentIframe = document.getElementById("paymentIframe");

    if (paymentModal && paymentIframe) {
      showPaymentModal(checkoutUrl);

      localStorage.setItem("payment_in_progress", "true");
      localStorage.setItem("current_order_code", orderCodeForSocket);

      await new Promise((resolve, reject) => {
        let iframeLoaded = false;
        let wsMessageReceived = false;
        let resolved = false;

        function finishSuccess() {
          if (resolved) return;
          resolved = true;
          wsMessageReceived = true;
          try {
            cleanupPaymentState(orderCodeForSocket, false);
            showToast("Thanh toán thành công! Đang chuyển hướng...");
          } catch (error) {
            console.error("❌ [PAYMENT] Error in cleanup/showToast:", error);
          }
          hidePaymentModal();
          if (loading) loading.style.display = "block";
          restoreSuspendedDialogsAfterPayment(true);
          setTimeout(() => {
            window.dispatchEvent(
              new CustomEvent("payment_success", {
                detail: { orderCode: orderCodeForSocket },
              }),
            );
            if (typeof window.handlePaymentSuccess === "function") {
              window.handlePaymentSuccess(orderCodeForSocket);
            }
          }, 1000);
          if (socketManager.socket) {
            socketManager.off("payment_status_update", paymentStatusHandler);
          }
          window.removeEventListener("message", postMessageHandler);
          resolve();
        }

        function finishCancelled() {
          if (resolved) return;
          resolved = true;
          try {
            cleanupPaymentState(orderCodeForSocket, false);
            showToast("Đã hủy thanh toán.", "info");
          } catch (e) {}
          hidePaymentModal();
          restoreSuspendedDialogsAfterPayment(false);
          if (socketManager.socket) {
            socketManager.off("payment_status_update", paymentStatusHandler);
          }
          window.removeEventListener("message", postMessageHandler);
          resolve();
        }

        const paymentStatusHandler = (data) => {
          console.log(
            "[PAYMENT] Socket payment_status_update nhận từ server:",
            data,
          );
          if (
            String(data.orderCode) === String(orderCodeForSocket) &&
            data.status === "PAID"
          ) {
            console.log(
              "[PAYMENT] Trạng thái PAID – đóng iframe và bắn payment_success, orderCode:",
              orderCodeForSocket,
            );
            finishSuccess();
          }
        };

        const postMessageHandler = (event) => {
          const data = event.data;
          if (
            !data ||
            typeof data !== "object" ||
            String(data.orderCode) !== String(orderCodeForSocket)
          )
            return;
          if (data.type === "paymentSuccess") {
            console.log(
              "[PAYMENT] postMessage paymentSuccess nhận từ iframe:",
              data,
            );
            finishSuccess();
          } else if (data.type === "paymentCancelled") {
            console.log(
              "[PAYMENT] postMessage paymentCancelled nhận từ iframe:",
              data,
            );
            finishCancelled();
          }
        };

        window.addEventListener("message", postMessageHandler);

        paymentIframe.onload = () => {
          iframeLoaded = true;
        };

        if (socketManager.isSocketConnected()) {
          socketManager.joinOrder(orderCodeForSocket);
          socketManager.on("payment_status_update", paymentStatusHandler);
        } else {
          console.error("❌ WebSocket chưa được khởi tạo!");
        }

        const retryCheckoutLink = async () => {
          try {
            const paymentInfo = await getPaymentByOrderCode(orderCodeForSocket);
            if (paymentInfo && paymentInfo.checkoutUrl) {
              const iframeEl = document.getElementById("paymentIframe");
              if (iframeEl) {
                showToast("Đang lấy lại link thanh toán...", "info");
                iframeEl.src = paymentInfo.checkoutUrl;
                return true;
              }
            }
          } catch (error) {
            console.warn("[PAYMENT] Không thể lấy lại link thanh toán:", error);
          }
          return false;
        };

        setTimeout(async () => {
          if (!wsMessageReceived) {
            const recovered = await retryCheckoutLink();
            if (recovered) {
              setTimeout(async () => {
                if (!wsMessageReceived) {
                  cleanupPaymentState(orderCodeForSocket, false);
                  restoreSuspendedDialogsAfterPayment(false);
                  showToast(
                    "Timeout - Không thể xác định trạng thái thanh toán!",
                    "warning",
                  );
                  reject(
                    new Error(
                      "Timeout - Không thể xác định trạng thái thanh toán!",
                    ),
                  );
                }
              }, SOCKET_CONFIG.PAYMENT_TIMEOUT);
              return;
            }
            cleanupPaymentState(orderCodeForSocket, false);
            restoreSuspendedDialogsAfterPayment(false);
            showToast(
              "Timeout - Không thể xác định trạng thái thanh toán!",
              "warning",
            );
            reject(
              new Error("Timeout - Không thể xác định trạng thái thanh toán!"),
            );
          }
        }, SOCKET_CONFIG.PAYMENT_TIMEOUT);
      });

      return true;
    }

    console.error("Không tìm thấy modal thanh toán!");
    showToast("Lỗi hiển thị trang thanh toán!", "error");
    if (typeof window.setPaymentLoading === "function") {
      window.setPaymentLoading(false);
    }
    return false;
  } catch (err) {
    console.error("❌ Lỗi khi gọi API thanh toán:", err);
    console.error("❌ Error details:", {
      message: err.message,
      stack: err.stack,
      name: err.name,
    });
    console.error("❌ Payment data that failed:", paymentData);
    showToast("Thanh toán thất bại hoặc bị hủy!", "error");
    // Reset button thanh toán về trạng thái ban đầu khi có lỗi
    if (typeof window.setPaymentLoading === "function") {
      window.setPaymentLoading(false);
    }
    return false;
  }
}

/**
 * Hàm tạo modal thanh toán nếu chưa có
 */
export function createPaymentModal() {
  // Kiểm tra xem modal đã tồn tại chưa
  if (getPaymentModalElement()) {
    return;
  }

  const modalHTML = `
    <div id="paymentModal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 10000;">
      <div style="position: relative; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;">
        <div style="background: white; border-radius: 10px; width: 95vw; max-width: 800px; height: 85vh; max-height: 600px; position: relative;">
          <button id="closePaymentModalBtn" 
                  style="position: absolute; top: 10px; right: 10px; background: #ff6b6b; color: white; border: none; border-radius: 50%; width: 30px; height: 30px; cursor: pointer; z-index: 10001;">
            ×
          </button>
          <iframe id="paymentIframe" 
                  style="width: 100%; height: 100%; border: none; border-radius: 10px;" 
                  frameborder="0">
          </iframe>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML("beforeend", modalHTML);

  // Thêm event listener cho nút đóng iframe
  const closeBtn = document.getElementById("closePaymentModalBtn");
  const paymentModal = document.getElementById("paymentModal");
  if (closeBtn) {
    closeBtn.addEventListener("click", function () {
      hidePaymentModal();
      // Reset button thanh toán về trạng thái ban đầu
      if (typeof window.setPaymentLoading === "function") {
        window.setPaymentLoading(false);
      }
    });
  }
  // Đóng khi click vào overlay
  if (paymentModal) {
    paymentModal.addEventListener("click", function (e) {
      if (e.target === paymentModal) {
        hidePaymentModal();
        // Reset button thanh toán về trạng thái ban đầu
        if (typeof window.setPaymentLoading === "function") {
          window.setPaymentLoading(false);
        }
      }
    });
  }
}

/**
 * Hàm clean up trạng thái thanh toán
 * @param {string} orderCode - Mã đơn hàng
 * @param {boolean} closeIframe - Có đóng iframe không
 */
export function cleanupPaymentState(orderCode, closeIframe = false) {
  // Clear flag thanh toán
  localStorage.removeItem("payment_in_progress");

  // Clear orderCode nếu có
  if (orderCode) {
    localStorage.removeItem("current_order_code");
  }

  // Leave room nếu có socket
  if (socketManager.isSocketConnected() && orderCode) {
    socketManager.leaveOrder(orderCode);
  }

  // Đóng iframe nếu cần
  if (closeIframe) {
    hidePaymentModal();
  }
}

/**
 * Hàm cleanup toàn bộ WebSocket connection
 * Sử dụng khi logout hoặc đóng ứng dụng
 */
export function cleanupWebSocket() {
  socketManager.cleanup();
}

/**
 * Hàm hiển thị toast message (có thể tùy chỉnh)
 * @param {string} message - Nội dung thông báo
 * @param {string} type - Loại thông báo (success, error, info, warning)
 * @param {number} durationMs - Thời gian hiển thị (ms), mặc định 3000ms
 */
export function showToast(message, type = "info", durationMs = 3000) {
  // Tạo toast element nếu chưa có
  let toastContainer = document.getElementById("toast-container");
  if (!toastContainer) {
    toastContainer = document.createElement("div");
    toastContainer.id = "toast-container";
    toastContainer.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 9999999999;
      display: flex;
      flex-direction: column;
      gap: 10px;
    `;
    document.body.appendChild(toastContainer);
  }

  // Tạo toast message
  const toast = document.createElement("div");
  toast.style.cssText = `
    background: ${type === "success" ? "#4caf50" : type === "error" ? "#f44336" : type === "warning" ? "#ff9800" : "#2196f3"};
    color: white;
    padding: 12px 20px;
    border-radius: 5px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    font-family: Arial, sans-serif;
    font-size: clamp(12px, 3.5vw, 14px);
    max-width: 80vw;
    word-wrap: break-word;
    animation: slideIn 0.3s ease;
  `;
  toast.textContent = message;

  // Thêm CSS animation
  if (!document.getElementById("toast-styles")) {
    const style = document.createElement("style");
    style.id = "toast-styles";
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }

  toastContainer.appendChild(toast);

  // Tự động xóa sau durationMs
  setTimeout(() => {
    toast.style.animation = "slideOut 0.3s ease";
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }, durationMs);
}

/**
 * Fetch payment theo orderCode
 * @param {string} orderCode - Mã đơn hàng
 * @returns {Promise<Object>} - Payment data với checkoutUrl
 */
export async function getPaymentByOrderCode(orderCode) {
  try {
    const response = await fetch(
      `${SERVER_URL_PROD}/api/payments/${orderCode}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error("Lỗi khi fetch payment theo orderCode:", error);
    throw error;
  }
}

function extractCheckoutUrlFromPaymentPayload(payload) {
  if (!payload || typeof payload !== "object") return "";
  if (
    typeof payload.checkoutUrl === "string" &&
    payload.checkoutUrl.trim()
  ) {
    return payload.checkoutUrl.trim();
  }
  const d = payload.data;
  if (d && typeof d === "object") {
    if (typeof d.checkoutUrl === "string" && d.checkoutUrl.trim()) {
      return d.checkoutUrl.trim();
    }
    if (
      d.data &&
      typeof d.data === "object" &&
      typeof d.data.checkoutUrl === "string" &&
      d.data.checkoutUrl.trim()
    ) {
      return d.data.checkoutUrl.trim();
    }
  }
  return "";
}

/** `<dialog open>` nằm top layer — đóng tạm để #paymentModal hiện phía trên */
let suspendedDialogsForPayment = [];

function suspendTopLayerDialogs() {
  suspendedDialogsForPayment = [];
  document.querySelectorAll("dialog[open]").forEach((el) => {
    suspendedDialogsForPayment.push(el);
    el.close();
  });
}

function restoreSuspendedDialogsAfterPayment(paid) {
  if (paid) {
    suspendedDialogsForPayment = [];
    return;
  }
  const list = suspendedDialogsForPayment;
  suspendedDialogsForPayment = [];
  list.forEach((el) => {
    if (el && typeof el.showModal === "function") {
      try {
        el.showModal();
      } catch (_) {}
    }
  });
}

/**
 * Mở dialog thanh toán (iframe) giống processPayment — dùng cho đơn chờ thanh toán
 * trong lịch sử đơn. Không window.open sang trang PayOS.
 * @param {string} checkoutUrl
 * @param {string} orderCode
 * @param {(msg: string, type?: string) => void} showToast
 * @returns {Promise<boolean>}
 */
async function openPaymentModalForCheckout(checkoutUrl, orderCode, showToast) {
  createPaymentModal();
  const paymentModal = getPaymentModalElement();
  const paymentIframe = document.getElementById("paymentIframe");
  if (!paymentModal || !paymentIframe) {
    showToast("Lỗi hiển thị trang thanh toán!", "error");
    return false;
  }

  showToast("Đang mở trang thanh toán");
  showPaymentModal(checkoutUrl);

  try {
    localStorage.setItem("payment_in_progress", "true");
    localStorage.setItem("current_order_code", orderCode);
  } catch (_) {}

  await new Promise((resolve, reject) => {
    let wsMessageReceived = false;
    let resolved = false;
    let timeoutId = null;

    function detachUiCloseListeners() {
      const closeBtn = document.getElementById("closePaymentModalBtn");
      if (closeBtn) closeBtn.removeEventListener("click", onUserCloseModal);
      paymentModal.removeEventListener("click", onOverlayCloseModal);
    }

    function finishSuccess() {
      if (resolved) return;
      resolved = true;
      wsMessageReceived = true;
      if (timeoutId) window.clearTimeout(timeoutId);
      detachUiCloseListeners();
      try {
        cleanupPaymentState(orderCode, false);
        showToast("Thanh toán thành công! Đang chuyển hướng...");
      } catch (error) {
        console.error("❌ [PAYMENT] Error in cleanup/showToast:", error);
      }
      hidePaymentModal();
      restoreSuspendedDialogsAfterPayment(true);
      setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent("payment_success", {
            detail: { orderCode },
          }),
        );
        if (typeof window.handlePaymentSuccess === "function") {
          window.handlePaymentSuccess(orderCode);
        }
      }, 1000);
      if (socketManager.socket) {
        socketManager.off("payment_status_update", paymentStatusHandler);
      }
      window.removeEventListener("message", postMessageHandler);
      resolve();
    }

    function finishCancelled() {
      if (resolved) return;
      resolved = true;
      if (timeoutId) window.clearTimeout(timeoutId);
      detachUiCloseListeners();
      try {
        cleanupPaymentState(orderCode, false);
        showToast("Đã hủy thanh toán.", "info");
      } catch (e) {}
      hidePaymentModal();
      restoreSuspendedDialogsAfterPayment(false);
      if (socketManager.socket) {
        socketManager.off("payment_status_update", paymentStatusHandler);
      }
      window.removeEventListener("message", postMessageHandler);
      resolve();
    }

    function onUserCloseModal() {
      finishCancelled();
    }

    function onOverlayCloseModal(e) {
      if (e.target === paymentModal) finishCancelled();
    }

    const paymentStatusHandler = (data) => {
      if (
        String(data.orderCode) === String(orderCode) &&
        data.status === "PAID"
      ) {
        finishSuccess();
      }
    };

    const postMessageHandler = (event) => {
      const data = event.data;
      if (
        !data ||
        typeof data !== "object" ||
        String(data.orderCode) !== String(orderCode)
      )
        return;
      if (data.type === "paymentSuccess") {
        finishSuccess();
      } else if (data.type === "paymentCancelled") {
        finishCancelled();
      }
    };

    window.addEventListener("message", postMessageHandler);

    const closeBtn = document.getElementById("closePaymentModalBtn");
    if (closeBtn) closeBtn.addEventListener("click", onUserCloseModal);
    paymentModal.addEventListener("click", onOverlayCloseModal);

    if (socketManager.isSocketConnected()) {
      socketManager.joinOrder(orderCode);
      socketManager.on("payment_status_update", paymentStatusHandler);
    } else {
      console.error("❌ WebSocket chưa được khởi tạo!");
    }

    timeoutId = setTimeout(() => {
      if (!wsMessageReceived && !resolved) {
        detachUiCloseListeners();
        cleanupPaymentState(orderCode, false);
        restoreSuspendedDialogsAfterPayment(false);
        showToast(
          "Timeout - Không thể xác định trạng thái thanh toán!",
          "warning",
        );
        if (socketManager.socket) {
          socketManager.off("payment_status_update", paymentStatusHandler);
        }
        window.removeEventListener("message", postMessageHandler);
        reject(
          new Error("Timeout - Không thể xác định trạng thái thanh toán!"),
        );
      }
    }, SOCKET_CONFIG.PAYMENT_TIMEOUT);
  });

  return true;
}

/**
 * Mở dialog thanh toán cho đơn chờ thanh toán (lịch sử đơn),
 * bằng GET /api/payments/:orderCode để lấy checkoutUrl đúng mã đơn.
 * Hiển thị cùng paymentModal/iframe như khi bấm "Thanh toán ngay" lúc tạo mới.
 * @param {string|number} orderCode
 * @param {(msg: string, type?: string) => void} showToast
 * @param {string} [fallbackCheckoutUrl] — URL lưu trong bản ghi list (nếu GET không có field)
 * @returns {Promise<boolean>}
 */
export async function openCheckoutByOrderCode(
  orderCode,
  showToast,
  fallbackCheckoutUrl = "",
) {
  const toast =
    typeof showToast === "function"
      ? showToast
      : (msg, type) => console.log("[toast]", type, msg);
  const code =
    orderCode !== undefined && orderCode !== null
      ? String(orderCode).trim()
      : "";
  if (!code || code === "—") {
    toast("Không có mã đơn hợp lệ.", "error");
    return false;
  }
  toast("Đang lấy link thanh toán…", "info");
  let url = "";
  try {
    const info = await getPaymentByOrderCode(code);
    url = extractCheckoutUrlFromPaymentPayload(info);
  } catch (err) {
    console.warn("[Payment] openCheckoutByOrderCode GET:", err);
  }
  if (
    !url &&
    typeof fallbackCheckoutUrl === "string" &&
    fallbackCheckoutUrl.trim()
  ) {
    url = fallbackCheckoutUrl.trim();
  }
  if (!url) {
    toast("Không lấy được link thanh toán cho đơn này.", "error");
    return false;
  }
  try {
    return await openPaymentModalForCheckout(url, code, toast);
  } catch (e) {
    console.error("[Payment] openCheckoutByOrderCode modal:", e);
    toast(e?.message || "Không mở được dialog thanh toán.", "error");
    return false;
  }
}

/**
 * Danh sách Payment theo user — GET /api/payments/user/:uid (BACKEND_RECORD_SCHEMA mục 6)
 * @param {string} uid
 * @param {{ page?: number, limit?: number, status?: string }} [options]
 * @returns {Promise<{ success: boolean, data: object[], pagination: object|null, message?: string }>}
 */
export async function fetchPaymentsByUser(uid, options = {}) {
  const { page = 1, limit = 20, status } = options;
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
  if (status) params.set("status", status);
  const url = `${SERVER_URL_PROD}/api/payments/user/${encodeURIComponent(uid)}?${params}`;
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
          (Array.isArray(json.details) ? json.details[0]?.msg : null) ||
          `HTTP ${response.status}`,
        data: [],
        pagination: null,
      };
    }
    if (json.success === false) {
      return {
        success: false,
        message: json.message || json.error || "Lỗi lấy danh sách thanh toán",
        data: [],
        pagination: json.pagination || null,
      };
    }
    return {
      success: true,
      data: Array.isArray(json.data) ? json.data : [],
      pagination: json.pagination || null,
    };
  } catch (err) {
    console.error("[Payment] fetchPaymentsByUser:", err);
    return {
      success: false,
      message: err?.message || "Lỗi kết nối",
      data: [],
      pagination: null,
    };
  }
}

// Export ra window cho browser & non-module scripts
if (typeof window !== "undefined") {
  window.SocketManager = SocketManager;
  window.socketManager = socketManager;
  window.initWebSocket = initWebSocket;
  window.processPayment = processPayment;
  window.createPaymentModal = createPaymentModal;
  window.cleanupPaymentState = cleanupPaymentState;
  window.cleanupWebSocket = cleanupWebSocket;
  window.showToast = showToast;
  window.getPaymentByOrderCode = getPaymentByOrderCode;
  window.openPaymentModalForCheckout = openPaymentModalForCheckout;
  window.openCheckoutByOrderCode = openCheckoutByOrderCode;
  window.fetchPaymentsByUser = fetchPaymentsByUser;
  window.getPaymentModalElement = getPaymentModalElement;
  window.showPaymentModal = showPaymentModal;
  window.hidePaymentModal = hidePaymentModal;
  window.PaymentAPI = {
    SocketManager,
    socketManager,
    initWebSocket,
    processPayment,
    createPaymentModal,
    cleanupPaymentState,
    cleanupWebSocket,
    showToast,
    getPaymentByOrderCode,
    openPaymentModalForCheckout,
    openCheckoutByOrderCode,
    fetchPaymentsByUser,
    getPaymentModalElement,
    showPaymentModal,
    hidePaymentModal,
  };
}

