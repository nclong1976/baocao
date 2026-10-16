export interface Customer {
  id: string;
  code: string;
  name: string;
  birth?: string;
  job?: string;
  addr?: string;
  marital?: string;
  kids?: string;
  rating?: string;
  note?: string;
  photos?: string[];
  day: string;
  createdAt: number;
  updatedAt: number;
}

export interface Report {
  id: string;
  code: string;
  date: string;
  scraped: number;
  phanHoi: number;
  moi: number;
  dangNoi: number;
  choiGiup: number;
  vaoTien: number;
  chet: number;
  tongData: number;
  conLai: number;
  tinhTrang: string;
  tongThang: number;
  updatedAt: number;
}

export interface SheetCustomer {
  id: string;
  code: string;
  name?: string;
  job?: string;
  addr?: string;
  family?: string;
  since?: string;
  stage?: string;
  rank?: string;
  revenue?: number;
  note?: string;
  createdAt: number;
  updatedAt: number;
}

export type StorageMode = 'loading' | 'cloud' | 'local' | 'error';

export interface PhotoItem {
  kind: 'new' | 'old';
  url?: string;
  file?: File;
  ref: string;
}

export const DEFAULT_CODES = ['7', '6', '8', '1', '503', '11', '4'];
export const ADMIN_KEY = '__quanly__';
export const SKEY = 'sokhach-codes';
export const CKEY = 'sokhach-code';
export const LKEY = 'sokhach-local-v2';

export const RATING_MAP: Record<string, [string, string]> = {
  cao: ['Tiềm năng cao', '--s-vao_tien'],
  tb: ['Trung bình', '--s-dang_noi'],
  thap: ['Thấp', '--s-moi'],
};

export const DSTAT = ['Mới', 'Đang xử lý', 'Chưa cào xong', 'Hết data'];

export interface ReportFieldDef {
  key: keyof Omit<Report, 'id' | 'code' | 'date' | 'updatedAt'>;
  label: string;
  colorVar?: string;
  isChip?: boolean;
}

export const R_FIELDS: [string, string, string?, boolean?][] = [
  ['scraped', 'Số lượng cào hôm nay'],
  ['phanHoi', 'Khách hàng phản hồi', 'phan_hoi'],
  ['moi', 'Khách mới', 'moi'],
  ['dangNoi', 'Khách đang nói chuyện', 'dang_noi'],
  ['choiGiup', 'Khách chơi giúp', 'choi_giup'],
  ['vaoTien', 'Khách vào tiền', 'vao_tien'],
  ['chet', 'Khách chết', 'chet'],
  ['tongData', 'Tổng data nhận'],
  ['conLai', 'Số lượng còn lại'],
  ['tinhTrang', 'Tình trạng data', '', true],
  ['tongThang', 'Tổng khách trong tháng'],
];

export const STAGES: [string, string, string][] = [
  ['Mới kết bạn', '#FFE5A0', '#5C4300'],
  ['Tạo niềm tin/tình cảm', '#D4EDBC', '#1E4D0F'],
  ['Báo họp', '#753800', '#FFE5CC'],
  ['Công tác', '#B10202', '#FFE0DE'],
  ['Đang chơi giúp', '#11734B', '#D4F5E4'],
  ['Đang vào tiền', '#0A53A8', '#DCEBFF'],
  ['Chết', '#3D3D3D', '#F0F0F0'],
];

export const RANKS: [string, string, string][] = [
  ['A - Rất tiềm năng', '#E6E6E6', '#2B2B2B'],
  ['B - Tiềm năng', '#E6E6E6', '#2B2B2B'],
  ['C - Bình thường', '#E6E6E6', '#2B2B2B'],
  ['D - Ít tiềm năng', '#E6E6E6', '#2B2B2B'],
];

export const PICK_MAP: Record<string, [string, string, string][]> = {
  stage: STAGES,
  rank: RANKS,
};

export interface SheetColumnDef {
  key: keyof SheetCustomer;
  label: string;
  width: number;
  type?: 'pick' | 'date' | 'money';
}

export const SCOLS: SheetColumnDef[] = [
  { key: 'name', label: 'Tên khách hàng', width: 190 },
  { key: 'job', label: 'Nghề nghiệp', width: 150 },
  { key: 'addr', label: 'Nơi ở', width: 170 },
  { key: 'family', label: 'Hôn nhân / Con cái', width: 170 },
  { key: 'since', label: 'Kết bạn từ ngày', width: 150, type: 'date' },
  { key: 'stage', label: 'Tình trạng giai đoạn', width: 200, type: 'pick' },
  { key: 'rank', label: 'Xếp hạng', width: 180, type: 'pick' },
  { key: 'revenue', label: 'Doanh thu (VNĐ)', width: 150, type: 'money' },
  { key: 'note', label: 'Ghi chú', width: 260 },
];

export type LiveStatus = 'connecting' | 'live' | 'offline';

/** Một thiết bị đang mở ứng dụng, chia sẻ qua kênh presence của Supabase. */
export interface PresenceEntry {
  deviceId: string;
  role: 'staff' | 'admin';
  code: string;
  device: string;
  browser: string;
  view: string;
  since: number;
}

export interface ActivityItem {
  id: string;
  at: number;
  code: string;
  kind: 'report' | 'customer' | 'sheet' | 'delete' | 'online' | 'offline';
  text: string;
}

export const DKEY = 'sokhach-device';
