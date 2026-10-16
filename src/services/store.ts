import { createClient, RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import {
  Customer,
  Report,
  SheetCustomer,
  StorageMode,
  LiveStatus,
  PresenceEntry,
  ActivityItem,
  DEFAULT_CODES,
  SKEY,
  LKEY,
  DKEY,
} from '../types';
import { compressImage, toDataURL, dm } from '../utils';

declare global {
  interface Window {
    SOKHACH_CONFIG?: {
      supabaseUrl?: string;
      supabaseAnonKey?: string;
      photoBucket?: string;
    };
  }
}

export interface StoreState {
  mode: StorageMode;
  live: LiveStatus;
  codes: string[];
  customers: Customer[];
  reports: Report[];
  sheet: SheetCustomer[];
  presence: PresenceEntry[];
  activity: ActivityItem[];
  lastSync: number;
  isAdmin: boolean;
}

export interface Identity {
  role: 'staff' | 'admin';
  code: string;
  view: string;
}

type Listener = (state: StoreState) => void;
type Collection = 'customers' | 'reports' | 'sheet';

const ACTIVITY_MAX = 100;
// Sửa bảng tính liên tục trong khoảng này chỉ ghi một dòng hoạt động.
const SHEET_COALESCE_MS = 2 * 60 * 1000;

function deviceId(): string {
  try {
    let id = localStorage.getItem(DKEY);
    if (!id) {
      id = 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      localStorage.setItem(DKEY, id);
    }
    return id;
  } catch (e) {
    return 'd' + Math.random().toString(36).slice(2, 10);
  }
}

function describeDevice(): { device: string; browser: string } {
  const ua = navigator.userAgent;
  const isTablet = /iPad|Tablet/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const isPhone = !isTablet && /Mobi|Android|iPhone/i.test(ua);
  const device = isTablet ? 'Máy tính bảng' : isPhone ? 'Điện thoại' : 'Máy tính';

  const os = /Android/i.test(ua)
    ? 'Android'
    : /iPhone|iPad|iPod/i.test(ua) || isTablet
      ? 'iOS'
      : /Windows/i.test(ua)
        ? 'Windows'
        : /Mac OS X/i.test(ua)
          ? 'macOS'
          : /Linux/i.test(ua)
            ? 'Linux'
            : '';
  const br = /Zalo/i.test(ua)
    ? 'Zalo'
    : /Edg\//.test(ua)
      ? 'Edge'
      : /CriOS|Chrome\//.test(ua)
        ? 'Chrome'
        : /FxiOS|Firefox\//.test(ua)
          ? 'Firefox'
          : /Safari\//.test(ua)
            ? 'Safari'
            : 'Trình duyệt';
  return { device, browser: os ? `${br} · ${os}` : br };
}

class AppStore {
  private state: StoreState = {
    mode: 'loading',
    live: 'connecting',
    codes: [...DEFAULT_CODES],
    customers: [],
    reports: [],
    sheet: [],
    presence: [],
    activity: [],
    lastSync: 0,
    isAdmin: false,
  };

  private listeners = new Set<Listener>();
  private sb: SupabaseClient | null = null;
  private bucket: string = 'photos';
  private docsChannel: RealtimeChannel | null = null;
  private presenceChannel: RealtimeChannel | null = null;
  private presenceJoined = false;
  // Bỏ qua đợt join đầu tiên: đó là các máy đã online sẵn, không phải vừa vào.
  private presenceSynced = false;
  private everSubscribed = false;
  private identity: Identity | null = null;
  private readonly me = { deviceId: deviceId(), since: Date.now(), ...describeDevice() };

  constructor() {
    this.init();
  }

  public subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.state);
    return () => this.listeners.delete(fn);
  }

  public getState(): StoreState {
    return this.state;
  }

  public get deviceId(): string {
    return this.me.deviceId;
  }

  private notify() {
    for (const fn of this.listeners) {
      fn(this.state);
    }
  }

  private setState(patch: Partial<StoreState>) {
    this.state = { ...this.state, ...patch };
    this.notify();
  }

  private loadLocal() {
    try {
      const raw = localStorage.getItem(LKEY);
      if (raw) {
        const x = JSON.parse(raw);
        this.state.customers = x.customers || [];
        this.state.reports = x.reports || [];
        this.state.sheet = x.sheet || [];
      }
    } catch (e) {
      console.warn('Failed to load local data', e);
    }

    try {
      const c = JSON.parse(localStorage.getItem(SKEY) || 'null');
      if (Array.isArray(c) && c.length) {
        this.state.codes = c.map(String);
      }
    } catch (e) {
      console.warn('Failed to load local codes', e);
    }
  }

  private saveLocal() {
    try {
      localStorage.setItem(
        LKEY,
        JSON.stringify({
          customers: this.state.customers,
          reports: this.state.reports,
          sheet: this.state.sheet,
        })
      );
    } catch (e) {
      console.warn('Failed to save local data', e);
    }
  }

  private async init() {
    const cfg = window.SOKHACH_CONFIG || {};
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || cfg.supabaseUrl;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || cfg.supabaseAnonKey;
    this.bucket = import.meta.env.VITE_SUPABASE_PHOTO_BUCKET || cfg.photoBucket || 'photos';

    if (supabaseUrl && supabaseAnonKey) {
      try {
        this.sb = createClient(supabaseUrl, supabaseAnonKey, {
          realtime: { params: { eventsPerSecond: 20 } },
        });
        this.setState({ mode: 'cloud' });
        this.setupSupabaseSync();
        return;
      } catch (e) {
        console.error('Supabase init error:', e);
      }
    }

    // Fallback to local
    this.loadLocal();
    this.setState({ mode: 'local', live: 'offline', isAdmin: true });
    this.refreshLocalPresence();
  }

  /** Tải lại toàn bộ dữ liệu, dùng lúc mở app và sau mỗi lần mất kết nối để không sót thay đổi. */
  public async loadAll() {
    if (!this.sb) return;
    const [custRes, repRes, sheetRes, staffRes] = await Promise.all([
      this.sb.from('docs').select('id,data').eq('collection', 'customers').order('data->createdAt', { ascending: false }).limit(1000),
      this.sb.from('docs').select('id,data').eq('collection', 'reports').order('data->updatedAt', { ascending: false }).limit(1000),
      this.sb.from('docs').select('id,data').eq('collection', 'sheet').order('data->createdAt', { ascending: true }).limit(5000),
      this.sb.from('docs').select('data').eq('collection', 'settings').eq('id', 'staff').maybeSingle(),
    ]);
    const err = custRes.error || repRes.error || sheetRes.error || staffRes.error;
    if (err) throw err;

    const patch: Partial<StoreState> = { lastSync: Date.now() };
    if (custRes.data) patch.customers = custRes.data.map(d => ({ id: d.id, ...d.data }));
    if (repRes.data) patch.reports = repRes.data.map(d => ({ id: d.id, ...d.data }));
    if (sheetRes.data) patch.sheet = sheetRes.data.map(d => ({ id: d.id, ...d.data }));
    if (staffRes.data && Array.isArray(staffRes.data.data?.codes) && staffRes.data.data.codes.length) {
      patch.codes = staffRes.data.data.codes.map(String);
    }
    this.setState(patch);
  }

  private async setupSupabaseSync() {
    if (!this.sb) return;

    try {
      await this.loadAll();
    } catch (e: any) {
      console.error('Supabase setup error:', e);
      // Máy chủ chưa chạy supabase/schema.sql: dùng tạm dữ liệu trên máy thay vì báo lỗi.
      if (e?.code === 'PGRST205' || e?.code === '42P01') {
        this.sb = null;
        this.loadLocal();
        this.setState({ mode: 'local', live: 'offline', isAdmin: true });
        this.refreshLocalPresence();
        return;
      }
      this.setState({ mode: 'error', live: 'offline' });
    }

    this.docsChannel = this.sb
      .channel('docs-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'docs' }, payload => {
        this.handleDocChange(payload);
      })
      .subscribe(status => {
        if (status === 'SUBSCRIBED') {
          const reconnect = this.everSubscribed;
          this.everSubscribed = true;
          this.setState({ live: 'live', mode: 'cloud' });
          // Lấy lại dữ liệu bị lỡ trong lúc mất mạng (hoặc lần tải đầu đã lỗi).
          if (reconnect || !this.state.lastSync) {
            this.loadAll().catch(e => {
              console.warn('Resync failed', e);
              if (!this.state.lastSync) this.setState({ mode: 'error' });
            });
          }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          this.setState({ live: 'offline' });
        }
      });

    this.presenceChannel = this.sb.channel('sokhach-presence', {
      config: { presence: { key: this.me.deviceId } },
    });
    this.presenceChannel
      .on('presence', { event: 'sync' }, () => {
        this.presenceSynced = true;
        this.syncPresence();
      })
      // currentPresences còn phần tử nghĩa là thiết bị chỉ đổi màn hình, không phải vào/rời app.
      .on('presence', { event: 'join' }, ({ currentPresences, newPresences }) => {
        if (!this.presenceSynced || currentPresences.length) return;
        newPresences.forEach((p: any) => this.logPresence(p as PresenceEntry, 'online'));
      })
      .on('presence', { event: 'leave' }, ({ currentPresences, leftPresences }) => {
        if (currentPresences.length) return;
        leftPresences.forEach((p: any) => this.logPresence(p as PresenceEntry, 'offline'));
      })
      .subscribe(status => {
        this.presenceJoined = status === 'SUBSCRIBED';
        if (this.presenceJoined) this.trackPresence();
      });

    // Điện thoại hay ngắt kết nối khi tắt màn hình: khi quay lại thì tải lại cho chắc.
    const resume = () => {
      if (document.visibilityState === 'visible' && this.state.live !== 'live') {
        this.loadAll().catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('online', resume);
    window.addEventListener('offline', () => this.setState({ live: 'offline' }));
  }

  /** Báo cho các máy khác biết thiết bị này đang mở app với vai trò nào và đang xem màn hình nào. */
  public identify(who: Identity | null) {
    this.identity = who;
    if (this.sb) this.trackPresence();
    else this.refreshLocalPresence();
  }

  private presencePayload(): PresenceEntry | null {
    if (!this.identity) return null;
    return {
      deviceId: this.me.deviceId,
      role: this.identity.role,
      code: this.identity.code,
      device: this.me.device,
      browser: this.me.browser,
      view: this.identity.view,
      since: this.me.since,
    };
  }

  private trackPresence() {
    if (!this.presenceChannel || !this.presenceJoined) return;
    const payload = this.presencePayload();
    if (payload) this.presenceChannel.track(payload).catch(() => {});
    else this.presenceChannel.untrack().catch(() => {});
  }

  private refreshLocalPresence() {
    const payload = this.presencePayload();
    this.setState({ presence: payload ? [payload] : [] });
  }

  private syncPresence() {
    if (!this.presenceChannel) return;
    const raw = this.presenceChannel.presenceState() as Record<string, any[]>;
    const list: PresenceEntry[] = [];
    Object.values(raw).forEach(metas => {
      // Một thiết bị mở nhiều tab: giữ bản mới nhất.
      const m = metas[metas.length - 1];
      if (m && m.deviceId) list.push(m as PresenceEntry);
    });
    list.sort((a, b) => a.since - b.since);
    this.setState({ presence: list });
  }

  private logPresence(p: PresenceEntry, kind: 'online' | 'offline') {
    if (!p || !p.deviceId || p.deviceId === this.me.deviceId || p.role !== 'staff') return;
    const who = `NV ${p.code}`;
    this.pushActivity({
      code: p.code,
      kind,
      text: kind === 'online' ? `${who} vào ứng dụng trên ${p.device.toLowerCase()}` : `${who} rời ứng dụng (${p.device.toLowerCase()})`,
    });
  }

  private pushActivity(item: Omit<ActivityItem, 'id' | 'at'>, coalesceMs = 0) {
    const now = Date.now();
    const list = [...this.state.activity];
    const head = list[0];
    if (coalesceMs && head && head.kind === item.kind && head.code === item.code && now - head.at < coalesceMs) {
      list[0] = { ...head, at: now, text: item.text };
    } else {
      list.unshift({ ...item, id: now.toString(36) + Math.random().toString(36).slice(2, 6), at: now });
    }
    this.setState({ activity: list.slice(0, ACTIVITY_MAX) });
  }

  private describeChange(col: string, eventType: string, data: any, prev: any) {
    const code = String(data?.code ?? prev?.code ?? '');
    const who = code ? `NV ${code}` : 'Một nhân viên';
    if (eventType === 'DELETE') {
      const what = col === 'customers' ? `khách ${prev?.name || ''}`.trim() : col === 'reports' ? 'một báo cáo' : 'một dòng khách hàng';
      this.pushActivity({ code, kind: 'delete', text: `${who} đã xoá ${what}` });
    } else if (col === 'reports') {
      const verb = prev ? 'cập nhật' : 'nộp';
      this.pushActivity({
        code,
        kind: 'report',
        text: `${who} ${verb} báo cáo ngày ${dm(data?.date || '')}: cào ${data?.scraped ?? 0}, vào tiền ${data?.vaoTien ?? 0}`,
      });
    } else if (col === 'customers') {
      const verb = prev ? 'sửa thông tin khách' : 'đăng khách mới';
      this.pushActivity({ code, kind: 'customer', text: `${who} ${verb}: ${data?.name || '(chưa có tên)'}` });
    } else if (col === 'sheet') {
      const name = data?.name ? `: ${data.name}` : '';
      this.pushActivity({ code, kind: 'sheet', text: `${who} cập nhật danh sách khách hàng${name}` }, SHEET_COALESCE_MS);
    }
  }

  private handleDocChange(payload: any) {
    const { eventType, new: newRow, old: oldRow } = payload;
    const col = newRow?.collection || oldRow?.collection;
    const id = newRow?.id || oldRow?.id;
    const data = newRow?.data;

    if (col === 'customers' || col === 'reports' || col === 'sheet') {
      const current = this.state[col as Collection] as any[];
      const prev = current.find(x => x.id === id);
      // Bỏ qua bản sao realtime của chính thay đổi vừa lưu từ máy này.
      const echo = eventType !== 'DELETE' && prev && JSON.stringify({ id, ...data }) === JSON.stringify(prev);
      if (!echo && !(eventType === 'DELETE' && !prev)) {
        this.describeChange(col, eventType, data, prev);
      }

      let list = [...current];
      if (eventType === 'DELETE') {
        list = list.filter(x => x.id !== id);
      } else {
        const idx = list.findIndex(x => x.id === id);
        const item = { id, ...data };
        if (idx >= 0) list[idx] = item;
        else if (col === 'sheet') list.push(item);
        else list.unshift(item);
      }
      this.setState({ [col]: list, lastSync: Date.now() } as any);
    } else if (col === 'settings' && id === 'staff') {
      if (data && Array.isArray(data.codes) && data.codes.length) {
        this.setState({ codes: data.codes.map(String), lastSync: Date.now() });
      }
    }
  }

  public async put(col: Collection, id: string, obj: any) {
    if (this.sb) {
      const { error } = await this.sb.from('docs').upsert({
        collection: col,
        id,
        data: obj,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
    }
    const list = [...(this.state[col] as any[])];
    const idx = list.findIndex(x => x.id === id);
    const row = { id, ...obj };
    if (idx >= 0) list[idx] = row;
    else list.unshift(row);
    this.setState({ [col]: list } as any);
    if (!this.sb) this.saveLocal();
  }

  public async remove(col: Collection, id: string) {
    if (this.sb) {
      const { error } = await this.sb.from('docs').delete().eq('collection', col).eq('id', id);
      if (error) throw error;
    }
    const list = (this.state[col] as any[]).filter(x => x.id !== id);
    this.setState({ [col]: list } as any);
    if (!this.sb) this.saveLocal();
  }

  public async uploadPhoto(file: File): Promise<string> {
    if (this.state.mode === 'local' || !this.sb) {
      const compressed = await compressImage(file, 900, 0.72);
      return await toDataURL(compressed);
    }

    const b = await compressImage(file, 1600, 0.82);
    const type = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(b.type) ? b.type : 'image/jpeg';
    const ext = { 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }[type] || 'jpg';
    const path =
      new Date().toISOString().slice(0, 7) + '/' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8) + '.' + ext;

    const { error } = await this.sb.storage.from(this.bucket).upload(path, b, { contentType: type, upsert: false });
    if (error) throw error;
    return this.sb.storage.from(this.bucket).getPublicUrl(path).data.publicUrl;
  }

  public async dropAssets(refs: string[]) {
    if (!this.sb) return;
    const mark = '/object/public/' + this.bucket + '/';
    for (const ref of refs) {
      const str = String(ref);
      const i = str.indexOf(mark);
      if (i >= 0) {
        const filePath = decodeURIComponent(str.slice(i + mark.length));
        await this.sb.storage.from(this.bucket).remove([filePath]).catch(() => {});
      }
    }
  }

  public async saveStaffCodes(list: string[]): Promise<boolean> {
    if (this.sb) {
      const { error } = await this.sb.from('docs').upsert({
        collection: 'settings',
        id: 'staff',
        data: { codes: list, updatedAt: Date.now() },
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      this.setState({ codes: list });
      return true;
    } else {
      try {
        localStorage.setItem(SKEY, JSON.stringify(list));
      } catch (e) {}
      this.setState({ codes: list });
      return true;
    }
  }
}

export const store = new AppStore();
