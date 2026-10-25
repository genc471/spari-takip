-- Müşteri takip sayfası v3: + firma logosu (firma_logo). Supabase → SQL Editor'de BİR KEZ çalıştırın.
-- Diğer alanlar v2 (meydan-ve-takip-v2.sql) ile aynıdır; yalnız logo eklendi.
--
-- Logo önceliği: siparişin firmasının (marka) logosu → yoksa Firma Profili logosu. Profil logosu
-- yalnız tek firmalı hesapta ya da siparişte firma seçili değilse kullanılır (çok firmalı hesapta
-- başka firmanın logosu görünmesin). Adresler uygulamanın yüklediği https bağlantılarıdır.
create or replace function public.track_order(order_id text)
returns json language plpgsql security definer set search_path = public as $$
declare o record; b jsonb; br jsonb; logo text;
begin
  select * into o from public.orders where id = order_id and not deleted;
  if not found then
    return json_build_object('bulundu', false);
  end if;
  select payload into b from public.backups where user_id = o.firma_id;
  select x into br from jsonb_array_elements(coalesce(b -> 'brands', '[]'::jsonb)) as x
   where x ->> 'id' = o.data ->> 'brandId' limit 1;
  logo := coalesce(
    nullif(br ->> 'logoUrl', ''),
    case when br is null or jsonb_array_length(coalesce(b -> 'brands', '[]'::jsonb)) <= 1
         then nullif(b -> 'settings' ->> 'logoUrl', '') end
  );
  if logo !~ '^https://' then logo := null; end if;
  return json_build_object(
    'bulundu', true,
    'firma_adi', coalesce(nullif(br ->> 'name', ''), b -> 'settings' ->> 'companyName'),
    'firma_tel', coalesce(nullif(br ->> 'phone', ''), nullif(b -> 'settings' ->> 'companyPhone', '')),
    'firma_logo', logo,
    'durum', o.data ->> 'status',
    'alis_tarihi', o.data ->> 'pickupDate',
    'teslim_tarihi', o.data ->> 'deliveryDate',
    'parca', nullif(o.data ->> 'carpetCount', '0'),
    'urun_ozet', coalesce((
      select string_agg(
        (case when item ->> 'unit' = 'm²' then coalesce(item ->> 'adet', '1') else coalesce(nullif(item ->> 'quantity', ''), '1') end)
          || ' ' || (item ->> 'productName'),
        ', ')
      from jsonb_array_elements(o.data -> 'items') as item
    ), '')
  );
end $$;
grant execute on function public.track_order(text) to anon, authenticated;
