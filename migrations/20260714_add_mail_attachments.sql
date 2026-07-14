insert into storage.buckets (id, name, public, file_size_limit)
values ('mail-attachments', 'mail-attachments', false, 10485760)
on conflict (id) do update set public = false, file_size_limit = 10485760;

drop policy if exists "Service role can manage mail attachments" on storage.objects;
create policy "Service role can manage mail attachments" on storage.objects
for all to service_role using (bucket_id = 'mail-attachments') with check (bucket_id = 'mail-attachments');
