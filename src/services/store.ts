import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Customer, Report, SheetCustomer, StorageMode, DEFAULT_CODES, SKEY, LKEY } from '../types';
import { compressImage, toDataURL } from '../utils';

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
  codes: string[];
  customers: Customer[];
  reports: Report[];
  sheet: SheetCustomer[];
  isAdmin: boolean;
}

type Listener = (state: StoreState) => void;

class AppStore {
  private state: StoreState = {
    mode: 'loading',
    codes: [...DEFAULT_CODES],
    customers: [],
    reports: [],
    sheet: [],
    isAdmin: false,
  };

  private listeners = new Set<Listener>();
  private sb: SupabaseClient | null = null;
  private bucket: string = 'photos';
  private unsubs: (() => void)[] = [];

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
        this.sb = createClient(supabaseUrl, supabaseAnonKey);
        this.setState({ mode: 'cloud' });
        this.setupSupabaseSync();
        return;
      } catch (e) {
        console.error('Supabase init error:', e);
      }
    }

    // Fallback to local
    this.loadLocal();
    this.setState({ mode: 'local', isAdmin: true });
  }

  private async setupSupabaseSync() {
    if (!this.sb) return;

    try {
      // 1. Initial loads
      const [custRes, repRes, sheetRes, staffRes] = await Promise.all([
        this.sb.from('docs').select('id,data').eq('collection', 'customers').order('data->createdAt', { ascending: false }).limit(1000),
        this.sb.from('docs').select('id,data').eq('collection', 'reports').order('data->updatedAt', { ascending: false }).limit(1000),
        this.sb.from('docs').select('id,data').eq('collection', 'sheet').order('data->createdAt', { ascending: true }).limit(5000),
        this.sb.from('docs').select('data').eq('collection', 'settings').eq('id', 'staff').maybeSingle(),
      ]);

      if (custRes.data) {
        this.state.customers = custRes.data.map(d => ({ id: d.id, ...d.data }));
      }
      if (repRes.data) {
        this.state.reports = repRes.data.map(d => ({ id: d.id, ...d.data }));
      }
      if (sheetRes.data) {
        this.state.sheet = sheetRes.data.map(d => ({ id: d.id, ...d.data }));
      }
      if (staffRes.data && Array.isArray(staffRes.data.data?.codes) && staffRes.data.data.codes.length) {
        this.state.codes = staffRes.data.data.codes.map(String);
      }

      this.setState({
        customers: [...this.state.customers],
        reports: [...this.state.reports],
        sheet: [...this.state.sheet],
        codes: [...this.state.codes],
      });

      // 2. Realtime subscription
      const channel = this.sb
        .channel('docs-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'docs' }, payload => {
          this.handleDocChange(payload);
        })
        .subscribe();

      this.unsubs.push(() => {
        channel.unsubscribe();
      });
    } catch (e) {
      console.error('Supabase setup error:', e);
      this.setState({ mode: 'error' });
    }
  }

  private handleDocChange(payload: any) {
    const { eventType, new: newRow, old: oldRow } = payload;
    const col = newRow?.collection || oldRow?.collection;
    const id = newRow?.id || oldRow?.id;
    const data = newRow?.data;

    if (col === 'customers') {
      let list = [...this.state.customers];
      if (eventType === 'DELETE') {
        list = list.filter(x => x.id !== id);
      } else {
        const idx = list.findIndex(x => x.id === id);
        const item = { id, ...data };
        if (idx >= 0) list[idx] = item;
        else list.unshift(item);
      }
      this.setState({ customers: list });
    } else if (col === 'reports') {
      let list = [...this.state.reports];
      if (eventType === 'DELETE') {
        list = list.filter(x => x.id !== id);
      } else {
        const idx = list.findIndex(x => x.id === id);
        const item = { id, ...data };
        if (idx >= 0) list[idx] = item;
        else list.unshift(item);
      }
      this.setState({ reports: list });
    } else if (col === 'sheet') {
      let list = [...this.state.sheet];
      if (eventType === 'DELETE') {
        list = list.filter(x => x.id !== id);
      } else {
        const idx = list.findIndex(x => x.id === id);
        const item = { id, ...data };
        if (idx >= 0) list[idx] = item;
        else list.push(item);
      }
      this.setState({ sheet: list });
    } else if (col === 'settings' && id === 'staff') {
      if (data && Array.isArray(data.codes) && data.codes.length) {
        this.setState({ codes: data.codes.map(String) });
      }
    }
  }

  public async put(col: 'customers' | 'reports' | 'sheet', id: string, obj: any) {
    if (this.sb) {
      const { error } = await this.sb.from('docs').upsert({
        collection: col,
        id,
        data: obj,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      // Optimistic update
      const list = [...(this.state[col] as any[])];
      const idx = list.findIndex(x => x.id === id);
      const row = { id, ...obj };
      if (idx >= 0) list[idx] = row;
      else list.unshift(row);
      this.setState({ [col]: list } as any);
    } else {
      const list = [...(this.state[col] as any[])];
      const idx = list.findIndex(x => x.id === id);
      const row = { id, ...obj };
      if (idx >= 0) list[idx] = row;
      else list.unshift(row);
      this.setState({ [col]: list } as any);
      this.saveLocal();
    }
  }

  public async remove(col: 'customers' | 'reports' | 'sheet', id: string) {
    if (this.sb) {
      const { error } = await this.sb.from('docs').delete().eq('collection', col).eq('id', id);
      if (error) throw error;
      const list = (this.state[col] as any[]).filter(x => x.id !== id);
      this.setState({ [col]: list } as any);
    } else {
      const list = (this.state[col] as any[]).filter(x => x.id !== id);
      this.setState({ [col]: list } as any);
      this.saveLocal();
    }
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
