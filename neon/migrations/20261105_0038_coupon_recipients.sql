-- Customer-specific coupons (additive only; no existing rows are changed).
--   * coupons.restrict_to_recipients: when TRUE the coupon only works for phones it was sent to.
--   * coupon_recipients: who a coupon was sent to (admin "Send" dialog), one row per coupon + phone.
--   * orders trigger: rejects saving a bill that uses a restricted coupon for any other phone number,
--     so the rule is enforced by the database, not only by the UI.
BEGIN;

ALTER TABLE public.coupons
  ADD COLUMN IF NOT EXISTS restrict_to_recipients BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS public.coupon_recipients (
  id BIGSERIAL PRIMARY KEY,
  coupon_code TEXT NOT NULL CHECK (coupon_code = UPPER(BTRIM(coupon_code)) AND coupon_code <> ''),
  phone TEXT NOT NULL CHECK (phone ~ '^[0-9]{10}$'),
  customer_name TEXT NOT NULL DEFAULT '',
  sent_count INTEGER NOT NULL DEFAULT 1 CHECK (sent_count >= 0),
  first_sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS coupon_recipients_code_phone_unique
  ON public.coupon_recipients (coupon_code, phone);

CREATE OR REPLACE FUNCTION public.coupon_phone10(p TEXT) RETURNS TEXT
LANGUAGE sql IMMUTABLE AS $$ SELECT RIGHT(regexp_replace(COALESCE(p, ''), '\D', '', 'g'), 10) $$;

CREATE OR REPLACE FUNCTION public.enforce_coupon_recipient() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE v_restricted BOOLEAN;
BEGIN
  IF NEW.coupon_code IS NULL OR BTRIM(NEW.coupon_code) = '' THEN RETURN NEW; END IF;
  SELECT c.restrict_to_recipients INTO v_restricted
    FROM public.coupons c WHERE UPPER(BTRIM(c.code)) = UPPER(BTRIM(NEW.coupon_code)) LIMIT 1;
  IF COALESCE(v_restricted, FALSE) AND NOT EXISTS (
    SELECT 1 FROM public.coupon_recipients r
     WHERE r.coupon_code = UPPER(BTRIM(NEW.coupon_code))
       AND r.phone = public.coupon_phone10(NEW.phone)
  ) THEN
    RAISE EXCEPTION 'Coupon % is only valid for the mobile numbers it was sent to.', UPPER(BTRIM(NEW.coupon_code))
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS orders_enforce_coupon_recipient ON public.orders;
CREATE TRIGGER orders_enforce_coupon_recipient
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.enforce_coupon_recipient();

-- Called by the admin Send dialog (signed-in staff/admin only, via the RPC allow-list).
CREATE OR REPLACE FUNCTION public.record_coupon_send(p_code TEXT, p_phone TEXT, p_customer_name TEXT DEFAULT '')
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE v_code TEXT := UPPER(BTRIM(COALESCE(p_code, ''))); v_phone TEXT := public.coupon_phone10(p_phone);
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.coupons WHERE UPPER(BTRIM(code)) = v_code) THEN
    RAISE EXCEPTION 'Coupon not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_phone !~ '^[6-9][0-9]{9}$' THEN RAISE EXCEPTION 'Enter a valid 10-digit mobile number' USING ERRCODE = '22023'; END IF;
  INSERT INTO public.coupon_recipients (coupon_code, phone, customer_name)
  VALUES (v_code, v_phone, LEFT(BTRIM(COALESCE(p_customer_name, '')), 60))
  ON CONFLICT (coupon_code, phone) DO UPDATE
    SET sent_count = public.coupon_recipients.sent_count + 1,
        last_sent_at = NOW(),
        customer_name = CASE WHEN EXCLUDED.customer_name <> '' THEN EXCLUDED.customer_name ELSE public.coupon_recipients.customer_name END;
  RETURN (SELECT jsonb_build_object('phones', COUNT(*), 'sent', COALESCE(SUM(sent_count), 0))
            FROM public.coupon_recipients WHERE coupon_code = v_code);
END $$;

COMMIT;
