import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Customer, Report, SheetCustomer, R_FIELDS, DSTAT, STAGES, ActivityItem, LiveStatus, PresenceEntry, StorageMode } from '../types';
import { BrandMark } from './BrandMark';
import { SyncStatus } from './SyncStatus';
import { CustomerCard } from './CustomerCard';
import { SpreadsheetView } from './SpreadsheetView';
import { LiveView } from './LiveView';
import { store } from '../services/store';
import { duplicateGroups } from '../services/dupcheck';
import { raiseAlarm } from '../services/alarm';
import {
  dayKey,
  dm,
  hm,
  money,
  nf,
  pct,
  curMonth,
  monthLabel,
  daysIn,
  elapsed,
  norm,
} from '../utils';

interface AdminViewProps {
  codes: string[];
  customers: Customer[];
  reports: Report[];
  sheet: SheetCustomer[];
  live: LiveStatus;
  mode: StorageMode;
  presence: PresenceEntry[];
  activity: ActivityItem[];
  lastSync: number;
  onLogout: () => void;
  onToast: (msg: string) => void;
  onZoomPhoto: (url: string) => void;
}

type AdminTab = 'live' | 'dups' | 'day' | 'month' | 'staff' | 'cust' | 'list' | 'codes';

const TAB_NAMES: Record<AdminTab, string> = {
  live: 'Trực tiếp',
  dups: 'Khách trùng',
  day: 'Báo cáo ngày',
  month: 'Theo tháng',
  staff: 'Từng nhân viên',
  cust: 'Khách mới',
  list: 'Danh sách khách hàng',
  codes: 'Mã nhân viên',
};

const NKEY = 'sokhach-notify';

const SHORT_NAMES: Record<string, string> = {
  scraped: 'Cào',
  phanHoi: 'Phản hồi',
  moi: 'Khách mới',
  dangNoi: 'Đang nói',
  choiGiup: 'Chơi giúp',
  vaoTien: 'Vào tiền',
  chet: 'Chết',
  tongData: 'Data nhận',
  conLai: 'Còn lại',
  tinhTrang: 'Tình trạng data',
  tongThang: 'Tổng tháng',
};

