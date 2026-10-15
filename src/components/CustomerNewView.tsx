import React, { useState, useRef, useEffect } from 'react';
import { Customer, PhotoItem } from '../types';
import { store } from '../services/store';
import { dayKey, fmtT, norm, newId, imgSrc } from '../utils';
import { CustomerCard } from './CustomerCard';

interface CustomerNewViewProps {
  currentCode: string;
  customers: Customer[];
  editingCustomer: Customer | null;
  onClearEditing: () => void;
  onToast: (msg: string) => void;
  onZoomPhoto: (url: string) => void;
}

const MAXPH = 6;
const MARITAL_OPTIONS = ['Độc thân', 'Đã kết hôn', 'Ly hôn', 'Góa'];

export const CustomerNewView: React.FC<CustomerNewViewProps> = ({
  currentCode,
  customers,
  editingCustomer,
  onClearEditing,
  onToast,
  onZoomPhoto,
}) => {
  const [name, setName] = useState('');
  const [birth, setBirth] = useState('');
  const [job, setJob] = useState('');
  const [addr, setAddr] = useState('');
  const [marital, setMarital] = useState('');
  const [kids, setKids] = useState('');
  const [rating, setRating] = useState('');
  const [note, setNote] = useState('');

  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [removedRefs, setRemovedRefs] = useState<string[]>([]);
  const [dupWarning, setDupWarning] = useState<string | null>(null);
  const [dupConfirmedKey, setDupConfirmedKey] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveButtonText, setSaveButtonText] = useState('Đăng lên trang chủ');
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pasteBoxRef = useRef<HTMLDivElement>(null);

  // Sync when editingCustomer changes
  useEffect(() => {
    if (editingCustomer) {
      setName(editingCustomer.name || '');
      setBirth(editingCustomer.birth || '');
      setJob(editingCustomer.job || '');
      setAddr(editingCustomer.addr || '');
      setMarital(editingCustomer.marital || '');
      setKids(editingCustomer.kids || '');
      setRating(editingCustomer.rating || '');
      setNote(editingCustomer.note || '');
      setPhotos((editingCustomer.photos || []).map(ref => ({ kind: 'old', ref })));
      setRemovedRefs([]);
      setDupWarning(null);
      setDupConfirmedKey(null);
      setSaveButtonText('Lưu thay đổi');
    } else {
      resetForm();
    }
  }, [editingCustomer]);

  const resetForm = () => {
    setName('');
    setBirth('');
    setJob('');
    setAddr('');
    setMarital('');
    setKids('');
    setRating('');
    setNote('');
    // Revoke blob urls
    photos.forEach(p => {
      if (p.kind === 'new' && p.url) URL.revokeObjectURL(p.url);
    });
    setPhotos([]);
    setRemovedRefs([]);
    setDupWarning(null);
    setDupConfirmedKey(null);
    setSaveButtonText('Đăng lên trang chủ');
    onClearEditing();
  };

  const handleAddFiles = (files: FileList | File[]) => {
    const valid = Array.from(files).filter(
      f => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name)
    );
    const room = MAXPH - photos.length;
    if (room <= 0) {
      onToast(`Mỗi khách tối đa ${MAXPH} ảnh`);
      return 0;
    }
    if (valid.length > room) {
      onToast(`Mỗi khách tối đa ${MAXPH} ảnh, đã lấy ${room} ảnh đầu`);
    }
    const toTake = valid.slice(0, room);
    const newItems: PhotoItem[] = toTake.map(f => ({
      kind: 'new',
      file: f,
      url: URL.createObjectURL(f),
      ref: '',
    }));
    setPhotos(prev => [...prev, ...newItems]);
    return toTake.length;
  };

  const handleRemovePhoto = (index: number) => {
    const item = photos[index];
    if (item.kind === 'new' && item.url) {
      URL.revokeObjectURL(item.url);
    } else if (item.kind === 'old' && item.ref) {
      setRemovedRefs(prev => [...prev, item.ref]);
    }
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  // Clipboard paste handler
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items || []);
    const imgFiles: File[] = [];
    items.forEach(it => {
      if (it.kind === 'file' && it.type.startsWith('image/')) {
        const f = it.getAsFile();
        if (f) imgFiles.push(f);
      }
    });

    if (!imgFiles.length && e.clipboardData.files) {
      Array.from(e.clipboardData.files).forEach(f => {
        if (f.type.startsWith('image/')) imgFiles.push(f);
      });
    }

    if (imgFiles.length > 0) {
      e.preventDefault();
      const n = handleAddFiles(imgFiles);
      if (n > 0) onToast(`Đã dán ${n} ảnh. Bấm lưu để đăng kèm khách`);
      if (pasteBoxRef.current) pasteBoxRef.current.innerHTML = '';
    }
  };

  // Drag and drop handler
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    if (files.length > 0) {
      const n = handleAddFiles(files);
      if (n > 0) onToast(`Đã thêm ${n} ảnh. Bấm lưu để đăng kèm khách`);
    }
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    const trimmedBirth = birth.trim();

    if (!trimmedName) {
      onToast('Nhập tên khách');
      return;
    }
    if (trimmedBirth && !/^(19|20)\d{2}$/.test(trimmedBirth)) {
      onToast('Năm sinh gồm 4 chữ số, ví dụ 1990');
      return;
    }

    // Check duplicate
    if (!editingCustomer) {
      const dupKey = norm(trimmedName) + '|' + trimmedBirth;
      const dup = customers.find(
        c => norm(c.name) === norm(trimmedName) && (!trimmedBirth || !c.birth || c.birth === trimmedBirth)
      );

      if (dup && dupConfirmedKey !== dupKey) {
        setDupConfirmedKey(dupKey);
        setDupWarning(
          `Khách ${dup.name}${dup.birth ? ` (sinh ${dup.birth})` : ''} đã được NV ${dup.code} đăng lúc ${fmtT(
            dup.createdAt
          )}. Nếu đúng là người khác, bấm “Vẫn đăng”.`
        );
        setSaveButtonText('Vẫn đăng');
        return;
      }
    }

    setIsSaving(true);
    const uploadedPhotos: string[] = [];

    try {
      const freshPhotos = photos.filter(p => p.kind === 'new');
      let freshIdx = 0;

      for (const p of photos) {
        if (p.kind === 'old') {
          uploadedPhotos.push(p.ref);
        } else if (p.file) {
          freshIdx++;
          setSaveButtonText(`Đang tải ảnh ${freshIdx}/${freshPhotos.length}…`);
          const url = await store.uploadPhoto(p.file);
          if (p.url) URL.revokeObjectURL(p.url);
          uploadedPhotos.push(url);
        }
      }

      const now = Date.now();
      const obj = {
        name: trimmedName,
        birth: trimmedBirth,
        job: job.trim(),
        addr: addr.trim(),
        marital,
        kids: kids.trim(),
        rating,
        note: note.trim(),
        photos: uploadedPhotos,
        code: currentCode,
        createdAt: editingCustomer ? editingCustomer.createdAt : now,
        day: editingCustomer ? editingCustomer.day : dayKey(now),
        updatedAt: now,
      };

      const docId = editingCustomer ? editingCustomer.id : newId();
      await store.put('customers', docId, obj);

      if (removedRefs.length > 0) {
        store.dropAssets(removedRefs);
      }

      onToast(editingCustomer ? 'Đã lưu thay đổi' : `Đã đăng ${trimmedName} lên trang chủ`);
      resetForm();
    } catch (e: any) {
      console.error(e);
      onToast(e?.message || 'Chưa lưu được. Kiểm tra mạng rồi thử lại.');
    } finally {
      setIsSaving(false);
      setSaveButtonText(editingCustomer ? 'Lưu thay đổi' : 'Đăng lên trang chủ');
    }
  };

  const todayKey = dayKey(Date.now());
  const myTodayCustomers = customers.filter(c => c.code === currentCode && c.day === todayKey);

  return (
    <div>
      <div className="head">
        <h1>{editingCustomer ? 'Sửa thông tin khách' : 'Khách mới'}</h1>
        <p className="sub">Khách bạn đăng sẽ hiện ngay ở Trang chủ để cả đội cùng xem.</p>
      </div>

      <div className="panel">
        <div className="form">
          <label className="full">
            Tên
            <input
              placeholder="Ví dụ: Đinh Thị Thanh Huyền"
              autoComplete="off"
              value={name}
              onChange={e => {
                setName(e.target.value);
                if (dupWarning) {
                  setDupWarning(null);
                  setDupConfirmedKey(null);
                  setSaveButtonText(editingCustomer ? 'Lưu thay đổi' : 'Đăng lên trang chủ');
                }
              }}
            />
          </label>

          <label>
            Năm sinh
            <input
              inputMode="numeric"
              maxLength={4}
              placeholder="1990"
              value={birth}
              onChange={e => setBirth(e.target.value)}
            />
          </label>

          <label>
            Nghề nghiệp
            <input
              placeholder="Ví dụ: Giáo viên"
              value={job}
              onChange={e => setJob(e.target.value)}
            />
          </label>

          <label className="full">
            Địa chỉ
            <input
              placeholder="Phường/xã, quận/huyện, tỉnh"
              value={addr}
              onChange={e => setAddr(e.target.value)}
            />
          </label>

          <div className="field full">
            Tình trạng hôn nhân
            <div className="chips">
              {MARITAL_OPTIONS.map(v => (
                <button
                  key={v}
                  type="button"
                  className={`chip ${marital === v ? 'on' : ''}`}
                  onClick={() => setMarital(marital === v ? '' : v)}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          <label className="full">
            Con cái
            <input
              placeholder="Ví dụ: 2 con, bé lớn 8 tuổi"
              value={kids}
              onChange={e => setKids(e.target.value)}
            />
          </label>

          <div
            className={`field full ${isDragging ? 'drag' : ''}`}
            onDragOver={e => {
              if (Array.from(e.dataTransfer.types || []).includes('Files')) {
                e.preventDefault();
                setIsDragging(true);
              }
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <span>
              Hình ảnh khách <span className="sub" style={{ display: 'inline' }}>({photos.length}/{MAXPH} ảnh)</span>
            </span>

            <div className="photos">
              {photos.map((p, i) => {
                const src = p.kind === 'new' ? p.url : imgSrc(p.ref);
                return (
                  <div key={i} className={`ph ${p.kind === 'new' ? 'new' : ''}`}>
                    <img
                      src={src}
                      alt={`Ảnh ${i + 1}`}
                      onClick={() => src && onZoomPhoto(src)}
                    />
                    <button
                      type="button"
                      className="rm"
                      aria-label={`Bỏ ảnh ${i + 1}`}
                      onClick={() => handleRemovePhoto(i)}
                    >
                      ×
                    </button>
                  </div>
                );
              })}

              {photos.length < MAXPH && (
                <button
                  type="button"
                  className="addph"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <b>+</b>Thêm ảnh
                </button>
              )}
            </div>

            {photos.length < MAXPH && (
              <div
                ref={pasteBoxRef}
                className="pastebox"
                contentEditable
                inputMode="none"
                role="textbox"
                aria-label="Ô dán ảnh khách"
                data-ph="Dán ảnh vào đây: Ctrl+V trên máy tính, hoặc nhấn giữ vào ô này rồi chọn Dán trên điện thoại"
                onPaste={handlePaste}
                onBeforeInput={e => {
                  if ((e as any).inputType !== 'insertFromPaste') e.preventDefault();
                }}
                onInput={() => {
                  if (pasteBoxRef.current) pasteBoxRef.current.innerHTML = '';
                }}
              />
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={e => {
                if (e.target.files) handleAddFiles(e.target.files);
                e.target.value = '';
              }}
            />
          </div>

          <div className="field full">
            Đánh giá khách
            <div className="chips">
              <button
                type="button"
                className={`chip ${rating === 'cao' ? 'on' : ''}`}
                style={{ '--c': 'var(--s-vao_tien)' } as React.CSSProperties}
                onClick={() => setRating(rating === 'cao' ? '' : 'cao')}
              >
                Tiềm năng cao
              </button>
              <button
                type="button"
                className={`chip ${rating === 'tb' ? 'on' : ''}`}
                style={{ '--c': 'var(--s-dang_noi)' } as React.CSSProperties}
                onClick={() => setRating(rating === 'tb' ? '' : 'tb')}
              >
                Trung bình
              </button>
              <button
                type="button"
                className={`chip ${rating === 'thap' ? 'on' : ''}`}
                style={{ '--c': 'var(--s-moi)' } as React.CSSProperties}
                onClick={() => setRating(rating === 'thap' ? '' : 'thap')}
              >
                Thấp
              </button>
            </div>
            <textarea
              rows={3}
              placeholder="Nhận xét thêm: tính cách, nhu cầu, cách tiếp cận…"
              value={note}
              onChange={e => setNote(e.target.value)}
            />
          </div>
        </div>

        {dupWarning && (
          <div className="warn" role="alert">
            {dupWarning}
          </div>
        )}

        <div className="row-e">
          {editingCustomer && (
            <button type="button" className="btn ghost" onClick={resetForm}>
              Huỷ sửa
            </button>
          )}
          <button
            type="button"
            className="btn"
            disabled={isSaving}
            onClick={handleSave}
          >
            {saveButtonText}
          </button>
        </div>
      </div>

      <div className="panel">
        <div className="row-sb">
          <h2>Bạn đã đăng hôm nay</h2>
          <span className="sub">{myTodayCustomers.length} khách</span>
        </div>
        <div className="feed" style={{ marginTop: '12px' }}>
          {myTodayCustomers.length === 0 ? (
            <div className="empty">
              Chưa đăng khách nào hôm nay. Điền thông tin ở trên rồi bấm “Đăng lên trang chủ”.
            </div>
          ) : (
            myTodayCustomers.map(c => (
              <CustomerCard
                key={c.id}
                customer={c}
                currentCode={currentCode}
                onEdit={() => {
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                onDelete={async id => {
                  try {
                    await store.remove('customers', id);
                    if (c.photos) store.dropAssets(c.photos);
                    onToast(`Đã xoá ${c.name}`);
                    if (editingCustomer?.id === id) resetForm();
                  } catch (e: any) {
                    onToast(e?.message || 'Lỗi khi xoá khách');
                  }
                }}
                onZoomPhoto={onZoomPhoto}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};
