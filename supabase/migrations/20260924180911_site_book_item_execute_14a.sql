-- Restore the guarded item-history RPC grant after replacing its function body.
grant execute on function public.site_book_item_history_14a(uuid) to authenticated;
