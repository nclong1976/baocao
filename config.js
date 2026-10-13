/*
 * Cấu hình kho dữ liệu dùng chung.
 * - Để trống: mỗi máy tự lưu dữ liệu riêng (localStorage), không chia sẻ giữa nhân viên.
 * - Điền URL + anon key của Supabase: cả đội dùng chung dữ liệu và ảnh (xem README.md).
 */
window.SOKHACH_CONFIG = {
  supabaseUrl: '',
  supabaseAnonKey: '',
  photoBucket: 'photos'
};
