import React, { useEffect } from 'react';

interface LightboxProps {
  src: string | null;
  onClose: () => void;
}

export const Lightbox: React.FC<LightboxProps> = ({ src, onClose }) => {
  useEffect(() => {
    if (!src) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [src, onClose]);

  if (!src) return null;

  return (
    <div
      className="lb"
      role="dialog"
      aria-label="Xem ảnh"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <img src={src} alt="Ảnh khách hàng" />
      <button className="x" aria-label="Đóng ảnh" onClick={onClose}>
        ×
      </button>
    </div>
  );
};
