-- Chạy một lần trong Supabase > SQL Editor.

-- Mọi dữ liệu (customers, reports, settings) nằm chung một bảng dạng tài liệu.
create table if not exists public.docs (
  collection text not null,
  id         text not null,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (collection, id)
);
create index if not exists docs_date_idx on public.docs (collection, (data->>'date'));

alter table public.docs enable row level security;
drop policy if exists "docs public access" on public.docs;
create policy "docs public access" on public.docs for all to anon, authenticated using (true) with check (true);

-- Realtime để các máy tự cập nhật khi có người lưu.
alter publication supabase_realtime add table public.docs;

-- Bucket ảnh công khai, tối đa 20MB mỗi ảnh.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', true, 20971520, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do nothing;

drop policy if exists "photos read" on storage.objects;
drop policy if exists "photos upload" on storage.objects;
drop policy if exists "photos delete" on storage.objects;
create policy "photos read"   on storage.objects for select to anon, authenticated using (bucket_id = 'photos');
create policy "photos upload" on storage.objects for insert to anon, authenticated with check (bucket_id = 'photos');
create policy "photos delete" on storage.objects for delete to anon, authenticated using (bucket_id = 'photos');
