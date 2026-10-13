# Sổ Khách – Báo cáo nhân viên

Ứng dụng web một trang để nhân viên đăng khách mới (kèm ảnh), gửi báo cáo ngày, và để quản lý xem tổng hợp theo ngày/tháng.

## Chức năng

**Nhân viên:** Khách mới · Báo cáo ngày · Trang chủ (khách cả đội) · **Danh sách khách hàng** — khách của mình chia thành 6 bảng theo trạng thái (Mới, Phản hồi, Đang nói chuyện, Chơi giúp, Vào tiền, Chết). Đổi trạng thái trong bảng để chuyển khách sang bảng khác; bấm tên khách để sửa.

**Quản lý:** Báo cáo ngày · Theo tháng · Từng nhân viên · Khách mới · **Danh sách khách hàng** — bảng tổng hợp số khách theo từng nhân viên × trạng thái (kèm tỉ lệ vào tiền), lọc theo nhân viên/tháng/từ khoá, và xem/đổi trạng thái khách của cả đội · Mã nhân viên.

## Cấu trúc

| File | Vai trò |
|---|---|
| `index.html` | Toàn bộ giao diện và logic ứng dụng |
| `store.js` | Lớp lưu trữ dùng chung trên Supabase (dữ liệu + ảnh, cập nhật realtime) |
| `config.js` | Điền URL/anon key Supabase. Để trống = mỗi máy lưu riêng |
| `supabase/schema.sql` | Tạo bảng, quyền và bucket ảnh trên Supabase |
| `.github/workflows/deploy.yml` | Tự deploy lên GitHub Pages khi push vào nhánh mặc định |

## Deploy lên GitHub Pages

1. Đưa code vào nhánh mặc định của repo (thường là `main`).
2. Vào **Settings → Pages**, mục **Build and deployment → Source** chọn **GitHub Actions**.
3. Mỗi lần push vào nhánh mặc định, workflow *Deploy to GitHub Pages* sẽ chạy. Trang có địa chỉ:
   `https://<tên-tài-khoản>.github.io/<tên-repo>/` (ví dụ `https://nclong1976.github.io/baocao/`).

## Bật dữ liệu dùng chung cho cả đội (khuyến nghị)

Không cấu hình, mỗi điện thoại/máy tính chỉ thấy dữ liệu của chính nó. Để cả đội dùng chung:

1. Tạo project miễn phí tại <https://supabase.com>.
2. Mở **SQL Editor**, dán nội dung `supabase/schema.sql` rồi bấm **Run**.
3. Vào **Project Settings → API**, chép **Project URL** và **anon public key** vào `config.js`.
4. Commit và push vào nhánh mặc định — trang sẽ tự deploy lại.

## Đăng nhập

- Nhân viên nhập mã của mình (mặc định: 7, 6, 8, 1, 503, 11, 4). Quản lý sửa danh sách mã trong trang quản lý.
- Nhập `0` để vào trang quản lý.

> **Lưu ý bảo mật:** mã nhân viên chỉ kiểm tra ở trình duyệt, và anon key nằm công khai trong `config.js`. Ai có đường dẫn trang đều có thể đọc/ghi dữ liệu. Chỉ chia sẻ link trong nội bộ; nếu cần bảo mật thật sự, cần thêm đăng nhập Supabase Auth.

## Chạy thử trên máy

```bash
python3 -m http.server 8000
# mở http://localhost:8000
```
