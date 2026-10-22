import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Customer, Report, M1_FIELDS, DSTAT, TalkItem } from '../types';
import { store } from '../services/store';
import { dayKey, dm, fmtT } from '../utils';

interface DailyReportViewProps {
  currentCode: string;
  reports: Report[];
  customers: Customer[];
  onToast: (msg: string) => void;
}

export const DailyReportView: React.FC<DailyReportViewProps> = ({
  currentCode,
  reports,
  customers,
  onToast,
}) => {
  const [selectedDate, setSelectedDate] = useState(() => dayKey(Date.now()));
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [talks, setTalks] = useState<TalkItem[]>([]);
  const [talkName, setTalkName] = useState('');
  const [talkNote, setTalkNote] = useState('');
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

    // Danh sách đang nói chuyện thường kéo dài qua nhiều ngày nên ngày mới lấy lại từ báo cáo trước.
    const src = currentReport || prevReport;
    setTalks(src?.noiChuyen ? src.noiChuyen.map(t => ({ ...t })) : []);
    setTalkName('');
    setTalkNote('');

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

  // Gợi ý tên từ khách mà nhân viên đã đăng.
  const nameSuggestions = useMemo(() => {
    const set = new Set<string>();
    customers.forEach(c => {
      if (c.code === currentCode && c.name) set.add(c.name);
    });
    return [...set];
  }, [customers, currentCode]);

  const addTalk = () => {
    const name = talkName.trim();
    if (!name) {
      onToast('Nhập tên khách');
      return;
    }
    if (talks.some(t => t.name.toLowerCase() === name.toLowerCase())) {
      onToast(`${name} đã có trong danh sách`);
      return;
    }
    setTalks(prev => [...prev, { name, note: talkNote.trim() || undefined }]);
    setTalkName('');
    setTalkNote('');
    setIsDirty(true);
  };

  const updateTalkNote = (idx: number, note: string) => {
    setTalks(prev => prev.map((t, i) => (i === idx ? { ...t, note } : t)));
    setIsDirty(true);
  };

  const removeTalk = (idx: number) => {
    setTalks(prev => prev.filter((_, i) => i !== idx));
    setIsDirty(true);
  };

  const reportText = useMemo(() => {
    const lines = [`NV ${currentCode} - NGÀY ${dm(selectedDate)}`, '', 'MÁY 1'];
    M1_FIELDS.forEach(([k, label, , isChip]) => {
      const v = isChip ? formData['tinhTrang'] : formData[k]?.trim();
      lines.push(`- ${label} : ${v || (isChip ? '' : '0')}`);
    });
    lines.push('', `MÁY 2`, `- Khách đang nói chuyện : ${talks.length}`);
    talks.forEach((t, i) => {
      const note = t.note?.trim();
      lines.push(`  ${i + 1}. ${t.name}${note ? ` - ${note}` : ''}`);
    });
    return lines.join('\n');
  }, [currentCode, selectedDate, formData, talks]);

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
      updatedAt: Date.now(),
    };

    for (const [k, label, , isChip] of M1_FIELDS) {
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

    const pendingName = talkName.trim();
    const list = talks
      .map(t => ({ name: t.name.trim(), ...(t.note?.trim() ? { note: t.note.trim() } : {}) }))
      .filter(t => t.name);
    if (pendingName && !list.some(t => t.name.toLowerCase() === pendingName.toLowerCase())) {
      list.push({ name: pendingName, ...(talkNote.trim() ? { note: talkNote.trim() } : {}) });
      setTalks(list);
      setTalkName('');
      setTalkNote('');
    }
    obj.noiChuyen = list;
    obj.dangNoi = list.length;

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

  return (
    <div>
      <div className="head row-sb">
        <div>
          <h1>NGÀY {dm(selectedDate)}</h1>
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

      <div className="panel">
        <div className="mhead">
          <span className="mtag">Máy 1</span>
          <h2>Số liệu data</h2>
        </div>
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
      </div>

      <div className="panel">
        <div className="mhead">
          <span className="mtag m2">Máy 2</span>
          <h2>Khách đang nói chuyện</h2>
          <span className="sub">{talks.length} khách</span>
        </div>

        {talks.length === 0 ? (
          <div className="empty">Chưa có khách nào. Thêm tên khách đang nói chuyện ở dưới.</div>
        ) : (
          <ol className="talks">
            {talks.map((t, i) => (
              <li key={t.name}>
                <span className="tn">{i + 1}</span>
                <b>{t.name}</b>
                <input
                  placeholder="Ghi chú (không bắt buộc)"
                  aria-label={`Ghi chú cho ${t.name}`}
                  value={t.note || ''}
                  onChange={e => updateTalkNote(i, e.target.value)}
                />
                <button type="button" className="rm" aria-label={`Bỏ ${t.name}`} onClick={() => removeTalk(i)}>
                  ×
                </button>
              </li>
            ))}
          </ol>
        )}

        <div className="talkadd">
          <input
            list="talk-names"
            placeholder="Tên khách"
            aria-label="Tên khách đang nói chuyện"
            value={talkName}
            onChange={e => setTalkName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addTalk();
              }
            }}
          />
          <input
            placeholder="Ghi chú (không bắt buộc)"
            aria-label="Ghi chú"
            value={talkNote}
            onChange={e => setTalkNote(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addTalk();
              }
            }}
          />
          <button type="button" className="btn ghost" onClick={addTalk}>
            Thêm
          </button>
          <datalist id="talk-names">
            {nameSuggestions.map(n => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </div>

        <div className="row-e">
          <button type="button" className="btn" disabled={isSaving} onClick={handleSave}>
            Lưu báo cáo
          </button>
        </div>
      </div>

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
                  Cào {r.scraped}, còn lại {r.conLai}, đang nói chuyện {r.noiChuyen ? r.noiChuyen.length : r.dangNoi}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
