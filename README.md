# Sổ Khách – Báo cáo nhân viên (React + TypeScript)

Ứng dụng web React được xây dựng với Vite và TypeScript để nhân viên đăng khách mới (kèm ảnh), gửi báo cáo ngày, quản lý danh sách khách hàng dạng bảng tính, và để quản lý theo dõi tổng hợp theo ngày/tháng.

## Chức năng

### Nhân viên
- **Khách mới:** Nhập thông tin khách hàng, đánh giá tiềm năng (cao/trung bình/thấp), dán hoặc kéo thả ảnh (tối đa 6 ảnh, tự động nén), phát hiện trùng tên và năm sinh, quản lý danh sách khách đã đăng hôm nay (xem, sửa, xoá).
- **Báo cáo ngày:** Nhập số lượng cào, phản hồi, khách mới (tự động đếm), đang nói chuyện, chơi giúp, vào tiền, khách chết, tổng data nhận, số lượng còn lại, tình trạng data, tổng khách trong tháng. Xem trước nội dung báo cáo và một nút sao chép để gửi qua Zalo/tin nhắn. Lịch sử báo cáo đã lưu.
- **Trang chủ:** Dòng tin khách hàng mới của cả đội, tìm kiếm theo tên/nghề/địa chỉ/ghi chú, lọc theo nhân viên, xem phóng to ảnh khách hàng trong hộp thoại (lightbox).
- **Danh sách khách hàng (Bảng tính):** Giao diện bảng tính nhập liệu trực tiếp vào ô và tự động lưu. Các cột: STT, Tên, Nghề nghiệp, Nơi ở, Hôn nhân/Con cái, Kết bạn từ ngày, Tình trạng giai đoạn (menu thẻ màu hoặc phím tắt 1–7), Xếp hạng (phím tắt A–D), Doanh thu (VNĐ - tự động định dạng số tiền), Ghi chú.

### Quản trị (Mã quản lý: `0`)
- **Báo cáo ngày:** Tình hình nộp báo cáo (nhân viên đã nộp / chưa nộp), thẻ KPI tổng hợp, bảng chi tiết từng nhân viên, sao chép văn bản tổng hợp.
- **Theo tháng:** Thống kê tổng hợp cả đội theo tháng được chọn, biểu đồ đường SVG diễn biến số lượng cào & khách vào tiền theo ngày, bảng hiệu suất và tỷ lệ chuyển đổi từng nhân viên.
- **Từng nhân viên:** Chọn nhân viên và xem chi tiết theo tháng, biểu đồ xu hướng và bảng chi tiết từng ngày.
- **Khách mới:** Xem tất cả khách hàng mới cả đội đã đăng, lọc theo nhân viên/ngày/từ khóa, quyền xoá khách hàng.
- **Danh sách khách hàng:** Ma trận phân loại khách hàng theo nhân viên và giai đoạn, tổng doanh thu, xem và sửa danh sách khách hàng toàn đội.
- **Mã nhân viên:** Thêm/xoá mã nhân viên hợp lệ có thể đăng nhập vào hệ thống.

## Công nghệ
- **React 18** + **TypeScript**
- **Vite**
- CSS gốc chuẩn mực giữ trọn vẹn phong cách thiết kế, font chữ *Be Vietnam Pro*, hỗ trợ giao diện sáng & tối (Light/Dark mode)
- Hỗ trợ lưu trữ cục bộ (`localStorage`) và đồng bộ thời gian thực qua **Supabase** (nếu cấu hình)

## Khởi chạy
```bash
npm install
npm run dev
```
Dev server chạy tại cổng 3000 (`http://localhost:3000`).
