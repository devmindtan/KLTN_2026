/**
 * Logger tập trung – chỉ xuất log khi VITE_LOG=true
 * Dùng thay thế console.* trực tiếp để dễ tắt trên production
 */

const ENABLED = import.meta.env.VITE_LOG === "true";

const logger = {
  /** Log thông tin thông thường */
  log: (...args: unknown[]) => {
    if (ENABLED) console.log(...args);
  },

  /** Log cảnh báo */
  warn: (...args: unknown[]) => {
    if (ENABLED) console.warn(...args);
  },

  /** Log lỗi – luôn hiện trên dev, ẩn trên production */
  error: (...args: unknown[]) => {
    if (ENABLED) console.error(...args);
  },

  /** Log thông tin debug chi tiết */
  info: (...args: unknown[]) => {
    if (ENABLED) console.info(...args);
  },
};

export default logger;
