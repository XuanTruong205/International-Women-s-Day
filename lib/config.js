// lib/config.js - Configuration for backend endpoints
const BASE_URL =
  (typeof window !== "undefined" && window.APP_CONFIG?.apiBase) ||
  "https://hearlyserver.onrender.com";

export const SERVER_URL_PROD = BASE_URL;
export const API_PAYMENT_URL = `${BASE_URL}/api/payments/create`;
export const API_PRODUCT_URL = `${BASE_URL}/api/products`;
export const API_FALLING_LOVE_URL = `${BASE_URL}/api/falling-loves`;

if (typeof window !== "undefined") {
  window.API_CONFIG = {
    SERVER_URL_PROD,
    API_PAYMENT_URL,
    API_PRODUCT_URL,
    API_FALLING_LOVE_URL,
  };
}

