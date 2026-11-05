-- Completed advance orders: restore Remarks / Reference Number on their invoice rows.
-- Older completions created the final order without copying these fields from the advance order,
-- so Order History -> Edit showed them empty. Fills ONLY fields that are empty on the order;
-- values already present (including ones edited later in Order History) are never overwritten.
-- No other columns or rows are touched. Safe to run more than once.
BEGIN;

UPDATE public.orders o
SET remarks = a.remarks
FROM public.advance_orders a
WHERE a.completed_order_id = o.id
  AND trim(coalesce(o.remarks, '')) = ''
  AND trim(coalesce(a.remarks, '')) <> '';

UPDATE public.orders o
SET reference_number = a.reference_number
FROM public.advance_orders a
WHERE a.completed_order_id = o.id
  AND trim(coalesce(o.reference_number, '')) = ''
  AND trim(coalesce(a.reference_number, '')) <> '';

COMMIT;
