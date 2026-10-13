/*
 * Lớp lưu trữ dùng chung cho bản deploy trên GitHub Pages.
 *
 * Ứng dụng gốc gọi window.claude.use('db' | 'assets' | 'user'). File này cung cấp
 * cùng giao diện đó nhưng chạy trên Supabase (bảng `docs` + bucket ảnh `photos`).
 * Nếu config.js để trống, không định nghĩa gì cả => ứng dụng chạy chế độ "lưu trên máy".
 */
(function () {
  const cfg = window.SOKHACH_CONFIG || {};
  if (!cfg.supabaseUrl || !cfg.supabaseAnonKey || !window.supabase) return;

  const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
  const BUCKET = cfg.photoBucket || 'photos';
  const fail = (e, code) => Object.assign(new Error((e && e.message) || code), { code: code || 'unavailable' });

  // Mỗi collection có một kênh realtime; mọi listener của collection đó dùng chung.
  const channels = {};
  function watch(col, fn) {
    let ch = channels[col];
    if (!ch) {
      ch = channels[col] = { fns: new Set(), sub: null };
      ch.sub = sb.channel('docs-' + col)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'docs', filter: 'collection=eq.' + col },
          () => ch.fns.forEach(f => f()))
        .subscribe();
    }
    ch.fns.add(fn);
    return () => ch.fns.delete(fn);
  }
  function debounce(fn, ms) { let t; return () => { clearTimeout(t); t = setTimeout(fn, ms); }; }

  const OPS = { '>=': 'gte', '<=': 'lte', '>': 'gt', '<': 'lt', '==': 'eq' };

  function query(col, st) {
    const q = st || { wheres: [], order: null, limit: 1000 };
    const next = patch => query(col, Object.assign({}, q, patch));
    return {
      where: (f, op, v) => next({ wheres: q.wheres.concat([[f, op, v]]) }),
      orderBy: (f, dir) => next({ order: [f, dir === 'desc'] }),
      limit: n => next({ limit: n }),
      doc: id => docRef(col, id),
      async get() {
        let r = sb.from('docs').select('id,data').eq('collection', col);
        q.wheres.forEach(([f, op, v]) => { r = r[OPS[op] || 'eq']('data->>' + f, v); });
        if (q.order) r = r.order('data->' + q.order[0], { ascending: !q.order[1] });
        const { data, error } = await r.limit(q.limit);
        if (error) throw fail(error);
        return { docs: data.map(row => ({ id: row.id, data: () => row.data })) };
      },
      onSnapshot(cb, onErr) {
        let alive = true;
        const load = () => this.get().then(s => alive && cb(s), e => alive && onErr && onErr(e));
        const off = watch(col, debounce(load, 150));
        load();
        return () => { alive = false; off(); };
      }
    };
  }

  function docRef(col, id) {
    return {
      async set(obj) {
        const { error } = await sb.from('docs').upsert({ collection: col, id, data: obj, updated_at: new Date().toISOString() });
        if (error) throw fail(error);
      },
      async delete() {
        const { error } = await sb.from('docs').delete().eq('collection', col).eq('id', id);
        if (error) throw fail(error);
      },
      async get() {
        const { data, error } = await sb.from('docs').select('data').eq('collection', col).eq('id', id).maybeSingle();
        if (error) throw fail(error);
        return { exists: !!data, data: () => data && data.data };
      },
      onSnapshot(cb, onErr) {
        let alive = true;
        const load = () => this.get().then(s => alive && cb(s), e => alive && onErr && onErr(e));
        const off = watch(col, debounce(load, 150));
        load();
        return () => { alive = false; off(); };
      }
    };
  }

  const db = {
    collection: col => query(col),
    doc: path => { const [col, id] = path.split('/'); return docRef(col, id); }
  };

  const assets = {
    async upload(blob, opts) {
      const type = (opts && opts.type) || blob.type || 'image/jpeg';
      const ext = { 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }[type] || 'jpg';
      const path = new Date().toISOString().slice(0, 7) + '/' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8) + '.' + ext;
      const { error } = await sb.storage.from(BUCKET).upload(path, blob, { contentType: type, upsert: false });
      if (error) throw fail(error, /size|large/i.test(error.message || '') ? 'too_large' : 'store_unavailable');
      return { id: sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl };
    },
    async delete(ref) {
      const mark = '/object/public/' + BUCKET + '/';
      const i = String(ref).indexOf(mark);
      if (i < 0) return;
      await sb.storage.from(BUCKET).remove([decodeURIComponent(String(ref).slice(i + mark.length))]);
    }
  };

  window.claude = window.claude || {};
  window.claude.use = async name => (name === 'db' ? db : name === 'assets' ? assets : null);
})();
