/*
 * Cấu hình kết nối dùng chung cho mọi thiết bị.
 * - Để trống: mỗi máy tự lưu dữ liệu riêng, quản lý không xem được báo cáo của máy khác.
 * - Điền URL + anon key của Supabase: mọi điện thoại, máy tính bảng, máy tính dùng chung
 *   dữ liệu và quản lý theo dõi báo cáo theo thời gian thực (xem README.md).
 * Có thể sửa file này ngay trên máy chủ sau khi build mà không cần build lại.
 */
window.SOKHACH_CONFIG = {
  supabaseUrl: '',
  supabaseAnonKey: '',
  photoBucket: 'photos'
};
