-- Preserve issued invoices. All current POS and advance completion RPCs use
-- get_next_invoice_no(); dates play no part in allocation.
BEGIN;
CREATE OR REPLACE FUNCTION public.get_next_invoice_no()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
VOLATILE
AS $$
DECLARE
  v_highest bigint;
  v_next bigint;
BEGIN
  -- Serialize allocation and high-water repair across concurrent transactions.
  PERFORM pg_advisory_xact_lock(404, 34);
  SELECT COALESCE(MAX(n), 0) INTO v_highest
  FROM (
    SELECT substring(invoice_no from '^(?:INV)?([0-9]+)$')::bigint AS n
      FROM public.orders WHERE invoice_no ~ '^(INV)?[0-9]{1,18}$'
    UNION ALL
    SELECT substring(invoice_number from '^(?:INV)?([0-9]+)$')::bigint
      FROM public.advance_orders WHERE invoice_number ~ '^(INV)?[0-9]{1,18}$'
    UNION ALL
    SELECT substring(invoice_no from '^UL-[0-9]{8}-([0-9]+)$')::bigint
      FROM public.orders WHERE invoice_no ~ '^UL-[0-9]{8}-[0-9]{1,18}$'
    UNION ALL
    SELECT substring(invoice_number from '^UL-[0-9]{8}-([0-9]+)$')::bigint
      FROM public.advance_orders WHERE invoice_number ~ '^UL-[0-9]{8}-[0-9]{1,18}$'
  ) issued;
  v_next := nextval('public.invoice_sequence');
  IF v_next <= v_highest THEN
    v_next := v_highest + 1;
    PERFORM setval('public.invoice_sequence', v_next, true);
  END IF;
  -- LPAD alone truncates numbers longer than its requested width.
  RETURN lpad(v_next::text, greatest(8, length(v_next::text)), '0');
END;
$$;
NOTIFY pgrst, 'reload schema';
COMMIT;
