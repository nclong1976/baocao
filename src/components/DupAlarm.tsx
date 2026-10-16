import React, { useEffect, useRef, useState } from 'react';
import { AlarmRequest, dismissAlarm, subscribeAlarm } from '../services/alarm';
import { fmtT } from '../utils';

export const DupAlarm: React.FC = () => {
  const [alarm, setAlarm] = useState<AlarmRequest | null>(null);
  const firstBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => subscribeAlarm(setAlarm), []);

  useEffect(() => {
    if (!alarm) return;
    firstBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismissAlarm();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [alarm]);

  if (!alarm) return null;
  const actions = alarm.actions?.length ? alarm.actions : [{ label: 'Đã hiểu', primary: true }];

  return (
    <div className="dupalarm" role="alertdialog" aria-modal="true" aria-labelledby="dupalarm-title">
      <div className="dupalarm-card">
        <div className="dupalarm-head">
          <span className="dupalarm-icon" aria-hidden="true">!</span>
          <div>
            <h2 id="dupalarm-title">{alarm.title}</h2>
            <p>{alarm.message}</p>
          </div>
        </div>

        <ul className="duplist">
          {alarm.matches.slice(0, 6).map(m => (
            <li key={m.source + m.id}>
              <div className="row-sb">
                <b>
                  {m.name}
                  {m.birth ? ` · ${m.birth}` : ''}
                </b>
                <span className={`duplevel ${m.level}`}>{m.level === 'exact' ? 'Trùng khớp' : 'Có thể trùng'}</span>
              </div>
              <div className="sub">
                NV {m.code} · {m.source === 'customers' ? 'đăng khách mới' : 'danh sách khách hàng'}
                {m.at ? ` lúc ${fmtT(m.at)}` : ''}
                {m.addr ? ` · ${m.addr}` : ''}
              </div>
              <div className="sub">{m.reasons.join(', ')}</div>
            </li>
          ))}
          {alarm.matches.length > 6 && <li className="sub">… và {alarm.matches.length - 6} khách khác</li>}
        </ul>

        <div className="row-e">
          {actions.map((a, i) => (
            <button
              key={a.label}
              ref={i === 0 ? firstBtn : undefined}
              type="button"
              className={`btn ${a.primary ? 'danger' : 'ghost'}`}
              onClick={() => {
                dismissAlarm();
                a.onClick?.();
              }}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
