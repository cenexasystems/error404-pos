-- Order History sorting: record when each bill was actually completed.
-- created_at holds the BILLING DATE chosen at the counter (it can be set to a future or past date),
-- so sorting by it can place a newer bill below older ones. completed_at is the real time the bill
-- was saved. Additive only: invoice numbers, billing dates, totals and every other column are untouched.
BEGIN;

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Every new bill (POS sale, completed advance order, manual bill) gets the real save time
-- automatically; none of the billing functions need to change.
ALTER TABLE public.orders ALTER COLUMN completed_at SET DEFAULT NOW();

-- Existing bills: updated_at is set to NOW() when a bill is saved, created_at is the billing date.
-- The earlier of the two is the best record of the save time for a bill whose billing date was set
-- ahead (the reported case), and equals created_at for normally dated bills.
UPDATE public.orders
SET completed_at = LEAST(created_at, COALESCE(updated_at, created_at))
WHERE completed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_orders_completed_at ON public.orders (completed_at DESC, created_at DESC);

NOTIFY pgrst, 'reload schema';

COMMIT;
