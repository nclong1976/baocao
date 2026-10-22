import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Customer, SheetCustomer, SCOLS, STAGES, RANKS, PICK_MAP } from '../types';
import { store } from '../services/store';
import { money, newId, norm } from '../utils';
import { duplicateGroups, findDuplicates } from '../services/dupcheck';
import { raiseAlarm } from '../services/alarm';

interface SpreadsheetViewProps {
  currentCode?: string | null;
  isAdmin?: boolean;
  sheetData: SheetCustomer[];
  customers?: Customer[];
  selectedStaffFilter?: string;
  /** Nhúng trong trang khác (Báo cáo ngày Máy 2): ẩn tiêu đề riêng của bảng. */
  embedded?: boolean;
  onToast: (msg: string) => void;
}

export const SpreadsheetView: React.FC<SpreadsheetViewProps> = ({
  currentCode,
  isAdmin = false,
  sheetData,
  customers = [],
  selectedStaffFilter = '',
  embedded = false,
  onToast,
}) => {
  const [query, setQuery] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [activeMenu, setActiveMenu] = useState<{
    rowId: string;
    key: 'stage' | 'rank';
    rect: DOMRect;
    currentVal: string;
  } | null>(null);

  const [delArmedId, setDelArmedId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Filtered rows
  const relevantRows = useMemo(() => {
    return sheetData.filter(r => {
      if (!isAdmin && r.code !== currentCode) return false;
      if (isAdmin && selectedStaffFilter && r.code !== selectedStaffFilter) return false;
      return true;
    }).sort((a, b) => {
      if (isAdmin) {
        return a.code === b.code
          ? (a.createdAt || 0) - (b.createdAt || 0)
          : String(a.code).localeCompare(String(b.code), 'vi', { numeric: true });
      }
      return (a.createdAt || 0) - (b.createdAt || 0);
    });
  }, [sheetData, isAdmin, currentCode, selectedStaffFilter]);

  const displayedRows = useMemo(() => {
    const q = norm(query);
    return relevantRows.filter(r => {
      const matchStage =
        !stageFilter || (stageFilter === '__none' ? !r.stage : r.stage === stageFilter);
      if (!matchStage) return false;
      if (!q) return true;
      const fullText = norm([r.name, r.job, r.addr, r.family, r.note].join(' '));
      return fullText.includes(q);
    });
  }, [relevantRows, query, stageFilter]);

  // Các dòng có tên trùng với khách khác trong ứng dụng, tô đỏ để dễ thấy.
  const dupRowIds = useMemo(() => {
    const ids = new Set<string>();
    duplicateGroups(customers, sheetData).forEach(g =>
      g.items.forEach(it => {
        if (it.source === 'sheet') ids.add(it.id);
      })
    );
    return ids;
  }, [customers, sheetData]);

  const checkDuplicate = (row: SheetCustomer) => {
    if (isAdmin || !row.name) return;
    const matches = findDuplicates(row, customers, sheetData, {
      code: row.code,
      context: 'sheet',
      excludeId: row.id,
    });
    if (!matches.length) return;
    raiseAlarm({
      title: 'CẢNH BÁO KHÁCH TRÙNG',
      message: `Khách “${row.name}” vừa nhập vào danh sách có thể đã tồn tại trong ứng dụng.`,
      matches,
      actions: [
        { label: 'Đã hiểu, kiểm tra lại', primary: true },
        {
          label: 'Xoá dòng vừa nhập',
          onClick: () => {
            store.remove('sheet', row.id).catch(() => onToast('Chưa xoá được dòng'));
          },
        },
      ],
    });
  };

  const totalRevenue = useMemo(() => {
    return displayedRows.reduce((sum, r) => sum + (Number(r.revenue) || 0), 0);
  }, [displayedRows]);

  const blanksCount = query || stageFilter ? 0 : Math.max(5, 20 - displayedRows.length);

  // Row update / save
  const handleCellBlur = async (rowId: string, key: keyof SheetCustomer, value: any, isBlank: boolean = false) => {
    const existing = sheetData.find(x => x.id === rowId);

    if (existing) {
      if (!isAdmin && existing.code !== currentCode) return;
      if (existing[key] === value) return;
      const row = { ...existing, [key]: value, updatedAt: Date.now() };
      try {
        await store.put('sheet', rowId, row);
        if (key === 'name' && value) checkDuplicate(row);
      } catch (e: any) {
        onToast(e?.message || 'Lỗi khi lưu');
      }
    } else if (isBlank) {
      // Create new row only if has some value
      if (!value && value !== 0) return;
      if (!currentCode && !isAdmin) return;
      const now = Date.now();
      const code = isAdmin && selectedStaffFilter ? selectedStaffFilter : currentCode || '1';
      const newRow: SheetCustomer = {
        id: rowId,
        code,
        [key]: value,
        createdAt: now,
        updatedAt: now,
      };
      try {
        await store.put('sheet', rowId, newRow);
        if (key === 'name' && value) checkDuplicate(newRow);
      } catch (e: any) {
        onToast(e?.message || 'Lỗi khi lưu');
      }
    }
  };

  const handlePickSelect = async (rowId: string, key: 'stage' | 'rank', val: string, isBlank: boolean = false) => {
    setActiveMenu(null);
    await handleCellBlur(rowId, key, val, isBlank);
  };

  const handleDeleteRow = async (id: string) => {
    if (delArmedId !== id) {
      setDelArmedId(id);
      setTimeout(() => {
        setDelArmedId(curr => (curr === id ? null : curr));
      }, 3000);
      return;
    }
    setDelArmedId(null);
    try {
      const r = sheetData.find(x => x.id === id);
      await store.remove('sheet', id);
      onToast(`Đã xoá ${r?.name || 'dòng'}`);
    } catch (e: any) {
      onToast(e?.message || 'Lỗi khi xoá dòng');
    }
  };

  // Keyboard navigation for menu
  useEffect(() => {
    if (!activeMenu) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveMenu(null);
        return;
      }
      const list = PICK_MAP[activeMenu.key];
      const c = e.key.toUpperCase();

      if (activeMenu.key === 'stage' && /^[1-7]$/.test(e.key)) {
        e.preventDefault();
        const item = list[parseInt(e.key, 10) - 1];
        if (item) {
          handlePickSelect(activeMenu.rowId, activeMenu.key, item[0]);
        }
      } else if (activeMenu.key === 'rank' && /^[A-D]$/i.test(c)) {
        e.preventDefault();
        const item = list.find(x => x[0].startsWith(c));
        if (item) {
          handlePickSelect(activeMenu.rowId, activeMenu.key, item[0]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeMenu]);

  // Close menu on click outside
  useEffect(() => {
    if (!activeMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenu(null);
      }
    };
    window.addEventListener('mousedown', handleClick);
    return () => window.removeEventListener('mousedown', handleClick);
  }, [activeMenu]);

  const tagOf = (key: 'stage' | 'rank', val?: string) => {
    if (!val) return null;
    const list = PICK_MAP[key] || [];
    const item = list.find(x => x[0] === val);
    const bg = item ? item[1] : '#E6E6E6';
    const fg = item ? item[2] : '#2B2B2B';
    return (
      <span className="tg" style={{ '--tb': bg, '--tf': fg } as React.CSSProperties}>
        {val}
      </span>
    );
  };

  const colWidths = useMemo(() => {
    const list = [36];
    if (isAdmin) list.push(54);
    SCOLS.forEach(c => list.push(c.width));
    list.push(30); // delete button
    return list;
  }, [isAdmin]);

  const totalTableWidth = useMemo(() => {
    return colWidths.reduce((a, b) => a + b, 0);
  }, [colWidths]);

  const revenueColIndex = useMemo(() => {
    return SCOLS.findIndex(c => c.key === 'revenue') + 1 + (isAdmin ? 1 : 0);
  }, [isAdmin]);

  return (
    <div>
      <div className={embedded ? 'mhead-sub' : 'head'}>
        {!embedded && <h1>Danh sách khách hàng</h1>}
        <p className="sub">
          {isAdmin
            ? `${sheetData.length} khách do nhân viên nhập${
                displayedRows.length !== sheetData.length ? `, đang hiện ${displayedRows.length}` : ''
              }`
            : `Bạn có ${relevantRows.length} khách${
                displayedRows.length !== relevantRows.length ? `, đang hiện ${displayedRows.length}` : ''
              }. Gõ thẳng vào ô để nhập, dữ liệu tự lưu khi chuyển sang ô khác.`}
        </p>
      </div>

      <div className="sheetbar">
        <input
          type="search"
          placeholder="Tìm tên, nghề, nơi ở, ghi chú"
          aria-label="Tìm khách"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <select
          aria-label="Lọc theo tình trạng"
          value={stageFilter}
          onChange={e => setStageFilter(e.target.value)}
        >
          <option value="">Mọi tình trạng</option>
          {STAGES.map(([l]) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
          <option value="__none">Chưa chọn tình trạng</option>
        </select>
        <span className="hint">
          Mẹo: ở cột Tình trạng bấm phím 1–7, ở cột Xếp hạng bấm A–D để chọn nhanh.
        </span>
      </div>

      <div className="sw" ref={tableContainerRef}>
        <table className="sheet" style={{ minWidth: `${Math.round(totalTableWidth * 0.7)}px` }}>
          <colgroup>
            {colWidths.map((w, idx) => (
              <col key={idx} style={{ width: `${(w / totalTableWidth) * 100}%` }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th>STT</th>
              {isAdmin && <th>NV</th>}
              {SCOLS.map(c => (
                <th key={c.key}>{c.label}</th>
              ))}
              <th aria-label="Xoá" />
            </tr>
          </thead>
          <tbody>
            {displayedRows.map((r, i) => (
              <tr key={r.id} data-row={r.id} className={dupRowIds.has(r.id) ? 'duprow' : undefined}>
                <td title={dupRowIds.has(r.id) ? 'Khách này trùng với khách khác trong ứng dụng' : undefined}>
                  {i + 1}
                </td>
                {isAdmin && <td className="nvc">NV {r.code}</td>}
                {SCOLS.map(c => {
                  const val = r[c.key];
                  const canEdit = isAdmin || r.code === currentCode;

                  if (c.type === 'pick') {
                    const pickKey = c.key as 'stage' | 'rank';
                    return (
                      <td key={c.key}>
                        <button
                          type="button"
                          className="pick"
                          disabled={!canEdit}
                          aria-label={c.label}
                          onClick={e => {
                            if (!canEdit) return;
                            const rect = e.currentTarget.getBoundingClientRect();
                            setActiveMenu({
                              rowId: r.id,
                              key: pickKey,
                              rect,
                              currentVal: String(val || ''),
                            });
                          }}
                        >
                          {tagOf(pickKey, val as string)}
                        </button>
                      </td>
                    );
                  }

                  if (c.type === 'date') {
                    return (
                      <td key={c.key}>
                        <input
                          type="date"
                          defaultValue={val as string || ''}
                          readOnly={!canEdit}
                          onBlur={e => handleCellBlur(r.id, c.key, e.target.value)}
                        />
                      </td>
                    );
                  }

                  if (c.type === 'money') {
                    return (
                      <td key={c.key}>
                        <input
                          className="money"
                          inputMode="numeric"
                          defaultValue={money(val as number)}
                          readOnly={!canEdit}
                          onFocus={e => {
                            e.target.value = e.target.value.replace(/\D/g, '');
                          }}
                          onBlur={e => {
                            const raw = e.target.value.replace(/\D/g, '');
                            const num = raw ? parseInt(raw, 10) : 0;
                            e.target.value = num ? money(num) : '';
                            handleCellBlur(r.id, c.key, num);
                          }}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              (e.target as HTMLElement).blur();
                            }
                          }}
                        />
                      </td>
                    );
                  }

                  return (
                    <td key={c.key}>
                      <input
                        defaultValue={(val as string) || ''}
                        readOnly={!canEdit}
                        autoComplete="off"
                        onBlur={e => handleCellBlur(r.id, c.key, e.target.value.trim())}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            (e.target as HTMLElement).blur();
                          }
                        }}
                      />
                    </td>
                  );
                })}
                <td>
                  {(isAdmin || r.code === currentCode) && (
                    <button
                      type="button"
                      className={`rmrow ${delArmedId === r.id ? 'arm' : ''}`}
                      aria-label="Xoá dòng"
                      onClick={() => handleDeleteRow(r.id)}
                    >
                      {delArmedId === r.id ? 'Xoá?' : '×'}
                    </button>
                  )}
                </td>
              </tr>
            ))}

            {/* Blank rows for inline creation */}
            {Array.from({ length: blanksCount }).map((_, idx) => {
              const tempId = `blank_${idx}_${newId()}`;
              return (
                <tr key={tempId} className="blank" data-row={tempId}>
                  <td />
                  {isAdmin && <td className="nvc" />}
                  {SCOLS.map(c => {
                    if (c.type === 'pick') {
                      const pickKey = c.key as 'stage' | 'rank';
                      return (
                        <td key={c.key}>
                          <button
                            type="button"
                            className="pick"
                            aria-label={c.label}
                            onClick={e => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              setActiveMenu({
                                rowId: tempId,
                                key: pickKey,
                                rect,
                                currentVal: '',
                              });
                            }}
                          />
                        </td>
                      );
                    }

                    if (c.type === 'date') {
                      return (
                        <td key={c.key}>
                          <input
                            type="date"
                            onBlur={e => {
                              if (e.target.value) {
                                handleCellBlur(tempId, c.key, e.target.value, true);
                              }
                            }}
                          />
                        </td>
                      );
                    }

                    if (c.type === 'money') {
                      return (
                        <td key={c.key}>
                          <input
                            className="money"
                            inputMode="numeric"
                            onFocus={e => {
                              e.target.value = e.target.value.replace(/\D/g, '');
                            }}
                            onBlur={e => {
                              const raw = e.target.value.replace(/\D/g, '');
                              const num = raw ? parseInt(raw, 10) : 0;
                              if (num) {
                                e.target.value = money(num);
                                handleCellBlur(tempId, c.key, num, true);
                              }
                            }}
                          />
                        </td>
                      );
                    }

                    return (
                      <td key={c.key}>
                        <input
                          autoComplete="off"
                          onBlur={e => {
                            const val = e.target.value.trim();
                            if (val) {
                              handleCellBlur(tempId, c.key, val, true);
                            }
                          }}
                        />
                      </td>
                    );
                  })}
                  <td />
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={revenueColIndex}>Tổng {displayedRows.length} khách</td>
              <td style={{ textAlign: 'right' }}>{money(totalRevenue) || '0'}</td>
              <td colSpan={colWidths.length - revenueColIndex - 1} />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Floating Menu for Stage / Rank */}
      {activeMenu && (
        <div
          ref={menuRef}
          className="menu"
          role="listbox"
          style={{
            position: 'fixed',
            left: `${Math.max(8, Math.min(activeMenu.rect.left, window.innerWidth - 230))}px`,
            top: `${
              activeMenu.rect.bottom + 4 + 200 > window.innerHeight
                ? Math.max(8, activeMenu.rect.top - 210)
                : activeMenu.rect.bottom + 4
            }px`,
            width: `${Math.max(activeMenu.rect.width, 220)}px`,
            zIndex: 100,
          }}
        >
          {PICK_MAP[activeMenu.key].map(([label, bg, fg], i) => (
            <button
              key={label}
              type="button"
              role="option"
              className={activeMenu.currentVal === label ? 'on' : ''}
              onClick={() => handlePickSelect(activeMenu.rowId, activeMenu.key, label, activeMenu.rowId.startsWith('blank_'))}
            >
              <span className="tg" style={{ '--tb': bg, '--tf': fg } as React.CSSProperties}>
                {label}
              </span>
              {activeMenu.key === 'stage' && (
                <small style={{ float: 'right', color: 'var(--muted)', paddingTop: '3px' }}>
                  {i + 1}
                </small>
              )}
            </button>
          ))}
          {activeMenu.currentVal && (
            <button
              type="button"
              className="clr"
              onClick={() => handlePickSelect(activeMenu.rowId, activeMenu.key, '', activeMenu.rowId.startsWith('blank_'))}
            >
              Bỏ chọn
            </button>
          )}
        </div>
      )}
    </div>
  );
};
