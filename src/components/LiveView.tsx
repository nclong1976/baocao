import React, { useEffect, useMemo, useState } from 'react';
import { ActivityItem, Customer, LiveStatus, PresenceEntry, Report, StorageMode } from '../types';
import { dayKey, hm, nf } from '../utils';

interface LiveViewProps {
  codes: string[];
  customers: Customer[];
  reports: Report[];
  presence: PresenceEntry[];
  activity: ActivityItem[];
  live: LiveStatus;
  mode: StorageMode;
  lastSync: number;
  notifyOn: boolean;
  onToggleNotify: () => void;
  onOpenStaff: (code: string) => void;
}

const KIND_COLOR: Record<ActivityItem['kind'], string> = {
  report: 'var(--s-vao_tien)',
  customer: 'var(--s-phan_hoi)',
  sheet: 'var(--s-choi_giup)',
  delete: 'var(--s-chet)',
  online: 'var(--s-dang_noi)',
  offline: 'var(--s-moi)',
  dup: 'var(--s-chet)',
};

const ago = (t: number, now: number): string => {
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return 'vừa xong';
  if (s < 3600) return `${Math.floor(s / 60)} phút trước`;
  return hm(t);
};

export const LiveView: React.FC<LiveViewProps> = ({
  codes,
  customers,
  reports,
  presence,
  activity,
  live,
  mode,
  lastSync,
  notifyOn,
  onToggleNotify,
  onOpenStaff,
}) => {
  // Cập nhật nhãn "x phút trước" mỗi 30 giây.
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => setNow(Date.now()), [activity, presence]);

  const today = dayKey(now);
  const staffDevices = presence.filter(p => p.role === 'staff');
  const adminDevices = presence.filter(p => p.role === 'admin');

  const rows = useMemo(() => {
    const allCodes = Array.from(new Set([...codes, ...staffDevices.map(p => p.code)]));
    return allCodes.map(c => {
      const devices = staffDevices.filter(p => p.code === c);
      const report = reports.find(r => r.code === c && r.date === today);
      const posted = customers.filter(x => x.code === c && x.day === today).length;
      const last = activity.find(a => a.code === c && a.kind !== 'offline');
      return { code: c, devices, report, posted, last };
    });
  }, [codes, staffDevices, reports, customers, activity, today]);

  const onlineStaff = rows.filter(r => r.devices.length).length;
  const submitted = rows.filter(r => r.report && codes.includes(r.code)).length;
  const postedToday = customers.filter(x => x.day === today).length;

  const connText =
    mode === 'local'
      ? 'Chưa kết nối máy chủ'
      : live === 'live'
        ? 'Đang trực tiếp'
        : live === 'connecting'
          ? 'Đang kết nối…'
          : 'Mất kết nối, đang thử lại';
  const connColor = mode === 'local' ? 'var(--warn)' : live === 'live' ? 'var(--s-vao_tien)' : 'var(--s-chet)';

  return (
    <section>
      <div className="head row-sb">
        <div>
          <h1>TRỰC TIẾP</h1>
          <p className="sub">
            <span className="livedot" style={{ '--c': connColor } as React.CSSProperties} />
            {connText}
            {lastSync ? ` · cập nhật lúc ${hm(lastSync)}` : ''}
          </p>
        </div>
        <div className="ctrlrow">
          {'Notification' in window && (
            <button type="button" className={`btn ${notifyOn ? '' : 'ghost'}`} onClick={onToggleNotify}>
              {notifyOn ? 'Đang bật thông báo' : 'Bật thông báo trên máy này'}
            </button>
          )}
        </div>
      </div>

      {mode === 'local' && (
        <div className="panel warnbox">
          <h2>Các thiết bị chưa được nối với nhau</h2>
          <p className="sub">
            Ứng dụng đang lưu dữ liệu riêng trên từng máy. Điền địa chỉ và khoá Supabase vào <code>config.js</code> (hoặc
            biến môi trường khi build) để mọi điện thoại, máy tính của nhân viên gửi báo cáo về đây ngay lập tức. Xem
            hướng dẫn trong README.
          </p>
        </div>
      )}

      <div className="kgrid">
        <div className="kc" style={{ '--c': 'var(--s-vao_tien)' } as React.CSSProperties}>
          <span>Nhân viên đang trực tuyến</span>
          <b>
            {onlineStaff}/{codes.length}
          </b>
        </div>
        <div className="kc" style={{ '--c': 'var(--s-phan_hoi)' } as React.CSSProperties}>
          <span>Thiết bị đang kết nối</span>
          <b>{nf(presence.length)}</b>
        </div>
        <div className="kc" style={{ '--c': 'var(--s-dang_noi)' } as React.CSSProperties}>
          <span>Đã nộp báo cáo hôm nay</span>
          <b>
            {submitted}/{codes.length}
          </b>
        </div>
        <div className="kc" style={{ '--c': 'var(--s-choi_giup)' } as React.CSSProperties}>
          <span>Khách mới hôm nay</span>
          <b>{nf(postedToday)}</b>
        </div>
      </div>

      <div className="livegrid">
        <div className="panel">
          <div className="row-sb">
            <h2>Nhân viên</h2>
            <span className="sub">Bấm để xem chi tiết</span>
          </div>
          <div className="tw flat">
            <table>
              <thead>
                <tr>
                  <th>Nhân viên</th>
                  <th>Thiết bị đang mở</th>
                  <th>Đang xem</th>
                  <th>Báo cáo hôm nay</th>
                  <th className="num">Khách mới</th>
                  <th>Hoạt động gần nhất</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.code} className="click" onClick={() => onOpenStaff(r.code)}>
                    <td>
                      <span
                        className="livedot"
                        style={{ '--c': r.devices.length ? 'var(--s-vao_tien)' : 'var(--line)' } as React.CSSProperties}
                      />
                      <b>NV {r.code}</b>
                    </td>
                    <td>
                      {r.devices.length
                        ? r.devices.map(d => (
                            <div key={d.deviceId} className="devline">
                              {d.device} <span className="sub">· {d.browser}</span>
                            </div>
                          ))
                        : <span className="sub">Ngoại tuyến</span>}
                    </td>
                    <td>{r.devices.length ? Array.from(new Set(r.devices.map(d => d.view))).join(', ') : '—'}</td>
                    <td>
                      {r.report ? (
                        <span className="pill" style={{ '--c': 'var(--s-vao_tien)' } as React.CSSProperties}>
                          Đã nộp {hm(r.report.updatedAt)}
                        </span>
                      ) : (
                        <span className="pill" style={{ '--c': 'var(--s-chet)' } as React.CSSProperties}>
                          Chưa nộp
                        </span>
                      )}
                    </td>
                    <td className="num">{r.posted}</td>
                    <td className="sub">{r.last ? `${r.last.text} · ${ago(r.last.at, now)}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {adminDevices.length > 0 && (
            <p className="sub" style={{ marginTop: 10 }}>
              Quản lý đang mở trên: {adminDevices.map(d => `${d.device} (${d.browser})`).join(', ')}
            </p>
          )}
        </div>

        <div className="panel">
          <div className="row-sb">
            <h2>Hoạt động trực tiếp</h2>
            <span className="sub">Từ lúc mở trang này</span>
          </div>
          {activity.length === 0 ? (
            <div className="empty">
              {mode === 'local'
                ? 'Cần kết nối máy chủ để nhận hoạt động từ các thiết bị khác.'
                : 'Chưa có hoạt động mới. Khi nhân viên nộp báo cáo hay đăng khách, mục này tự hiện ngay.'}
            </div>
          ) : (
            <ul className="feed">
              {activity.map(a => (
                <li key={a.id} className={a.kind === 'dup' ? 'dup' : undefined} style={{ '--c': KIND_COLOR[a.kind] } as React.CSSProperties}>
                  <i />
                  <div>
                    <div>{a.text}</div>
                    <div className="sub">{ago(a.at, now)}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
};
