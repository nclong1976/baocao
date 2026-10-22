import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Customer, Report, SheetCustomer, M1_FIELDS, DSTAT, DsItem, Machine } from '../types';
import { SpreadsheetView } from './SpreadsheetView';
import { store } from '../services/store';
import { dayKey, dm, fmtT } from '../utils';

interface DailyReportViewProps {
  currentCode: string;
  reports: Report[];
  customers: Customer[];
  sheet: SheetCustomer[];
  /** Máy mà quản lý gán cho nhân viên này. */
  machine: Machine;
  onToast: (msg: string) => void;
}

export const DailyReportView: React.FC<DailyReportViewProps> = ({
  currentCode,
  reports,
  customers,
  sheet,
  machine,
  onToast,
}) => {
  const isM2 = machine === '2';
  const [selectedDate, setSelectedDate] = useState(() => dayKey(Date.now()));
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  // Auto count for 'moi' on selectedDate
  const autoMoi = useMemo(() => {
    return customers.filter(c => c.code === currentCode && c.day === selectedDate).length;
  }, [customers, currentCode, selectedDate]);

  // Auto count for 'tongThang' on selectedDate month
  const autoThang = useMemo(() => {
    const curMonth = selectedDate.slice(0, 7);
    return customers.filter(
      c => c.code === currentCode && c.day && c.day.slice(0, 7) === curMonth && c.day <= selectedDate
    ).length;
  }, [customers, currentCode, selectedDate]);

  // Current report for this date
  const currentReport = useMemo(() => {
    return reports.find(r => r.code === currentCode && r.date === selectedDate);
  }, [reports, currentCode, selectedDate]);

  // Previous report for auto-filling tongData
  const prevReport = useMemo(() => {
    return reports
      .filter(r => r.code === currentCode && r.date < selectedDate)
      .sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  }, [reports, currentCode, selectedDate]);

  // Load report data when date changes or report changes
  useEffect(() => {
    const initial: Record<string, string> = {};
    const newTouched: Record<string, boolean> = {};

    M1_FIELDS.forEach(([k, , , isChip]) => {
      if (isChip) {
        initial[k] = currentReport ? currentReport.tinhTrang || '' : '';
      } else {
        let v: any = currentReport ? (currentReport as any)[k] : '';
        if (!currentReport && k === 'tongData' && prevReport) {
          v = prevReport.tongData;
        }
        if (!currentReport && k === 'moi') {
          v = autoMoi;
        }
        if (!currentReport && k === 'tongThang') {
          v = autoThang;
        }
        initial[k] = v === '' || v == null ? '' : String(v);
        newTouched[k] = !!currentReport;
      }
    });

    setFormData(initial);
    setTouched(newTouched);
    setIsDirty(false);
  }, [selectedDate, currentReport]);

  // Sync auto hints if not touched
  useEffect(() => {
    setFormData(prev => {
      let changed = false;
      const next = { ...prev };
      if (!touched['moi']) {
        next['moi'] = String(autoMoi);
        changed = true;
      }
      if (!touched['tongThang']) {
        next['tongThang'] = String(autoThang);
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [autoMoi, autoThang, touched]);

  const handleInputChange = (k: string, val: string) => {
    setFormData(prev => ({ ...prev, [k]: val }));
    setTouched(prev => ({ ...prev, [k]: true }));
    setIsDirty(true);
  };

  const handleChipChange = (k: string, val: string) => {
    const nextVal = formData[k] === val ? '' : val;
    setFormData(prev => ({ ...prev, [k]: nextVal }));
    setIsDirty(true);
  };

  // Máy 2: Danh sách khách hàng hiện tại của nhân viên, theo thứ tự nhập.
  const liveDs = useMemo<DsItem[]>(() => {
    return sheet
      .filter(r => r.code === currentCode && r.name?.trim())
      .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
      .map(r => ({
        name: r.name!.trim(),
        ...(r.stage ? { stage: r.stage } : {}),
        ...(r.rank ? { rank: r.rank } : {}),
      }));
  }, [sheet, currentCode]);

  // Ngày cũ đã lưu thì hiện đúng danh sách lúc lưu, còn lại dùng bảng hiện tại.
  const isToday = selectedDate === dayKey(Date.now());
  const dsList = !isToday && currentReport?.dsKhach ? currentReport.dsKhach : liveDs;

  const dsStageCounts = useMemo(() => {
    const counts: [string, number][] = [];
    dsList.forEach(d => {
      const k = d.stage || 'Chưa chọn tình trạng';
      const hit = counts.find(c => c[0] === k);
      if (hit) hit[1]++;
      else counts.push([k, 1]);
    });
    return counts;
  }, [dsList]);

  const reportText = useMemo(() => {
    const lines = [`NV ${currentCode} - MÁY ${machine} - NGÀY ${dm(selectedDate)}`, ''];
    if (isM2) {
      lines.push(`- Tổng khách : ${dsList.length}`);
      dsStageCounts.forEach(([k, n]) => lines.push(`- ${k} : ${n}`));
      if (dsList.length) {
        lines.push('', 'Danh sách khách hàng:');
        dsList.forEach((d, i) => {
          const extra = [d.stage, d.rank].filter(Boolean).join(', ');
          lines.push(`${i + 1}. ${d.name}${extra ? ` - ${extra}` : ''}`);
        });
      }
    } else {
      M1_FIELDS.forEach(([k, label, , isChip]) => {
        const v = isChip ? formData['tinhTrang'] : formData[k]?.trim();
        lines.push(`- ${label} : ${v || (isChip ? '' : '0')}`);
      });
    }
    return lines.join('\n');
  }, [currentCode, machine, isM2, selectedDate, formData, dsList, dsStageCounts]);

  const handleSave = async () => {
    if (!selectedDate) {
      onToast('Chọn ngày báo cáo');
      return;
    }

    const obj: any = {
      // Giữ lại các số cũ (chơi giúp, vào tiền, chết...) của báo cáo đã lưu trước khi có Máy 1/Máy 2.
      ...(currentReport ? (({ id, ...rest }) => rest)(currentReport) : {}),
      code: currentCode,
      date: selectedDate,
      may: machine,
      updatedAt: Date.now(),
    };

    if (isM2) {
      obj.dsKhach = liveDs;
      obj.dangNoi = liveDs.length;
    } else for (const [k, label, , isChip] of M1_FIELDS) {
      if (isChip) {
        obj[k] = formData['tinhTrang'] || '';
        continue;
      }
      const raw = (formData[k] || '').trim();
      if (raw && !/^\d+$/.test(raw)) {
        onToast(label + ' chỉ nhập số');
        return;
      }
      obj[k] = raw ? parseInt(raw, 10) : 0;
    }

    setIsSaving(true);
    try {
      await store.put('reports', `${currentCode}_${selectedDate}`, obj);
      setIsDirty(false);
      onToast('Đã lưu báo cáo ngày ' + dm(selectedDate));
    } catch (e: any) {
      onToast(e?.message || 'Lỗi khi lưu báo cáo');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(reportText);
      onToast('Đã sao chép, dán vào Zalo để gửi');
      return;
    } catch (e) {}

    if (textAreaRef.current) {
      textAreaRef.current.focus();
      textAreaRef.current.select();
      try {
        if (document.execCommand('copy')) {
          onToast('Đã sao chép, dán vào Zalo để gửi');
          return;
        }
      } catch (e) {}
    }
    onToast('Đã chọn sẵn nội dung, nhấn giữ để sao chép');
  };

  const myHistory = useMemo(() => {
    return reports
      .filter(r => r.code === currentCode)
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, 31);
  }, [reports, currentCode]);

  const saveRow = (
    <div className="row-e">
      <button type="button" className="btn" disabled={isSaving} onClick={handleSave}>
        Lưu báo cáo
      </button>
    </div>
  );

  return (
    <div>
      <div className="head row-sb">
        <div>
          <h1>
            NGÀY {dm(selectedDate)} <span className={`mtag ${isM2 ? 'm2' : ''}`}>Máy {machine}</span>
          </h1>
          <p className="sub">
            {currentReport
              ? `Đã lưu lúc ${fmtT(currentReport.updatedAt)}${isDirty ? '. Có thay đổi chưa lưu' : ''}.`
              : isDirty
              ? 'Chưa lưu báo cáo cho ngày này.'
              : 'Chưa có báo cáo cho ngày này.'}
          </p>
        </div>
        <label className="sub" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          Ngày
          <input
            type="date"
            style={{ width: 'auto' }}
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
          />
        </label>
      </div>

{!isM2 && (
      <div className="panel">
        <div className="rform">
          {M1_FIELDS.map(([k, label, colorVar, isChip]) => {
            if (isChip) {
              return (
                <div key={k} className="rrow chiprow">
                  <span>{label}</span>
                  <div className="chips">
                    {DSTAT.map(v => (
                      <button
                        key={v}
                        type="button"
                        className={`chip ${formData['tinhTrang'] === v ? 'on' : ''}`}
                        onClick={() => handleChipChange('tinhTrang', v)}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              );
            }

            const isAutoHint = k === 'moi' || k === 'tongThang';
            const hintVal = k === 'moi' ? autoMoi : autoThang;

            return (
              <label
                key={k}
                className="rrow"
                style={colorVar ? ({ '--c': `var(--s-${colorVar})` } as React.CSSProperties) : undefined}
              >
                <span>
                  {label}
                  {isAutoHint && <small>Tự đếm từ mục Khách mới: {hintVal}</small>}
                </span>
                <input
                  inputMode="numeric"
                  placeholder="0"
                  value={formData[k] || ''}
                  onChange={e => handleInputChange(k, e.target.value)}
                />
              </label>
            );
          })}
        </div>
        {saveRow}
      </div>
)}

      {isM2 && (
        <div className="panel">
          <div className="mhead">
            <h2>Danh sách khách hàng</h2>
            <span className="sub">{dsList.length} khách</span>
          </div>
          {dsStageCounts.length > 0 && (
            <div className="dsstat">
              {dsStageCounts.map(([k, n]) => (
                <span key={k}>
                  {k} <b>{n}</b>
                </span>
              ))}
            </div>
          )}
          <SpreadsheetView embedded currentCode={currentCode} sheetData={sheet} customers={customers} onToast={onToast} />
          <p className="sub">Bấm “Lưu báo cáo” để chốt danh sách khách hàng của ngày {dm(selectedDate)}.</p>
          {saveRow}
        </div>
      )}

      <div className="panel">
        <div className="row-sb">
          <h2>Bản báo cáo để gửi</h2>
          <button type="button" className="btn ghost" onClick={handleCopy}>
            Sao chép
          </button>
        </div>
        <textarea
          ref={textAreaRef}
          className="rtext"
          readOnly
          rows={14}
          aria-label="Nội dung báo cáo"
          value={reportText}
        />
      </div>

      <div className="panel">
        <h2>Báo cáo đã lưu</h2>
        <div className="hist" style={{ marginTop: '6px' }}>
          {myHistory.length === 0 ? (
            <div className="empty">Chưa có báo cáo nào được lưu.</div>
          ) : (
            myHistory.map(r => (
              <button
                key={r.date}
                type="button"
                onClick={() => {
                  setSelectedDate(r.date);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              >
                <b className={r.date === selectedDate ? 'on' : ''}>Ngày {dm(r.date)}</b>
                <span>
                  {r.may === '2'
                    ? `${r.dsKhach ? r.dsKhach.length : r.dangNoi} khách trong danh sách`
                    : `Cào ${r.scraped}, khách mới ${r.moi}, còn lại ${r.conLai}`}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
