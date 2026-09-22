-- SDK remove() uses the Storage delete_many operation. Keep SELECT limited to it.
drop policy if exists enterprise_document_cleanup_read on storage.objects;
create policy enterprise_document_cleanup_read on storage.objects for select to authenticated
  using (bucket_id = 'enterprise-personnel-evidence'
    and storage.allow_only_operation('object.delete_many')
    and private.document_can_cleanup_key(name));
