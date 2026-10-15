export const pad = (n: number | string) => String(n).padStart(2, '0');

export const dayKey = (t: number | Date = Date.now()): string => {
  const d = new Date(t);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const dm = (k: string): string => {
  const p = String(k).split('-');
  return p.length >= 3 ? `${p[2]}/${p[1]}` : k;
};

export const fmtT = (t: number): string => {
  const d = new Date(t);
  return `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
};

export const hm = (t: number): string => {
  const d = new Date(t);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const norm = (s: string = ''): string => {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
};

export const newId = (): string => 'k' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export const money = (n: number | string | undefined | null): string => {
  if (n === '' || n == null || Number.isNaN(Number(n))) return '';
  const num = Number(n);
  return num ? num.toLocaleString('vi-VN') : '';
};

export const nf = (n: number | string | undefined | null): string => {
  return Number(n || 0).toLocaleString('vi-VN');
};

export const pct = (x: number): string => {
  return (x * 100).toFixed(1).replace('.', ',') + '%';
};

export const curMonth = (): string => dayKey(Date.now()).slice(0, 7);

export const monthLabel = (m: string): string => 'Tháng ' + (+m.slice(5)) + '/' + m.slice(0, 4);

export const daysIn = (m: string): number => {
  return new Date(+m.slice(0, 4), +m.slice(5), 0).getDate();
};

export const elapsed = (m: string): number => {
  const c = curMonth();
  if (m === c) return +dayKey(Date.now()).slice(8);
  return m < c ? daysIn(m) : 0;
};

export const imgSrc = (r: string): string => {
  return /^(data:|https?:)/.test(String(r)) ? r : '/_blob/' + r;
};

export async function compressImage(file: File, max: number, q: number): Promise<Blob> {
  if (file.type === 'image/gif') return file;
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.naturalWidth * k));
    c.height = Math.max(1, Math.round(img.naturalHeight * k));
    const ctx = c.getContext('2d');
    if (ctx) ctx.drawImage(img, 0, 0, c.width, c.height);
    return await new Promise<Blob>(res => c.toBlob(b => res(b || file), 'image/jpeg', q));
  } catch (e) {
    return file;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function toDataURL(blob: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(blob);
  });
}
