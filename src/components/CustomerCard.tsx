import React, { useState } from 'react';
import { Customer, RATING_MAP } from '../types';
import { fmtT, imgSrc } from '../utils';

interface CustomerCardProps {
  customer: Customer;
  currentCode?: string | null;
  isAdmin?: boolean;
  onEdit?: (customer: Customer) => void;
  onDelete?: (id: string) => void;
  onZoomPhoto?: (url: string) => void;
}

export const CustomerCard: React.FC<CustomerCardProps> = ({
  customer,
  currentCode,
  isAdmin = false,
  onEdit,
  onDelete,
  onZoomPhoto,
}) => {
  const [delArmed, setDelArmed] = useState(false);
  const own = !isAdmin && customer.code === currentCode;
  const ratingInfo = customer.rating ? RATING_MAP[customer.rating] : null;

  const facts = [
    customer.birth ? `Sinh ${customer.birth}` : '',
    customer.job,
    customer.marital,
    customer.kids ? `Con cái: ${customer.kids}` : '',
  ]
    .filter(Boolean)
    .join(', ');

  const handleDeleteClick = () => {
    if (!delArmed) {
      setDelArmed(true);
      setTimeout(() => {
        setDelArmed(false);
      }, 3500);
      return;
    }
    setDelArmed(false);
    onDelete?.(customer.id);
  };

  return (
    <article className={`ccard ${own ? 'mine' : ''}`}>
      <div className="row-sb">
        <h3>{customer.name}</h3>
        {ratingInfo && (
          <span className="badge" style={{ '--c': `var(${ratingInfo[1]})` } as React.CSSProperties}>
            <i />
            {ratingInfo[0]}
          </span>
        )}
      </div>

      {facts && <p className="facts">{facts}</p>}
      {customer.addr && <p className="addr">{customer.addr}</p>}
      {customer.note && <p className="note">{customer.note}</p>}

      {customer.photos && customer.photos.length > 0 && (
        <div className="cphotos">
          {customer.photos.map((ref, i) => {
            const url = imgSrc(ref);
            return (
              <img
                key={i}
                src={url}
                loading="lazy"
                alt={`Ảnh ${i + 1} của ${customer.name}`}
                onClick={() => onZoomPhoto?.(url)}
                onError={e => {
                  (e.target as HTMLElement).style.visibility = 'hidden';
                }}
              />
            );
          })}
        </div>
      )}

      <div className="cfoot">
        <span>
          NV {customer.code}
          {own ? ' (bạn)' : ''}, {fmtT(customer.createdAt)}
        </span>
        {(own || isAdmin) && (
          <span>
            {own && onEdit && (
              <button type="button" className="linkbtn" onClick={() => onEdit(customer)}>
                Sửa
              </button>
            )}
            {onDelete && (
              <button type="button" className="linkbtn" onClick={handleDeleteClick}>
                {delArmed ? 'Bấm lần nữa để xoá' : 'Xoá'}
              </button>
            )}
          </span>
        )}
      </div>
    </article>
  );
};
