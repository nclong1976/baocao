import React from 'react';

interface BrandMarkProps {
  size?: 'normal' | 'large';
}

export const BrandMark: React.FC<BrandMarkProps> = ({ size = 'normal' }) => {
  return (
    <div className="brand">
      <span className="mark" aria-hidden="true" style={{ height: size === 'large' ? '28px' : '22px' }}>
        <i style={{ background: 'var(--s-moi)', width: size === 'large' ? '5px' : '4px', borderRadius: '2px' }} />
        <i style={{ background: 'var(--s-phan_hoi)', width: size === 'large' ? '5px' : '4px', borderRadius: '2px' }} />
        <i style={{ background: 'var(--s-dang_noi)', width: size === 'large' ? '5px' : '4px', borderRadius: '2px' }} />
        <i style={{ background: 'var(--s-choi_giup)', width: size === 'large' ? '5px' : '4px', borderRadius: '2px' }} />
        <i style={{ background: 'var(--s-vao_tien)', width: size === 'large' ? '5px' : '4px', borderRadius: '2px' }} />
        <i style={{ background: 'var(--s-chet)', width: size === 'large' ? '5px' : '4px', borderRadius: '2px' }} />
      </span>
      <span>Sổ Khách</span>
    </div>
  );
};
