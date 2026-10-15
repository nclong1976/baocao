import React from 'react';
import { StorageMode } from '../types';

interface SyncStatusProps {
  mode: StorageMode;
}

export const SyncStatus: React.FC<SyncStatusProps> = ({ mode }) => {
  const info: Record<StorageMode, { text: string; color: string }> = {
    loading: { text: 'Đang kết nối…', color: 'var(--muted)' },
    cloud: { text: 'Dữ liệu dùng chung với cả đội', color: 'var(--s-vao_tien)' },
    local: { text: 'Đang lưu tạm trên máy này, cả đội chưa xem được', color: 'var(--warn)' },
    error: { text: 'Mất kết nối dữ liệu. Tải lại trang để tiếp tục', color: 'var(--s-chet)' },
  };

  const current = info[mode] || info.local;

  return (
    <div className="sync" style={{ '--c': current.color } as React.CSSProperties}>
      <i />
      <span>{current.text}</span>
    </div>
  );
};
