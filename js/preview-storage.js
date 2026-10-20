/**
 * preview-storage.js
 * Quản lý lưu trữ và chia sẻ dữ liệu Xem trước giữa create.html và index.html
 * Hỗ trợ đồng bộ nhanh qua window.opener / localStorage và lưu trữ file lớn (ảnh, mp3) qua IndexedDB.
 */
const PreviewStorage = (function () {
  const STORAGE_KEY = 'fl_preview_meta';
  const DB_NAME = 'FallingLovePreviewDB';
  const DB_VERSION = 1;
  const STORE_MEDIA = 'preview_media';

  function openDB() {
    return new Promise((resolve) => {
      if (!window.indexedDB) {
        resolve(null);
        return;
      }
      try {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(STORE_MEDIA)) {
            db.createObjectStore(STORE_MEDIA, { keyPath: 'id' });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      } catch (e) {
        resolve(null);
      }
    });
  }

  async function saveMedia(id, blob) {
    try {
      const db = await openDB();
      if (!db) return false;
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_MEDIA, 'readwrite');
        tx.objectStore(STORE_MEDIA).put({ id, blob });
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      });
    } catch (e) {
      console.warn('Lỗi lưu IndexedDB:', e);
      return false;
    }
  }

  async function getMedia(id) {
    try {
      const db = await openDB();
      if (!db) return null;
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_MEDIA, 'readonly');
        const req = tx.objectStore(STORE_MEDIA).get(id);
        req.onsuccess = () => resolve(req.result ? req.result.blob : null);
        req.onerror = () => resolve(null);
      });
    } catch (e) {
      return null;
    }
  }

  async function clearMedia() {
    try {
      const db = await openDB();
      if (!db) return;
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_MEDIA, 'readwrite');
        tx.objectStore(STORE_MEDIA).clear();
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      });
    } catch (e) {
      // ignore
    }
  }

  return {
    /**
     * Lưu dữ liệu từ trang create.html
     */
    async save({ intro, wishes, musicSrc, musicName, musicBlob, images, imageUrls }) {
      const meta = {
        intro: Array.isArray(intro) ? intro : [],
        wishes: Array.isArray(wishes) ? wishes : [],
        musicSrc: musicSrc || '',
        musicName: musicName || '',
        hasCustomMusic: !!musicBlob,
        hasCustomImages: Array.isArray(images) && images.length > 0,
        imageUrls: Array.isArray(imageUrls) ? imageUrls : [],
        imageCount: Array.isArray(images) ? images.length : 0,
        updatedAt: Date.now()
      };

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(meta));
      } catch (e) {
        console.warn('Lưu localStorage thất bại:', e);
      }

      // Lưu media blob vào IndexedDB
      await clearMedia();
      if (musicBlob) {
        await saveMedia('custom_music', musicBlob);
      }
      if (Array.isArray(images) && images.length > 0) {
        for (let i = 0; i < images.length; i++) {
          const item = images[i];
          if (item instanceof Blob) {
            await saveMedia('img_' + i, item);
          }
        }
      }
    },

    /**
     * Đọc đồng bộ ngay khi load trang
     */
    getSync() {
      // 1. Ưu tiên đọc từ window.opener nếu mở qua window.open
      try {
        if (window.opener && window.opener.__currentGiftData) {
          const d = window.opener.__currentGiftData;
          return {
            intro: Array.isArray(d.intro) ? d.intro : [],
            wishes: Array.isArray(d.wishes) ? d.wishes : [],
            musicSrc: d.music || '',
            musicBlob: d.musicBlob || null,
            imageUrls: Array.isArray(d.imageUrls) ? d.imageUrls : [],
            source: 'opener'
          };
        }
      } catch (e) {
        // Opener cross-origin hoặc bị đóng
      }

      // 2. Fallback đọc từ localStorage
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const d = JSON.parse(raw);
          return {
            intro: Array.isArray(d.intro) ? d.intro : [],
            wishes: Array.isArray(d.wishes) ? d.wishes : [],
            musicSrc: d.musicSrc || '',
            musicBlob: null,
            imageUrls: Array.isArray(d.imageUrls) ? d.imageUrls : [],
            hasCustomMusic: d.hasCustomMusic,
            imageCount: d.imageCount || 0,
            source: 'storage'
          };
        }
      } catch (e) {}

      return null;
    },

    /**
     * Đọc bất đồng bộ từ IndexedDB (phục vụ trường hợp F5 / reload tab xem trước)
     */
    async getAsync() {
      const data = this.getSync() || { intro: [], wishes: [], musicSrc: '', imageUrls: [] };

      // Nếu đã có imageUrls hợp lệ từ opener thì dùng luôn
      if (data.imageUrls && data.imageUrls.length > 0 && data.source === 'opener') {
        return data;
      }

      try {
        const customMusicBlob = await getMedia('custom_music');
        if (customMusicBlob) {
          data.musicSrc = URL.createObjectURL(customMusicBlob);
        }

        const count = data.imageCount || 15;
        const loadedUrls = [];
        for (let i = 0; i < count; i++) {
          const blob = await getMedia('img_' + i);
          if (blob) {
            loadedUrls.push(URL.createObjectURL(blob));
          }
        }
        if (loadedUrls.length > 0) {
          data.imageUrls = loadedUrls;
        }
      } catch (e) {
        console.warn('Lỗi đọc IndexedDB:', e);
      }

      return data;
    },

    /**
     * Kiểm tra trang hiện tại có đang ở chế độ Xem trước không
     */
    isCurrentPreview() {
      const params = new URLSearchParams(window.location.search);
      return params.has('preview');
    }
  };
})();

// Gán toàn cục
window.PreviewStorage = PreviewStorage;
