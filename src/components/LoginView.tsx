import React, { useState } from 'react';
import { BrandMark } from './BrandMark';

interface LoginViewProps {
  codes: string[];
  onLogin: (code: string) => void;
  onEnterAdmin: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ codes, onLogin, onEnterAdmin }) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) {
      setError('Nhập mã nhân viên của bạn.');
      return;
    }
    if (trimmed === '0') {
      onEnterAdmin();
      return;
    }
    if (!codes.includes(trimmed)) {
      setError(`Mã ${trimmed} không có trong danh sách nhân viên. Kiểm tra lại mã.`);
      return;
    }
    onLogin(trimmed);
  };

  return (
    <div className="login">
      <div className="lcard">
        <BrandMark size="large" />
        <h1>Nhập mã nhân viên</h1>
        <p className="sub">Nhập mã số của bạn để vào trang báo cáo.</p>
        <form onSubmit={handleSubmit}>
          <input
            className="code"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            autoComplete="off"
            aria-label="Mã nhân viên"
            placeholder="•••"
            value={code}
            onChange={e => {
              setCode(e.target.value);
              setError('');
            }}
            autoFocus
          />
          <div className="err" role="alert">
            {error}
          </div>
          <button type="submit" className="btn wide">
            Vào trang báo cáo
          </button>
        </form>
      </div>
    </div>
  );
};
