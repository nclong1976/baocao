import { Customer, SheetCustomer } from '../types';
import { norm } from '../utils';

export interface DupInput {
  name?: string;
  birth?: string;
  addr?: string;
  job?: string;
}

export interface DupMatch {
  source: 'customers' | 'sheet';
  id: string;
  code: string;
  name: string;
  birth?: string;
  addr?: string;
  job?: string;
  at: number;
  level: 'exact' | 'likely';
  reasons: string[];
}

export interface DupOptions {
  /** Mã nhân viên đang nhập. */
  code: string;
  /** Nơi đang nhập: form Khách mới hay bảng Danh sách khách hàng. */
  context: 'customer' | 'sheet';
  excludeId?: string;
}

// Tên gần giống từ mức này trở lên (sai một vài chữ) thì coi là có thể trùng.
const NAME_SIMILAR = 0.85;
const ADDR_SIMILAR = 0.8;

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

export function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  return 1 - levenshtein(a, b) / Math.max(a.length, b.length);
}

/** Bỏ dấu, chữ thường, xếp các chữ theo thứ tự để "Lan Nguyễn Thị" khớp "Nguyễn Thị Lan". */
export function nameKey(s?: string): string {
  return norm(s || '')
    .replace(/[^a-z0-9 ]/g, '')
    .split(' ')
    .filter(Boolean)
    .sort()
    .join(' ');
}

function addrSimilar(a?: string, b?: string): boolean {
  const x = norm(a || '');
  const y = norm(b || '');
  if (x.length < 3 || y.length < 3) return false;
  return x === y || x.includes(y) || y.includes(x) || similarity(x, y) >= ADDR_SIMILAR;
}

function compare(input: DupInput, cand: DupInput): Pick<DupMatch, 'level' | 'reasons'> | null {
  const a = nameKey(input.name);
  const b = nameKey(cand.name);
  if (a.length < 3 || b.length < 3) return null;

  const birthA = (input.birth || '').trim();
  const birthB = (cand.birth || '').trim();
  // Khác năm sinh thì chắc chắn là hai người khác nhau.
  if (birthA && birthB && birthA !== birthB) return null;
  const sameBirth = !!birthA && birthA === birthB;
  const sameAddr = addrSimilar(input.addr, cand.addr);
  const sameJob = !!norm(input.job || '') && norm(input.job || '') === norm(cand.job || '');

  const reasons: string[] = [];
  let level: DupMatch['level'];
  if (a === b) {
    level = 'exact';
    reasons.push('Trùng họ tên');
  } else if (similarity(a, b) >= NAME_SIMILAR && (sameBirth || sameAddr)) {
    level = 'likely';
    reasons.push('Tên gần giống');
  } else {
    return null;
  }
  if (sameBirth) reasons.push('Trùng năm sinh');
  if (sameAddr) reasons.push('Cùng nơi ở');
  if (sameJob) reasons.push('Cùng nghề');
  return { level, reasons };
}

/**
 * Rà soát khách vừa nhập với toàn bộ khách đã đăng và danh sách khách hàng của cả đội.
 * Bỏ qua trường hợp bình thường: nhân viên vừa đăng khách vừa ghi chính khách đó vào bảng của mình.
 */
export function findDuplicates(
  input: DupInput,
  customers: Customer[],
  sheet: SheetCustomer[],
  opt: DupOptions
): DupMatch[] {
  if (nameKey(input.name).length < 3) return [];
  const out: DupMatch[] = [];

  for (const c of customers) {
    if (c.id === opt.excludeId) continue;
    if (opt.context === 'sheet' && c.code === opt.code) continue;
    const m = compare(input, c);
    if (m) {
      out.push({
        source: 'customers',
        id: c.id,
        code: c.code,
        name: c.name,
        birth: c.birth,
        addr: c.addr,
        job: c.job,
        at: c.createdAt || c.updatedAt || 0,
        ...m,
      });
    }
  }

  for (const r of sheet) {
    if (r.id === opt.excludeId) continue;
    if (opt.context === 'customer' && r.code === opt.code) continue;
    const m = compare(input, r);
    if (m) {
      out.push({
        source: 'sheet',
        id: r.id,
        code: r.code,
        name: r.name || '',
        addr: r.addr,
        job: r.job,
        at: r.createdAt || r.updatedAt || 0,
        ...m,
      });
    }
  }

  return out.sort((x, y) => (x.level === y.level ? y.at - x.at : x.level === 'exact' ? -1 : 1));
}

export interface DupGroup {
  key: string;
  items: DupMatch[];
}

/** Các nhóm khách trùng nhau trong toàn bộ dữ liệu, cho trang quản lý. */
export function duplicateGroups(customers: Customer[], sheet: SheetCustomer[]): DupGroup[] {
  const all: DupMatch[] = [
    ...customers.map(c => ({
      source: 'customers' as const,
      id: c.id,
      code: c.code,
      name: c.name,
      birth: c.birth,
      addr: c.addr,
      job: c.job,
      at: c.createdAt || 0,
      level: 'exact' as const,
      reasons: [],
    })),
    ...sheet
      .filter(r => r.name)
      .map(r => ({
        source: 'sheet' as const,
        id: r.id,
        code: r.code,
        name: r.name || '',
        addr: r.addr,
        job: r.job,
        at: r.createdAt || 0,
        level: 'exact' as const,
        reasons: [],
      })),
  ];

  const byName = new Map<string, DupMatch[]>();
  for (const it of all) {
    const k = nameKey(it.name);
    if (k.length < 3) continue;
    byName.set(k, [...(byName.get(k) || []), it]);
  }

  const groups: DupGroup[] = [];
  byName.forEach((items, k) => {
    // Tách theo năm sinh; mục không có năm sinh đi theo mọi nhóm năm sinh.
    const births = Array.from(new Set(items.map(i => i.birth).filter(Boolean))) as string[];
    const buckets = births.length ? births.map(b => items.filter(i => !i.birth || i.birth === b)) : [items];
    buckets.forEach((g, idx) => {
      if (g.length < 2) return;
      // Một nhân viên vừa đăng khách vừa ghi vào bảng của mình là bình thường, không phải trùng.
      const codes = new Set(g.map(i => i.code));
      const perSource = (s: DupMatch['source']) => g.filter(i => i.source === s).length;
      if (codes.size === 1 && perSource('customers') <= 1 && perSource('sheet') <= 1) return;
      groups.push({ key: `${k}|${births[idx] || ''}`, items: g.sort((a, b) => a.at - b.at) });
    });
  });

  return groups.sort((a, b) => b.items[b.items.length - 1].at - a.items[a.items.length - 1].at);
}
