-- Per-side pumping amounts. amount_ml stays as the total (left + right), so
-- existing queries and history keep working.
alter table pumping_sessions
  add column if not exists amount_left_ml numeric,
  add column if not exists amount_right_ml numeric;

-- Backfill single-side sessions from the existing total. Sessions logged as
-- "both" only ever had a total, so their split stays unknown (null).
update pumping_sessions set amount_left_ml = amount_ml where side = 'left' and amount_ml is not null and amount_left_ml is null;
update pumping_sessions set amount_right_ml = amount_ml where side = 'right' and amount_ml is not null and amount_right_ml is null;
