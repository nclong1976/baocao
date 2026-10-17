# Sổ Khách – Báo cáo nhân viên (React + TypeScript)

Ứng dụng web React được xây dựng với Vite và TypeScript để nhân viên đăng khách mới (kèm ảnh), gửi báo cáo ngày, quản lý danh sách khách hàng dạng bảng tính, và để quản lý theo dõi tổng hợp theo ngày/tháng.

## Chức năng

### Nhân viên
- **Khách mới:** Nhập thông tin khách hàng, đánh giá tiềm năng (cao/trung bình/thấp), dán hoặc kéo thả ảnh (tối đa 6 ảnh, tự động nén), phát hiện trùng tên và năm sinh, quản lý danh sách khách đã đăng hôm nay (xem, sửa, xoá).
- **Báo cáo ngày:** Nhập số lượng cào, khách mới (tự động đếm), đang nói chuyện, chơi giúp, vào tiền, khách chết, tổng data nhận, số lượng còn lại, tình trạng data, tổng khách trong tháng. Xem trước nội dung báo cáo và một nút sao chép để gửi qua Zalo/tin nhắn. Lịch sử báo cáo đã lưu.
- **Trang chủ:** Dòng tin khách hàng mới của cả đội, tìm kiếm theo tên/nghề/địa chỉ/ghi chú, lọc theo nhân viên, xem phóng to ảnh khách hàng trong hộp thoại (lightbox).
- **Danh sách khách hàng (Bảng tính):** Giao diện bảng tính nhập liệu trực tiếp vào ô và tự động lưu. Các cột: STT, Tên, Nghề nghiệp, Nơi ở, Hôn nhân/Con cái, Kết bạn từ ngày, Tình trạng giai đoạn (menu thẻ màu hoặc phím tắt 1–7), Xếp hạng (phím tắt A–D), Doanh thu (VNĐ - tự động định dạng số tiền), Ghi chú.

### Lọc khách trùng (tự động)
- Khi nhân viên nhập khách mới (form **Khách mới** hoặc gõ tên vào **Danh sách khách hàng**), hệ thống tự rà soát với toàn bộ khách của cả đội ngay trong lúc gõ.
- Nhận ra trùng kể cả khi viết không dấu, đảo thứ tự họ tên, hoa/thường khác nhau; tên gần giống (sai 1–2 chữ) được coi là *có thể trùng* nếu cùng năm sinh hoặc cùng nơi ở. Khác năm sinh thì không báo.
- Khi trùng: **còi hú, điện thoại rung và màn hình nhấp nháy đỏ**, hiện khách đã có (nhân viên nào, lúc nào, ở đâu). Nhân viên chọn *huỷ nhập* hoặc *người khác, vẫn tiếp tục*.
- Nhân viên vừa đăng khách vừa ghi chính khách đó vào bảng của mình thì không bị coi là trùng.

### Quản trị (Mã quản lý: `0`)
- **Trực tiếp (mặc định):** Theo dõi theo thời gian thực mọi thiết bị đang mở ứng dụng — nhân viên nào đang trực tuyến, trên điện thoại/máy tính bảng/máy tính nào, trình duyệt gì, đang ở màn hình nào; ai đã nộp báo cáo hôm nay; dòng hoạt động trực tiếp (nộp báo cáo, đăng khách, sửa bảng khách hàng, xoá, vào/rời ứng dụng). Có thông báo nổi trong trang và tuỳ chọn thông báo của trình duyệt khi nhân viên nộp báo cáo hoặc đăng khách.
- **Khách trùng:** Danh sách các nhóm khách bị nhập trùng (ai nhập, nguồn, năm sinh, nơi ở, thời điểm). Máy quản lý cũng hú còi và nháy đỏ ngay khi một nhân viên nhập khách trùng.
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

## Kết nối tất cả thiết bị (thời gian thực)

Mặc định mỗi máy lưu dữ liệu riêng, quản lý không thấy báo cáo của máy khác. Để mọi điện thoại, máy tính bảng, máy tính của nhân viên gửi báo cáo về một chỗ và quản lý xem được ngay lập tức:

1. Tạo một project trên [Supabase](https://supabase.com) (gói miễn phí là đủ).
2. Mở **SQL Editor**, dán và chạy toàn bộ `supabase/schema.sql` (tạo bảng dữ liệu, bật Realtime, tạo kho ảnh).
3. Lấy **Project URL** và **anon / publishable key** trong *Project Settings → API*, rồi điền vào **một** trong hai chỗ:
   - `public/config.js` (hoặc `config.js` trong thư mục đã build — sửa được trực tiếp trên máy chủ, không cần build lại), hoặc
   - biến môi trường khi build: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (file `.env`, hoặc *Settings → Secrets and variables → Actions* của repo GitHub để workflow deploy tự dùng).
4. Mở cùng một đường link (GitHub Pages hoặc tên miền của bạn) trên mọi thiết bị. Trên điện thoại có thể chọn *Thêm vào màn hình chính* để dùng như ứng dụng.

Khi đã kết nối, dòng trạng thái hiện *"Đã kết nối thời gian thực"*. Nếu mạng chập chờn, ứng dụng tự kết nối lại và tải bù những thay đổi bị lỡ.

## Khởi chạy
```bash
npm install
npm run dev
```
Dev server chạy tại cổng 3000 (`http://localhost:3000`).
