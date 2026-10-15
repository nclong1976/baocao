import React, { useState, useMemo } from 'react';
import { Customer } from '../types';
import { norm } from '../utils';
import { CustomerCard } from './CustomerCard';
import { store } from '../services/store';

interface HomeFeedViewProps {
  currentCode: string;
  customers: Customer[];
  codes: string[];
  onEditCustomer: (customer: Customer) => void;
  onToast: (msg: string) => void;
  onZoomPhoto: (url: string) => void;
}

export const HomeFeedView: React.FC<HomeFeedViewProps> = ({
  currentCode,
  customers,
  codes,
  onEditCustomer,
  onToast,
  onZoomPhoto,
}) => {
  const [query, setQuery] = useState('');
  const [selectedStaff, setSelectedStaff] = useState('');

  const filteredCustomers = useMemo(() => {
    const q = norm(query);
    return customers.filter(c => {
      const staffMatch = !selectedStaff || c.code === selectedStaff;
      if (!staffMatch) return false;
      if (!q) return true;
      const fullText = norm([c.name, c.job, c.addr, c.note].join(' '));
      return fullText.includes(q);
    });
  }, [customers, query, selectedStaff]);

  return (
    <div>
      <div className="head">
        <h1>Trang chủ</h1>
        <p className="sub">
          {customers.length} khách do cả đội đăng
          {filteredCustomers.length !== customers.length
            ? `, đang hiện ${filteredCustomers.length}`
            : ''}
        </p>
      </div>

      <div className="feedbar">
        <input
          type="search"
          placeholder="Tìm tên, nghề, địa chỉ"
          aria-label="Tìm khách"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <select
          aria-label="Lọc theo nhân viên"
          value={selectedStaff}
          onChange={e => setSelectedStaff(e.target.value)}
        >
          <option value="">Mọi nhân viên</option>
          {codes.map(c => (
            <option key={c} value={c}>
              NV {c}
            </option>
          ))}
        </select>
      </div>

      <div className="feed">
        {filteredCustomers.length === 0 ? (
          <div className="empty">
            {customers.length
              ? 'Không có khách khớp tìm kiếm.'
              : 'Chưa có khách nào. Khách mới cả đội đăng sẽ hiện ở đây.'}
          </div>
        ) : (
          filteredCustomers.map(c => (
            <CustomerCard
              key={c.id}
              customer={c}
              currentCode={currentCode}
              onEdit={onEditCustomer}
              onDelete={async id => {
                try {
                  await store.remove('customers', id);
                  if (c.photos) store.dropAssets(c.photos);
                  onToast(`Đã xoá ${c.name}`);
                } catch (e: any) {
                  onToast(e?.message || 'Lỗi khi xoá khách');
                }
              }}
              onZoomPhoto={onZoomPhoto}
            />
          ))
        )}
      </div>
    </div>
  );
};
