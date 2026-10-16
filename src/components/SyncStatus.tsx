import React from 'react';
import { LiveStatus, StorageMode } from '../types';

interface SyncStatusProps {
  mode: StorageMode;
  live?: LiveStatus;
}

export const SyncStatus: React.FC<SyncStatusProps> = ({ mode, live }) => {
  const info: Record<StorageMode, { text: string; color: string }> = {
    loading: { text: 'Đang kết nối…', color: 'var(--muted)' },
    cloud: { text: 'Đã kết nối thời gian thực, dữ liệu dùng chung với cả đội', color: 'var(--s-vao_tien)' },
    local: { text: 'Đang lưu tạm trên máy này, cả đội chưa xem được', color: 'var(--warn)' },
    error: { text: 'Mất kết nối dữ liệu. Tải lại trang để tiếp tục', color: 'var(--s-chet)' },
  };

  let current = info[mode] || info.local;
  if (mode === 'cloud' && live === 'connecting') {
    current = { text: 'Đang kết nối thời gian thực…', color: 'var(--muted)' };
  } else if (mode === 'cloud' && live === 'offline') {
    current = { text: 'Mất mạng, đang thử kết nối lại. Dữ liệu sẽ tự cập nhật khi có mạng', color: 'var(--warn)' };
  }

  return (
    <div className={`sync${mode === 'cloud' && live === 'live' ? ' on' : ''}`} style={{ '--c': current.color } as React.CSSProperties}>
      <i />
      <span>{current.text}</span>
    </div>
  );
};
