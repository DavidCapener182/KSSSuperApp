-- Storage remove needs row visibility for the same stale pending object it may delete.
drop policy if exists enterprise_document_cleanup_read on storage.objects;
create policy enterprise_document_cleanup_read on storage.objects for select to authenticated
  using (bucket_id = 'enterprise-personnel-evidence' and private.document_can_cleanup_key(name));
