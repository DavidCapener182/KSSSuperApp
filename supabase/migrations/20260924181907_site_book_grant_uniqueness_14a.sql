-- One unrevoked grant per Person, Service and kind prevents a second grant silently retaining access after revocation.
create unique index site_book_one_unrevoked_grant_14a on public.site_book_grants(service_id,person_id,kind) where revoked_at is null;
