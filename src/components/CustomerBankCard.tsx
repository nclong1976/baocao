import React, { useState } from 'react';
import { Customer, RATING_MAP } from '../types';
import { fmtT, imgSrc, pad } from '../utils';

interface CustomerBankCardProps {
  customer: Customer;
  currentCode?: string | null;
  onEdit?: (customer: Customer) => void;
  onDelete?: (id: string) => void;
  onZoomPhoto?: (url: string) => void;
}

// Nền dự phòng khi khách chưa có ảnh, chọn theo mã nhân viên để mỗi người một màu.
const FALLBACK_BG = [
  'linear-gradient(135deg, #1F4E8C 0%, #0B1A2E 100%)',
  'linear-gradient(135deg, #0E8E65 0%, #08392B 100%)',
  'linear-gradient(135deg, #8656CC 0%, #2A1747 100%)',
  'linear-gradient(135deg, #D8900C 0%, #4A2B00 100%)',
  'linear-gradient(135deg, #C1443C 0%, #3D0F0C 100%)',
  'linear-gradient(135deg, #2C7BE5 0%, #0A2448 100%)',
];

function fallbackBg(code: string): string {
  let h = 0;
  for (const ch of code) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return FALLBACK_BG[h % FALLBACK_BG.length];
}

export const CustomerBankCard: React.FC<CustomerBankCardProps> = ({
  customer,
  currentCode,
  onEdit,
  onDelete,
  onZoomPhoto,
}) => {
  const [delArmed, setDelArmed] = useState(false);
  const own = customer.code === currentCode;
  const ratingInfo = customer.rating ? RATING_MAP[customer.rating] : null;
  const photos = (customer.photos || []).map(imgSrc);
  const cover = photos[0];
  const created = new Date(customer.createdAt);
  const family = [customer.marital, customer.kids ? `Con: ${customer.kids}` : ''].filter(Boolean).join(' · ');

  const handleDelete = () => {
    if (!delArmed) {
      setDelArmed(true);
      setTimeout(() => setDelArmed(false), 3500);
      return;
    }
    setDelArmed(false);
    onDelete?.(customer.id);
  };

  return (
    <article className={`bcard-wrap ${own ? 'mine' : ''}`}>
      <div
        className={`bcard ${cover ? 'has-photo' : ''}`}
        style={{ background: cover ? undefined : fallbackBg(customer.code) }}
        role={cover ? 'button' : undefined}
        tabIndex={cover ? 0 : undefined}
        aria-label={cover ? `Xem ảnh ${customer.name}` : undefined}
        onClick={() => cover && onZoomPhoto?.(cover)}
        onKeyDown={e => {
          if (cover && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onZoomPhoto?.(cover);
          }
        }}
      >
        {cover && <img className="bcard-bg" src={cover} alt="" loading="lazy" />}
        <div className="bcard-shade" />

        <div className="bcard-top">
          <span className="bcard-brand">SỔ KHÁCH</span>
          {ratingInfo && (
            <span className="bcard-rating" style={{ '--c': `var(${ratingInfo[1]})` } as React.CSSProperties}>
              {ratingInfo[0]}
            </span>
          )}
        </div>

        <div className="bcard-mid">
          <span className="bcard-chip" aria-hidden="true" />
          <span className="bcard-number">
            {customer.job || 'Chưa rõ nghề'}
            {customer.birth ? `  ·  ${customer.birth}` : ''}
          </span>
          {customer.addr && <span className="bcard-addr">{customer.addr}</span>}
        </div>

        <div className="bcard-bottom">
          <div className="bcard-holder">
            <small>Khách hàng</small>
            <b>{customer.name}</b>
          </div>
          <div className="bcard-valid">
            <small>Ngày đăng</small>
            <b>
              {pad(created.getDate())}/{pad(created.getMonth() + 1)}/{String(created.getFullYear()).slice(2)}
            </b>
          </div>
        </div>

        {photos.length > 1 && <span className="bcard-count">{photos.length} ảnh</span>}
      </div>

      {(family || customer.note || photos.length > 1) && (
        <div className="bcard-info">
          {family && <p>{family}</p>}
          {customer.note && <p className="note">{customer.note}</p>}
          {photos.length > 1 && (
            <div className="bcard-thumbs">
              {photos.map((url, i) => (
                <img
                  key={i}
                  src={url}
                  loading="lazy"
                  alt={`Ảnh ${i + 1} của ${customer.name}`}
                  onClick={() => onZoomPhoto?.(url)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <div className="bcard-foot">
        <span>
          NV {customer.code}
          {own ? ' (bạn)' : ''} · {fmtT(customer.createdAt)}
        </span>
        {own && (
          <span>
            {onEdit && (
              <button type="button" className="linkbtn" onClick={() => onEdit(customer)}>
                Sửa
              </button>
            )}
            {onDelete && (
              <button type="button" className="linkbtn" onClick={handleDelete}>
                {delArmed ? 'Bấm lần nữa để xoá' : 'Xoá'}
              </button>
            )}
          </span>
        )}
      </div>
    </article>
  );
};