export const AdminView: React.FC<AdminViewProps> = ({
  codes,
  customers,
  reports,
  sheet,
  live,
  mode,
  presence,
  activity,
  lastSync,
  onLogout,
  onToast,
  onZoomPhoto,
}) => {
  const [tab, setTab] = useState<AdminTab>('live');
  const [notifyOn, setNotifyOn] = useState<boolean>(() => {
    try {
      return localStorage.getItem(NKEY) === '1' && 'Notification' in window && Notification.permission === 'granted';
    } catch (e) {
      return false;
    }
  });

  useEffect(() => {
    store.identify({ role: 'admin', code: '0', view: TAB_NAMES[tab] });
  }, [tab]);
  useEffect(() => () => store.identify(null), []);

  // Báo ngay khi nhân viên nộp báo cáo hoặc đăng khách, kể cả khi đang ở tab khác.
  const seenActivity = useRef<string | null>(activity[0]?.id ?? null);
  useEffect(() => {
    const head = activity[0];
    if (!head || head.id === seenActivity.current) return;
    const fresh: ActivityItem[] = [];
    for (const a of activity) {
      if (a.id === seenActivity.current) break;
      fresh.push(a);
    }
    seenActivity.current = head.id;
    const dups = fresh.filter(a => a.kind === 'dup');
    if (dups.length) {
      raiseAlarm({
        title: 'NHÂN VIÊN VỪA NHẬP KHÁCH TRÙNG',
        message: dups.map(a => a.text).join('\n'),
        matches: dups.flatMap(a => a.matches || []),
        actions: [
          { label: 'Đã hiểu', primary: true },
          { label: 'Xem danh sách khách trùng', onClick: () => setTab('dups') },
        ],
      });
      if (notifyOn && document.visibilityState !== 'visible') {
        dups.forEach(a => {
          try {
            new Notification('Sổ Khách: khách trùng', { body: a.text, tag: a.id, requireInteraction: true });
          } catch (e) {}
        });
      }
    }
    const important = fresh.filter(a => a.kind === 'report' || a.kind === 'customer');
    if (!important.length) return;
    onToast(important[0].text);
    if (notifyOn && document.visibilityState !== 'visible') {
      important.slice(0, 3).forEach(a => {
        try {
          new Notification('Sổ Khách', { body: a.text, tag: a.id });
        } catch (e) {}
      });
    }
  }, [activity, notifyOn, onToast]);

  const handleToggleNotify = async () => {
    if (notifyOn) {
      setNotifyOn(false);
      try {
        localStorage.removeItem(NKEY);
      } catch (e) {}
      return;
    }
    const perm = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    if (perm !== 'granted') {
      onToast('Trình duyệt chưa cho phép thông báo. Mở cài đặt trang để cho phép.');
      return;
    }
    setNotifyOn(true);
    try {
      localStorage.setItem(NKEY, '1');
    } catch (e) {}
    onToast('Máy này sẽ báo khi nhân viên nộp báo cáo hoặc đăng khách');
  };
  const [selectedDate, setSelectedDate] = useState(() => dayKey(Date.now()));
  const [selectedMonth, setSelectedMonth] = useState(() => dayKey(Date.now()).slice(0, 7));
  const [selectedStaff, setSelectedStaff] = useState<string>(() => codes[0] || '1');

  // Filters for tabs
  const [custQuery, setCustQuery] = useState('');
  const [custStaffFilter, setCustStaffFilter] = useState('');
  const [custDateFilter, setCustDateFilter] = useState('');

  const [listStaffFilter, setListStaffFilter] = useState('');

  const [newCodeInput, setNewCodeInput] = useState('');
  const [delArmedCode, setDelArmedCode] = useState<string | null>(null);

  // Month options (last 12 months)
  const monthOptions = useMemo(() => {
    const list: string[] = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      list.push(m);
    }
    if (selectedMonth && !list.includes(selectedMonth)) list.push(selectedMonth);
    return list;
  }, [selectedMonth]);

  // Reports for selected month
  const monthReportsList = useMemo(() => {
    return reports.filter(r => r.date && r.date.slice(0, 7) === selectedMonth);
  }, [reports, selectedMonth]);

  // Day data
  const dayReportsMap = useMemo(() => {
    const map: Record<string, Report> = {};
    reports
      .filter(r => r.date === selectedDate)
      .forEach(r => {
        if (codes.includes(r.code)) map[r.code] = r;
      });
    return map;
  }, [reports, selectedDate, codes]);

  const daySubmittedStaff = useMemo(() => {
    return codes.filter(c => !!dayReportsMap[c]);
  }, [codes, dayReportsMap]);

  const dayMissingStaff = useMemo(() => {
    return codes.filter(c => !dayReportsMap[c]);
  }, [codes, dayReportsMap]);

  const dayTotals = useMemo(() => {
    const t: Record<string, number> = {};
    const numFields = ['scraped', 'phanHoi', 'moi', 'dangNoi', 'choiGiup', 'vaoTien', 'chet', 'tongData', 'conLai', 'tongThang'];
    numFields.forEach(k => (t[k] = 0));
    daySubmittedStaff.forEach(c => {
      const r = dayReportsMap[c] as any;
      if (r) {
        numFields.forEach(k => (t[k] += Number(r[k]) || 0));
      }
    });
    return t;
  }, [daySubmittedStaff, dayReportsMap]);

  const dayStatusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    DSTAT.forEach(s => (counts[s] = 0));
    daySubmittedStaff.forEach(c => {
      const s = dayReportsMap[c]?.tinhTrang;
      if (s) counts[s] = (counts[s] || 0) + 1;
    });
    return counts;
  }, [daySubmittedStaff, dayReportsMap]);

  const daySummaryText = useMemo(() => {
    const out = [`TỔNG HỢP NGÀY ${dm(selectedDate)} (${daySubmittedStaff.length}/${codes.length} nhân viên đã nộp)`, ''];
    R_FIELDS.forEach(([k, label, , isChip]) => {
      if (isChip) {
        const text = DSTAT.filter(s => dayStatusCounts[s]).map(s => `${s} ${dayStatusCounts[s]}`).join(', ') || '—';
        out.push(`- ${label} : ${text}`);
      } else {
        out.push(`- ${label} : ${dayTotals[k] || 0}`);
      }
    });
    if (daySubmittedStaff.length) {
      out.push('', 'Từng nhân viên:');
      daySubmittedStaff.forEach(c => {
        const r = dayReportsMap[c];
        out.push(
          `NV ${c}: cào ${r.scraped}, phản hồi ${r.phanHoi}, khách mới ${r.moi}, vào tiền ${r.vaoTien}, chết ${r.chet}, còn lại ${r.conLai}`
        );
      });
    }
    if (dayMissingStaff.length) {
      out.push('', 'Chưa nộp: ' + dayMissingStaff.map(c => 'NV ' + c).join(', '));
    }
    return out.join('\n');
  }, [selectedDate, daySubmittedStaff, codes.length, dayStatusCounts, dayTotals, dayReportsMap, dayMissingStaff]);

  const handleCopyDayText = async () => {
    try {
      await navigator.clipboard.writeText(daySummaryText);
      onToast('Đã sao chép bản tổng hợp');
    } catch (e) {
      onToast('Trình duyệt chặn sao chép, thử lại trên máy khác');
    }
  };

  // Month aggregations
  const elapsedDays = elapsed(selectedMonth);
  const monthRows = monthReportsList.filter(r => codes.includes(r.code));
  const latestReportByStaff = useMemo(() => {
    const m: Record<string, Report> = {};
    monthRows.forEach(r => {
      if (!m[r.code] || r.date > m[r.code].date) m[r.code] = r;
    });
    return m;
  }, [monthRows]);

  const monthTotals = useMemo(() => {
    const t: Record<string, number> = {};
    const numFields = ['scraped', 'phanHoi', 'moi', 'dangNoi', 'choiGiup', 'vaoTien', 'chet', 'tongData', 'conLai', 'tongThang'];
    numFields.forEach(k => (t[k] = 0));
    monthRows.forEach(r => {
      numFields.forEach(k => (t[k] += Number((r as any)[k]) || 0));
    });
    return t;
  }, [monthRows]);

  const monthTongData = useMemo(() => {
    return Object.values(latestReportByStaff).reduce((sum, r) => sum + (Number(r.tongData) || 0), 0);
  }, [latestReportByStaff]);

  const monthConLai = useMemo(() => {
    return Object.values(latestReportByStaff).reduce((sum, r) => sum + (Number(r.conLai) || 0), 0);
  }, [latestReportByStaff]);

  // Chart data for month
  const monthChartData = useMemo(() => {
    const labels: string[] = [];
    const scrapedArr: number[] = [];
    const vaoTienArr: number[] = [];

    for (let i = 1; i <= elapsedDays; i++) {
      const k = `${selectedMonth}-${String(i).padStart(2, '0')}`;
      const rs = monthRows.filter(r => r.date === k);
      labels.push(`${String(i).padStart(2, '0')}/${selectedMonth.slice(5)}`);
      scrapedArr.push(rs.reduce((acc, r) => acc + (Number(r.scraped) || 0), 0));
      vaoTienArr.push(rs.reduce((acc, r) => acc + (Number(r.vaoTien) || 0), 0));
    }
    return { labels, scrapedArr, vaoTienArr };
  }, [elapsedDays, selectedMonth, monthRows]);

  // Staff monthly table data
  const staffMonthPerformance = useMemo(() => {
    return codes
      .map(c => {
        const rs = monthRows.filter(r => r.code === c);
        const t: Record<string, number> = {};
        ['scraped', 'phanHoi', 'moi', 'dangNoi', 'choiGiup', 'vaoTien', 'chet'].forEach(k => {
          t[k] = rs.reduce((acc, r) => acc + (Number((r as any)[k]) || 0), 0);
        });
        const l = latestReportByStaff[c];
        const td = l ? Number(l.tongData) || 0 : 0;
        const cl = l ? Number(l.conLai) || 0 : 0;
        const posted = customers.filter(x => x.code === c && x.day && x.day.slice(0, 7) === selectedMonth).length;
        return {
          code: c,
          submittedCount: rs.length,
          t,
          td,
          cl,
          conversionRate: td ? t.vaoTien / td : null,
          posted,
        };
      })
      .sort((a, b) => b.t.vaoTien - a.t.vaoTien);
  }, [codes, monthRows, latestReportByStaff, customers, selectedMonth]);

  // Staff tab details
  const activeStaffMonthRows = useMemo(() => {
    return monthReportsList.filter(r => r.code === selectedStaff);
  }, [monthReportsList, selectedStaff]);

  const activeStaffMap = useMemo(() => {
    const map: Record<string, Report> = {};
    activeStaffMonthRows.forEach(r => (map[r.date] = r));
    return map;
  }, [activeStaffMonthRows]);

  const activeStaffTotals = useMemo(() => {
    const t: Record<string, number> = {};
    ['scraped', 'phanHoi', 'moi', 'dangNoi', 'choiGiup', 'vaoTien', 'chet'].forEach(k => {
      t[k] = activeStaffMonthRows.reduce((acc, r) => acc + (Number((r as any)[k]) || 0), 0);
    });
    return t;
  }, [activeStaffMonthRows]);

  const activeStaffLastReport = useMemo(() => {
    return activeStaffMonthRows.slice().sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  }, [activeStaffMonthRows]);

  const activeStaffPostedCustomers = useMemo(() => {
    return customers.filter(x => x.code === selectedStaff && x.day && x.day.slice(0, 7) === selectedMonth);
  }, [customers, selectedStaff, selectedMonth]);

  const activeStaffChartData = useMemo(() => {
    const labels: string[] = [];
    const a: number[] = [];
    const b: number[] = [];
    for (let i = 1; i <= elapsedDays; i++) {
      const k = `${selectedMonth}-${String(i).padStart(2, '0')}`;
      labels.push(`${String(i).padStart(2, '0')}/${selectedMonth.slice(5)}`);
      a.push(activeStaffMap[k] ? Number(activeStaffMap[k].scraped) || 0 : 0);
      b.push(activeStaffMap[k] ? Number(activeStaffMap[k].vaoTien) || 0 : 0);
    }
    return { labels, a, b };
  }, [elapsedDays, selectedMonth, activeStaffMap]);

  // All customers tab filter
  const filteredAllCustomers = useMemo(() => {
    const q = norm(custQuery);
    return customers.filter(c => {
      if (custStaffFilter && c.code !== custStaffFilter) return false;
      if (custDateFilter && c.day !== custDateFilter) return false;
      if (!q) return true;
      return norm([c.name, c.job, c.addr, c.note].join(' ')).includes(q);
    });
  }, [customers, custQuery, custStaffFilter, custDateFilter]);

  // Matrix data for Sheet tab
  const sheetStaffList = useMemo(() => {
    return Array.from(new Set([...codes, ...sheet.map(r => r.code)]));
  }, [codes, sheet]);

  const dupGroups = useMemo(() => duplicateGroups(customers, sheet), [customers, sheet]);

  // Codes management handlers
  const handleAddCode = async () => {
    const trimmed = newCodeInput.trim();
    if (!/^\d{1,6}$/.test(trimmed)) {
      onToast('Mã nhân viên chỉ gồm chữ số (tối đa 6 số)');
      return;
    }
    if (trimmed === '0') {
      onToast('Mã 0 dành riêng cho trang quản lý');
      return;
    }
    if (codes.includes(trimmed)) {
      onToast('Mã ' + trimmed + ' đã có trong danh sách');
      return;
    }
    try {
      await store.saveStaffCodes([...codes, trimmed]);
      setNewCodeInput('');
      onToast('Đã thêm mã ' + trimmed);
    } catch (e: any) {
      onToast(e?.message || 'Lỗi khi thêm mã');
    }
  };

  const handleRemoveCode = async (c: string) => {
    if (delArmedCode !== c) {
      setDelArmedCode(c);
      setTimeout(() => {
        setDelArmedCode(curr => (curr === c ? null : curr));
      }, 3500);
      return;
    }
    setDelArmedCode(null);
    if (codes.length <= 1) {
      onToast('Cần giữ lại ít nhất một mã');
      return;
    }
    try {
      await store.saveStaffCodes(codes.filter(x => x !== c));
      onToast(`Đã xoá mã ${c}. Báo cáo cũ của mã này vẫn được giữ.`);
    } catch (e: any) {
      onToast(e?.message || 'Lỗi khi xoá mã');
    }
  };

  // Line chart SVG component
  const renderLineChart = (labels: string[], a: number[], b: number[]) => {
    const n = labels.length;
    if (n < 2) return <div className="empty">Chưa đủ ngày để vẽ biểu đồ.</div>;
    const W = 640;
    const H = 220;
    const P = { l: 34, r: 10, t: 12, b: 26 };
    const maxVal = Math.max(4, Math.ceil(Math.max(...a, ...b) / 4) * 4);
    const xCoord = (i: number) => P.l + (i * (W - P.l - P.r)) / (n - 1);
    const yCoord = (v: number) => H - P.b - (v * (H - P.t - P.b)) / maxVal;

    const linePath = (arr: number[]) =>
      arr.map((v, i) => `${i ? 'L' : 'M'}${xCoord(i).toFixed(1)} ${yCoord(v).toFixed(1)}`).join(' ');

    const step = Math.max(1, Math.ceil(n / 7));

    return (
      <>
        <div className="lg">
          <span style={{ '--c': 'var(--ink)' } as React.CSSProperties}>
            <i />
            Số lượng cào
          </span>
          <span style={{ '--c': 'var(--s-vao_tien)' } as React.CSSProperties}>
            <i />
            Khách vào tiền
          </span>
        </div>
        <svg
          className="chart"
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label="Biểu đồ số lượng cào và khách vào tiền theo ngày"
        >
          {[0, 1, 2, 3, 4].map(k => {
            const v = (maxVal * k) / 4;
            return (
              <g key={k}>
                <line x1={P.l} x2={W - P.r} y1={yCoord(v)} y2={yCoord(v)} stroke="var(--line)" />
                <text x={P.l - 6} y={yCoord(v) + 3.5} textAnchor="end">
                  {v}
                </text>
              </g>
            );
          })}
          {labels.map((lbl, i) => {
            if (i % step !== 0) return null;
            return (
              <text key={i} x={xCoord(i)} y={H - 8} textAnchor="middle">
                {lbl}
              </text>
            );
          })}
          <path
            d={`${linePath(a)} L${xCoord(n - 1)} ${yCoord(0)} L${xCoord(0)} ${yCoord(0)} Z`}
            fill="var(--ink)"
            opacity={0.06}
          />
          <path d={linePath(a)} fill="none" stroke="var(--ink)" strokeWidth={2} strokeLinejoin="round" />
          <path
            d={linePath(b)}
            fill="none"
            stroke="var(--s-vao_tien)"
            strokeWidth={2.5}
            strokeLinejoin="round"
          />
          {a.map((v, i) => (
            <circle key={i} cx={xCoord(i)} cy={yCoord(v)} r={7} fill="transparent">
              <title>{`${labels[i]}: cào ${v}, vào tiền ${b[i]}`}</title>
            </circle>
          ))}
        </svg>
      </>
    );
  };

  return (
    <div className="admin">
      <header className="top">
        <div className="topin">
          <div className="row-sb">
            <BrandMark />
            <div className="me">
              <b>Quản lý</b>
              <button type="button" className="linkbtn" onClick={onLogout}>
                Thoát
              </button>
            </div>
          </div>
          <nav className="tabs" role="tablist">
            {(Object.keys(TAB_NAMES) as AdminTab[]).map(k => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>
                {TAB_NAMES[k]}
                {k === 'dups' && dupGroups.length > 0 && (
                  <span className="tabcount danger">{dupGroups.length}</span>
                )}
                {k === 'live' && mode === 'cloud' && (
                  <span className="tabcount">{presence.filter(p => p.role === 'staff').length}</span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main>
        <SyncStatus mode={mode} live={live} />

        {tab === 'dups' && (
          <section>
            <div className="head">
              <h1>KHÁCH TRÙNG</h1>
              <p className="sub">
                {dupGroups.length
                  ? `${dupGroups.length} nhóm khách có cùng họ tên (và không khác năm sinh) do nhiều lần nhập hoặc nhiều nhân viên cùng nhập`
                  : 'Chưa phát hiện khách nào bị trùng.'}
              </p>
            </div>
            {dupGroups.map(g => (
              <div key={g.key} className="panel dupgroup">
                <div className="row-sb">
                  <h2>{g.items[0].name}</h2>
                  <span className="pill" style={{ '--c': 'var(--s-chet)' } as React.CSSProperties}>
                    {g.items.length} lần · {new Set(g.items.map(i => i.code)).size} nhân viên
                  </span>
                </div>
                <div className="tw flat">
                  <table>
                    <thead>
                      <tr>
                        <th>Nhân viên</th>
                        <th>Nguồn</th>
                        <th>Năm sinh</th>
                        <th>Nơi ở</th>
                        <th>Nghề</th>
                        <th>Thời điểm nhập</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.items.map(it => (
                        <tr
                          key={it.source + it.id}
                          className="click"
                          onClick={() => {
                            setSelectedStaff(it.code);
                            setTab('staff');
                          }}
                        >
                          <td>
                            <b>NV {it.code}</b>
                          </td>
                          <td>{it.source === 'customers' ? 'Khách mới' : 'Danh sách khách hàng'}</td>
                          <td>{it.birth || '—'}</td>
                          <td>{it.addr || '—'}</td>
                          <td>{it.job || '—'}</td>
                          <td>{it.at ? `${hm(it.at)} ${dm(dayKey(it.at))}` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </section>
        )}

        {tab === 'live' && (
          <LiveView
            codes={codes}
            customers={customers}
            reports={reports}
            presence={presence}
            activity={activity}
            live={live}
            mode={mode}
            lastSync={lastSync}
            notifyOn={notifyOn}
            onToggleNotify={handleToggleNotify}
            onOpenStaff={c => {
              setSelectedStaff(c);
              setTab('staff');
            }}
          />
        )}

        {/* TAB 1: BÁO CÁO NGÀY */}
        {tab === 'day' && (
          <section>
            <div className="head row-sb">
              <div>
                <h1>NGÀY {dm(selectedDate)}</h1>
                <p className="sub">
                  {daySubmittedStaff.length}/{codes.length} nhân viên đã nộp báo cáo
                </p>
              </div>
              <div className="ctrlrow">
                <input
                  type="date"
                  aria-label="Chọn ngày"
                  value={selectedDate}
                  onChange={e => {
                    if (e.target.value) setSelectedDate(e.target.value);
                  }}
                />
                <button type="button" className="btn ghost" onClick={handleCopyDayText}>
                  Sao chép tổng hợp
                </button>
              </div>
            </div>

            <div className="panel">
              <div className="row-sb">
                <h2>Tình hình nộp báo cáo</h2>
                <span className="sub">Bấm tên để xem chi tiết nhân viên</span>
              </div>
              <div className="subm">
                {daySubmittedStaff.map(c => (
                  <button
                    key={c}
                    type="button"
                    className="pill"
                    style={{ '--c': 'var(--s-vao_tien)' } as React.CSSProperties}
                    onClick={() => {
                      setSelectedStaff(c);
                      setTab('staff');
                    }}
                  >
                    NV {c}, nộp {hm(dayReportsMap[c].updatedAt)}
                  </button>
                ))}
                {dayMissingStaff.map(c => (
                  <button
                    key={c}
                    type="button"
                    className="pill"
                    style={{ '--c': 'var(--s-chet)' } as React.CSSProperties}
                    onClick={() => {
                      setSelectedStaff(c);
                      setTab('staff');
                    }}
                  >
                    NV {c} chưa nộp
                  </button>
                ))}
              </div>
            </div>

            <div className="kgrid">
              {R_FIELDS.map(([k, label, colorVar, isChip]) => {
                if (isChip) {
                  const tsText =
                    DSTAT.filter(s => dayStatusCounts[s])
                      .map(s => `${s} ${dayStatusCounts[s]}`)
                      .join(', ') || '—';
                  return (
                    <div key={k} className="kc">
                      <span>{label}</span>
                      <b>
                        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)' }}>
                          {tsText}
                        </span>
                      </b>
                    </div>
                  );
                }
                return (
                  <div
                    key={k}
                    className="kc"
                    style={colorVar ? ({ '--c': `var(--s-${colorVar})` } as React.CSSProperties) : undefined}
                  >
                    <span>{label}</span>
                    <b>{nf(dayTotals[k])}</b>
                  </div>
                );
              })}
            </div>

            <div className="tw">
              <table>
                <thead>
                  <tr>
                    <th>Nhân viên</th>
                    {R_FIELDS.map(([k, , colorVar, isChip]) => (
                      <th
                        key={k}
                        className={`${isChip ? '' : 'num'} ${colorVar ? 'c' : ''}`}
                        style={colorVar ? ({ '--c': `var(--s-${colorVar})` } as React.CSSProperties) : undefined}
                      >
                        {SHORT_NAMES[k]}
                      </th>
                    ))}
                    <th className="num">Đã đăng lên trang chủ</th>
                    <th>Giờ nộp</th>
                  </tr>
                </thead>
                <tbody>
                  {codes.map(c => {
                    const r = dayReportsMap[c];
                    const postedCount = customers.filter(x => x.code === c && x.day === selectedDate).length;
                    if (r) {
                      return (
                        <tr
                          key={c}
                          className="click"
                          onClick={() => {
                            setSelectedStaff(c);
                            setTab('staff');
                          }}
                        >
                          <td>
                            <b>NV {c}</b>
                          </td>
                          {R_FIELDS.map(([k, , , isChip]) =>
                            isChip ? (
                              <td key={k}>{r.tinhTrang || '—'}</td>
                            ) : (
                              <td key={k} className="num">
                                {nf((r as any)[k])}
                              </td>
                            )
                          )}
                          <td className="num">{postedCount}</td>
                          <td>{hm(r.updatedAt)}</td>
                        </tr>
                      );
                    }
                    return (
                      <tr
                        key={c}
                        className="click miss"
                        onClick={() => {
                          setSelectedStaff(c);
                          setTab('staff');
                        }}
                      >
                        <td>
                          <b>NV {c}</b>
                        </td>
                        <td colSpan={R_FIELDS.length}>
                          <span className="tag">Chưa nộp báo cáo</span>
                        </td>
                        <td className="num">{postedCount}</td>
                        <td>—</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td>Cả đội</td>
                    {R_FIELDS.map(([k, , , isChip]) =>
                      isChip ? (
                        <td key={k} />
                      ) : (
                        <td key={k} className="num">
                          {nf(dayTotals[k])}
                        </td>
                      )
                    )}
                    <td className="num">
                      {codes.reduce(
                        (sum, c) => sum + customers.filter(x => x.code === c && x.day === selectedDate).length,
                        0
                      )}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        )}

        {/* TAB 2: THEO THÁNG */}
        {tab === 'month' && (
          <section>
            <div className="head row-sb">
              <div>
                <h1>{monthLabel(selectedMonth)}</h1>
                <p className="sub">Cộng dồn báo cáo ngày của cả đội</p>
              </div>
              <select
                className="msel"
                aria-label="Chọn tháng"
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
              >
                {monthOptions.map(m => (
                  <option key={m} value={m}>
                    {monthLabel(m)}
                  </option>
                ))}
              </select>
            </div>

            <div className="kgrid">
              <div className="kc">
                <span>Số lượng cào</span>
                <b>{nf(monthTotals.scraped)}</b>
                <small>{monthRows.length} báo cáo đã nộp</small>
              </div>
              <div className="kc" style={{ '--c': 'var(--s-phan_hoi)' } as React.CSSProperties}>
                <span>Khách phản hồi</span>
                <b>{nf(monthTotals.phanHoi)}</b>
              </div>
              <div className="kc" style={{ '--c': 'var(--s-moi)' } as React.CSSProperties}>
                <span>Khách mới</span>
                <b>{nf(monthTotals.moi)}</b>
              </div>
              <div className="kc" style={{ '--c': 'var(--s-dang_noi)' } as React.CSSProperties}>
                <span>Đang nói chuyện</span>
                <b>{nf(monthTotals.dangNoi)}</b>
              </div>
              <div className="kc" style={{ '--c': 'var(--s-choi_giup)' } as React.CSSProperties}>
                <span>Chơi giúp</span>
                <b>{nf(monthTotals.choiGiup)}</b>
              </div>
              <div className="kc" style={{ '--c': 'var(--s-vao_tien)' } as React.CSSProperties}>
                <span>Vào tiền</span>
                <b>{nf(monthTotals.vaoTien)}</b>
              </div>
              <div className="kc" style={{ '--c': 'var(--s-chet)' } as React.CSSProperties}>
                <span>Khách chết</span>
                <b>{nf(monthTotals.chet)}</b>
              </div>
              <div className="kc">
                <span>Tổng data nhận</span>
                <b>{nf(monthTongData)}</b>
                <small>Theo báo cáo gần nhất</small>
              </div>
              <div className="kc">
                <span>Số lượng còn lại</span>
                <b>{nf(monthConLai)}</b>
                <small>Theo báo cáo gần nhất</small>
              </div>
              <div className="kc" style={{ '--c': 'var(--s-vao_tien)' } as React.CSSProperties}>
                <span>Tỷ lệ chuyển đổi</span>
                <b>{monthTongData ? pct(monthTotals.vaoTien / monthTongData) : '—'}</b>
                <small>Vào tiền / data nhận</small>
              </div>
            </div>

            <div className="panel">
              <div className="row-sb">
                <h2>Diễn biến từng ngày của cả đội</h2>
              </div>
              {elapsedDays ? (
                renderLineChart(
                  monthChartData.labels,
                  monthChartData.scrapedArr,
                  monthChartData.vaoTienArr
                )
              ) : (
                <div className="empty">Tháng này chưa bắt đầu.</div>
              )}
            </div>

            <div className="tw">
              <table>
                <thead>
                  <tr>
                    <th>Nhân viên</th>
                    <th className="num">Ngày đã nộp</th>
                    {['scraped', 'phanHoi', 'moi', 'dangNoi', 'choiGiup', 'vaoTien', 'chet'].map(k => {
                      const color = R_FIELDS.find(f => f[0] === k)?.[2];
                      return (
                        <th
                          key={k}
                          className={`num ${color ? 'c' : ''}`}
                          style={color ? ({ '--c': `var(--s-${color})` } as React.CSSProperties) : undefined}
                        >
                          {SHORT_NAMES[k]}
                        </th>
                      );
                    })}
                    <th className="num">Data nhận</th>
                    <th className="num">Còn lại</th>
                    <th className="num">Tỷ lệ chuyển đổi</th>
                    <th className="num">Khách đã đăng</th>
                  </tr>
                </thead>
                <tbody>
                  {staffMonthPerformance.map(p => (
                    <tr
                      key={p.code}
                      className={`click ${p.submittedCount ? '' : 'miss'}`}
                      onClick={() => {
                        setSelectedStaff(p.code);
                        setTab('staff');
                      }}
                    >
                      <td>
                        <b>NV {p.code}</b>
                      </td>
                      <td className="num">
                        {p.submittedCount}/{elapsedDays}
                      </td>
                      {['scraped', 'phanHoi', 'moi', 'dangNoi', 'choiGiup', 'vaoTien', 'chet'].map(k => (
                        <td key={k} className="num">
                          {nf(p.t[k])}
                        </td>
                      ))}
                      <td className="num">{nf(p.td)}</td>
                      <td className="num">{nf(p.cl)}</td>
                      <td className="num">{p.conversionRate != null ? pct(p.conversionRate) : '—'}</td>
                      <td className="num">{p.posted}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* TAB 3: TỪNG NHÂN VIÊN */}
        {tab === 'staff' && (
          <section>
            <div className="head row-sb">
              <div>
                <h1>Nhân viên {selectedStaff}</h1>
                <p className="sub">
                  {monthLabel(selectedMonth)}: nộp {activeStaffMonthRows.length}/{elapsedDays} ngày, đăng{' '}
                  {activeStaffPostedCustomers.length} khách lên trang chủ
                </p>
              </div>
              <select
                className="msel"
                aria-label="Chọn tháng"
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
              >
                {monthOptions.map(m => (
                  <option key={m} value={m}>
                    {monthLabel(m)}
                  </option>
                ))}
              </select>
            </div>

            <div className="chips" style={{ marginBottom: '14px' }}>
              {codes.map(c => (
                <button
                  key={c}
                  type="button"
                  className={`chip ${c === selectedStaff ? 'on' : ''}`}
                  onClick={() => setSelectedStaff(c)}
                >
                  NV {c}
                </button>
              ))}
            </div>

            <div className="kgrid">
              <div className="kc">
                <span>Số lượng cào</span>
                <b>{nf(activeStaffTotals.scraped)}</b>
              </div>
              <div className="kc" style={{ '--c': 'var(--s-phan_hoi)' } as React.CSSProperties}>
                <span>Phản hồi</span>
                <b>{nf(activeStaffTotals.phanHoi)}</b>
              </div>
              <div className="kc" style={{ '--c': 'var(--s-moi)' } as React.CSSProperties}>
                <span>Khách mới</span>
                <b>{nf(activeStaffTotals.moi)}</b>
              </div>
              <div className="kc" style={{ '--c': 'var(--s-vao_tien)' } as React.CSSProperties}>
                <span>Vào tiền</span>
                <b>{nf(activeStaffTotals.vaoTien)}</b>
              </div>
              <div className="kc" style={{ '--c': 'var(--s-chet)' } as React.CSSProperties}>
                <span>Khách chết</span>
                <b>{nf(activeStaffTotals.chet)}</b>
              </div>
              <div className="kc">
                <span>Data nhận / còn lại</span>
                <b>
                  {activeStaffLastReport
                    ? `${nf(activeStaffLastReport.tongData)} / ${nf(activeStaffLastReport.conLai)}`
                    : '—'}
                </b>
                <small>
                  {activeStaffLastReport
                    ? 'Tình trạng: ' + (activeStaffLastReport.tinhTrang || '—')
                    : 'Chưa có báo cáo'}
                </small>
              </div>
              <div className="kc" style={{ '--c': 'var(--s-vao_tien)' } as React.CSSProperties}>
                <span>Tỷ lệ chuyển đổi</span>
                <b>
                  {activeStaffLastReport && +activeStaffLastReport.tongData
                    ? pct(activeStaffTotals.vaoTien / Number(activeStaffLastReport.tongData))
                    : '—'}
                </b>
              </div>
            </div>

            <div className="panel">
              <h2>Diễn biến trong tháng</h2>
              {elapsedDays ? (
                renderLineChart(
                  activeStaffChartData.labels,
                  activeStaffChartData.a,
                  activeStaffChartData.b
                )
              ) : (
                <div className="empty">Tháng này chưa bắt đầu.</div>
              )}
            </div>

            <div className="tw">
              <table>
                <thead>
                  <tr>
                    <th>Ngày</th>
                    {R_FIELDS.map(([k, , colorVar, isChip]) => (
                      <th
                        key={k}
                        className={`${isChip ? '' : 'num'} ${colorVar ? 'c' : ''}`}
                        style={colorVar ? ({ '--c': `var(--s-${colorVar})` } as React.CSSProperties) : undefined}
                      >
                        {SHORT_NAMES[k]}
                      </th>
                    ))}
                    <th className="num">Đã đăng</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: elapsedDays }, (_, idx) => {
                    const dayNum = elapsedDays - idx;
                    const dateStr = `${selectedMonth}-${String(dayNum).padStart(2, '0')}`;
                    const rep = activeStaffMap[dateStr];
                    const postedCount = activeStaffPostedCustomers.filter(x => x.day === dateStr).length;

                    if (rep) {
                      return (
                        <tr key={dateStr}>
                          <td>
                            <b>{dm(dateStr)}</b>
                          </td>
                          {R_FIELDS.map(([k, , , isChip]) =>
                            isChip ? (
                              <td key={k}>{rep.tinhTrang || '—'}</td>
                            ) : (
                              <td key={k} className="num">
                                {nf((rep as any)[k])}
                              </td>
                            )
                          )}
                          <td className="num">{postedCount}</td>
                        </tr>
                      );
                    }
                    return (
                      <tr key={dateStr} className="miss">
                        <td>
                          <b>{dm(dateStr)}</b>
                        </td>
                        <td colSpan={R_FIELDS.length}>
                          <span className="tag">Chưa nộp</span>
                        </td>
                        <td className="num">{postedCount}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* TAB 4: KHÁCH MỚI CỦA CẢ ĐỘI */}
        {tab === 'cust' && (
          <section>
            <div className="head">
              <h1>Khách mới của cả đội</h1>
              <p className="sub">
                {customers.length} khách do cả đội đăng
                {filteredAllCustomers.length !== customers.length
                  ? `, đang hiện ${filteredAllCustomers.length}`
                  : ''}
                . Quản lý xoá được mọi khách.
              </p>
            </div>

            <div className="feedbar wrap">
              <input
                type="search"
                placeholder="Tìm tên, nghề, địa chỉ"
                aria-label="Tìm khách"
                value={custQuery}
                onChange={e => setCustQuery(e.target.value)}
              />
              <select
                aria-label="Lọc theo nhân viên"
                value={custStaffFilter}
                onChange={e => setCustStaffFilter(e.target.value)}
              >
                <option value="">Mọi nhân viên</option>
                {codes.map(c => (
                  <option key={c} value={c}>
                    NV {c}
                  </option>
                ))}
              </select>
              <input
                type="date"
                aria-label="Lọc theo ngày đăng"
                value={custDateFilter}
                onChange={e => setCustDateFilter(e.target.value)}
              />
            </div>

            <div className="feed">
              {filteredAllCustomers.length === 0 ? (
                <div className="empty">Không có khách khớp bộ lọc.</div>
              ) : (
                filteredAllCustomers.map(c => (
                  <CustomerCard
                    key={c.id}
                    customer={c}
                    isAdmin={true}
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
          </section>
        )}

        {/* TAB 5: DANH SÁCH KHÁCH HÀNG (BẢNG TÍNH) */}
        {tab === 'list' && (
          <section>
            <h2 style={{ margin: '4px 0 8px' }}>Theo nhân viên</h2>
            <div className="tw">
              <table>
                <thead>
                  <tr>
                    <th>Nhân viên</th>
                    {STAGES.map(([lbl, bg]) => (
                      <th
                        key={lbl}
                        className="num c"
                        style={{ '--c': bg } as React.CSSProperties}
                      >
                        {lbl}
                      </th>
                    ))}
                    <th className="num">Tổng khách</th>
                    <th className="num">Doanh thu (VNĐ)</th>
                  </tr>
                </thead>
                <tbody>
                  {sheetStaffList.map(c => {
                    const staffRows = sheet.filter(r => r.code === c);
                    const isSelected = listStaffFilter === c;
                    return (
                      <tr
                        key={c}
                        className="click"
                        onClick={() => setListStaffFilter(isSelected ? '' : c)}
                      >
                        <td>
                          <b>
                            NV {c}
                            {isSelected ? ' ✓' : ''}
                          </b>
                        </td>
                        {STAGES.map(([lbl]) => (
                          <td key={lbl} className="num">
                            {nf(staffRows.filter(r => r.stage === lbl).length)}
                          </td>
                        ))}
                        <td className="num">{nf(staffRows.length)}</td>
                        <td className="num">
                          {money(staffRows.reduce((sum, r) => sum + (Number(r.revenue) || 0), 0)) || '0'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td>Cả đội</td>
                    {STAGES.map(([lbl]) => (
                      <td key={lbl} className="num">
                        {nf(sheet.filter(r => r.stage === lbl).length)}
                      </td>
                    ))}
                    <td className="num">{nf(sheet.length)}</td>
                    <td className="num">
                      {money(sheet.reduce((sum, r) => sum + (Number(r.revenue) || 0), 0)) || '0'}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div style={{ marginTop: '20px' }}>
              <SpreadsheetView
                isAdmin={true}
                sheetData={sheet}
                selectedStaffFilter={listStaffFilter}
                onToast={onToast}
              />
            </div>
          </section>
        )}

        {/* TAB 6: MÃ NHÂN VIÊN */}
        {tab === 'codes' && (
          <section>
            <div className="head">
              <h1>Mã nhân viên</h1>
              <p className="sub">
                Chỉ những mã trong danh sách này mới đăng nhập được vào trang báo cáo.
              </p>
            </div>

            <div className="panel">
              <div className="codes-list">
                {codes.map(c => (
                  <span key={c} className="codechip">
                    NV {c}
                    <button
                      type="button"
                      aria-label={`Xoá mã ${c}`}
                      onClick={() => handleRemoveCode(c)}
                    >
                      {delArmedCode === c ? 'Bấm lần nữa để xoá' : '×'}
                    </button>
                  </span>
                ))}
              </div>

              <div className="ctrlrow">
                <input
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="Mã mới, ví dụ 12"
                  style={{ width: '190px' }}
                  aria-label="Mã nhân viên mới"
                  value={newCodeInput}
                  onChange={e => setNewCodeInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleAddCode();
                  }}
                />
                <button type="button" className="btn" onClick={handleAddCode}>
                  Thêm mã
                </button>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
};
