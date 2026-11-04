-- Review before production: preserves valid unique codes and records every repaired assignment.
-- Duplicate printed labels are inherently ambiguous: reprint only audited changed codes.
BEGIN;
LOCK TABLE public.products, public.product_variants, public.barcode_registry IN SHARE ROW EXCLUSIVE MODE;
CREATE TABLE IF NOT EXISTS public.barcode_repair_audit (
  id bigserial PRIMARY KEY, entity_type text NOT NULL, product_id bigint NOT NULL,
  variant_id uuid, old_barcode text, new_barcode text NOT NULL, repaired_at timestamptz DEFAULT now()
);
CREATE OR REPLACE FUNCTION public.generate_barcode_value(p_entity_type text)
RETURNS text LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v text; n text;
BEGIN
  LOOP
    n := nextval(CASE WHEN p_entity_type = 'variant' THEN 'public.barcode_variant_seq' ELSE 'public.barcode_product_seq' END)::text;
    v := CASE WHEN p_entity_type = 'variant' THEN 'ULV' ELSE 'ULP' END || lpad(n, greatest(8,length(n)), '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.barcode_registry WHERE upper(btrim(barcode_value)) = v)
      AND NOT EXISTS (SELECT 1 FROM public.products WHERE upper(btrim(barcode)) = v)
      AND NOT EXISTS (SELECT 1 FROM public.product_variants WHERE upper(btrim(barcode)) = v);
  END LOOP;
  RETURN v;
END; $$;

-- Retain the oldest registry owner of a case-insensitive duplicate.
DO $$ DECLARE r record; v text; BEGIN
  FOR r IN SELECT * FROM (
    SELECT b.*, row_number() OVER (PARTITION BY upper(btrim(barcode_value)) ORDER BY created_at,id) AS position
    FROM public.barcode_registry b
  ) duplicates WHERE position > 1 LOOP
    v := public.generate_barcode_value(r.entity_type);
    INSERT INTO public.barcode_repair_audit(entity_type,product_id,variant_id,old_barcode,new_barcode)
      VALUES(r.entity_type,r.product_id,r.variant_id,r.barcode_value,v);
    UPDATE public.barcode_registry SET barcode_value=v WHERE id=r.id;
    IF r.variant_id IS NOT NULL THEN
      UPDATE public.product_variants SET barcode=v WHERE id=r.variant_id AND upper(btrim(barcode))=upper(btrim(r.barcode_value));
    ELSE
      UPDATE public.products SET barcode=v WHERE id=r.product_id AND upper(btrim(barcode))=upper(btrim(r.barcode_value));
    END IF;
  END LOOP;
END; $$;
CREATE UNIQUE INDEX IF NOT EXISTS barcode_registry_normalized_unique ON public.barcode_registry(upper(btrim(barcode_value)));

-- Registry ownership wins. Otherwise the oldest product/variant keeps its existing code.
DO $$ DECLARE r record; owner public.barcode_registry; v text; BEGIN
  FOR r IN
    SELECT 'product'::text AS kind,id AS product_id,NULL::uuid AS variant_id,barcode,created_at FROM public.products WHERE nullif(btrim(barcode),'') IS NOT NULL
    UNION ALL
    SELECT 'variant',product_id,id,barcode,created_at FROM public.product_variants
    ORDER BY created_at NULLS LAST,product_id,variant_id NULLS FIRST
  LOOP
    v := nullif(btrim(r.barcode),'');
    IF v IS NULL THEN
      SELECT barcode_value INTO v FROM public.barcode_registry
        WHERE variant_id=r.variant_id AND is_active ORDER BY created_at,id LIMIT 1;
      v := coalesce(v, public.generate_barcode_value(r.kind));
    END IF;
    SELECT * INTO owner FROM public.barcode_registry WHERE upper(btrim(barcode_value))=upper(v);
    IF FOUND AND (owner.product_id IS DISTINCT FROM r.product_id OR owner.variant_id IS DISTINCT FROM r.variant_id) THEN
      v := public.generate_barcode_value(r.kind);
    END IF;
    IF v IS DISTINCT FROM r.barcode THEN
      INSERT INTO public.barcode_repair_audit(entity_type,product_id,variant_id,old_barcode,new_barcode)
        VALUES(r.kind,r.product_id,r.variant_id,r.barcode,v);
      IF r.variant_id IS NULL THEN UPDATE public.products SET barcode=v WHERE id=r.product_id;
      ELSE UPDATE public.product_variants SET barcode=v WHERE id=r.variant_id; END IF;
    END IF;
    IF NOT EXISTS(SELECT 1 FROM public.barcode_registry WHERE upper(btrim(barcode_value))=upper(v)) THEN
      INSERT INTO public.barcode_registry(barcode_value,entity_type,product_id,variant_id,created_by_name)
        VALUES(v,r.kind,r.product_id,r.variant_id,'Barcode integrity migration');
    END IF;
  END LOOP;
END; $$;

-- No caller (including an upsert) may transfer a barcode to another SKU.
CREATE OR REPLACE FUNCTION public.protect_barcode_owner()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
  PERFORM pg_advisory_xact_lock(404,36);
  IF TG_OP='UPDATE' AND (NEW.product_id IS DISTINCT FROM OLD.product_id OR NEW.variant_id IS DISTINCT FROM OLD.variant_id) THEN
    RAISE EXCEPTION 'This barcode is already registered to another item';
  END IF;
  IF NEW.variant_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.product_variants WHERE id=NEW.variant_id AND product_id=NEW.product_id) THEN
    RAISE EXCEPTION 'Barcode variant does not belong to product';
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS protect_barcode_owner ON public.barcode_registry;
CREATE TRIGGER protect_barcode_owner BEFORE INSERT OR UPDATE ON public.barcode_registry FOR EACH ROW EXECUTE FUNCTION public.protect_barcode_owner();

CREATE OR REPLACE FUNCTION public.validate_item_barcode()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE pid bigint; vid uuid; owner public.barcode_registry;
BEGIN
  PERFORM pg_advisory_xact_lock(404,36);
  IF TG_TABLE_NAME='product_variants' THEN pid:=NEW.product_id; vid:=NEW.id;
  ELSE pid:=NEW.id; vid:=NULL; END IF;
  IF nullif(btrim(NEW.barcode),'') IS NULL THEN
    IF vid IS NULL THEN RETURN NEW; END IF;
    SELECT barcode_value INTO NEW.barcode FROM public.barcode_registry WHERE variant_id=vid AND is_active ORDER BY created_at,id LIMIT 1;
    NEW.barcode:=coalesce(NEW.barcode,public.generate_barcode_value('variant'));
  END IF;
  SELECT * INTO owner FROM public.barcode_registry WHERE upper(btrim(barcode_value))=upper(btrim(NEW.barcode));
  IF FOUND AND (owner.product_id IS DISTINCT FROM pid OR owner.variant_id IS DISTINCT FROM vid) THEN
    RAISE EXCEPTION 'This barcode is already registered to another item';
  END IF;
  RETURN NEW;
END; $$;
CREATE OR REPLACE FUNCTION public.register_item_barcode()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE pid bigint; vid uuid; kind text;
BEGIN
  IF nullif(btrim(NEW.barcode),'') IS NULL THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME='product_variants' THEN pid:=NEW.product_id;vid:=NEW.id;kind:='variant';
  ELSE pid:=NEW.id;vid:=NULL;kind:='product'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.barcode_registry WHERE upper(btrim(barcode_value))=upper(btrim(NEW.barcode))) THEN
    INSERT INTO public.barcode_registry(barcode_value,entity_type,product_id,variant_id)
      VALUES(NEW.barcode,kind,pid,vid);
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS validate_item_barcode ON public.products;
CREATE TRIGGER validate_item_barcode BEFORE INSERT OR UPDATE OF barcode ON public.products FOR EACH ROW EXECUTE FUNCTION public.validate_item_barcode();
DROP TRIGGER IF EXISTS register_item_barcode ON public.products;
CREATE TRIGGER register_item_barcode AFTER INSERT OR UPDATE OF barcode ON public.products FOR EACH ROW EXECUTE FUNCTION public.register_item_barcode();
DROP TRIGGER IF EXISTS validate_item_barcode ON public.product_variants;
CREATE TRIGGER validate_item_barcode BEFORE INSERT OR UPDATE OF barcode,product_id ON public.product_variants FOR EACH ROW EXECUTE FUNCTION public.validate_item_barcode();
DROP TRIGGER IF EXISTS register_item_barcode ON public.product_variants;
CREATE TRIGGER register_item_barcode AFTER INSERT OR UPDATE OF barcode ON public.product_variants FOR EACH ROW EXECUTE FUNCTION public.register_item_barcode();

-- Serialize receipt allocation and stock increments; existing calculations are unchanged.
CREATE OR REPLACE FUNCTION public.create_barcode_and_receive_stock(
  p_product_id BIGINT,
  p_variant_id UUID DEFAULT NULL,
  p_quantity_received NUMERIC DEFAULT 0,
  p_unit_cost NUMERIC DEFAULT NULL,
  p_created_by_name TEXT DEFAULT '',
  p_custom_barcode TEXT DEFAULT NULL,
  p_note TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entity_type TEXT;
  v_barcode_id UUID;
  v_barcode_value TEXT;
  v_is_new_barcode BOOLEAN := FALSE;
  v_movement_type TEXT;
  v_qty_before NUMERIC := 0;
  v_qty_after NUMERIC := 0;
  v_prod_name TEXT;
  v_var_name TEXT := '';
BEGIN
  PERFORM pg_advisory_xact_lock(404,36);
  IF p_quantity_received < 0 THEN
    RAISE EXCEPTION 'Quantity received cannot be negative';
  END IF;

  -- 1. Check Parent Product Exists
  SELECT name INTO v_prod_name FROM public.products WHERE id = p_product_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product with ID % not found', p_product_id;
  END IF;

  -- 2. Verify Variant Belongs to Product if Variant is Provided
  IF p_variant_id IS NOT NULL THEN
    v_entity_type := 'variant';
    SELECT variant_name, stock INTO v_var_name, v_qty_before
    FROM public.product_variants
    WHERE id = p_variant_id AND product_id = p_product_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Variant % does not belong to Product %', p_variant_id, p_product_id;
    END IF;
  ELSE
    v_entity_type := 'product';
    SELECT stock_quantity INTO v_qty_before
    FROM public.products
    WHERE id = p_product_id;
  END IF;

  -- 3. Check for Existing Active Barcode in barcode_registry (SKU Identity)
  IF v_entity_type = 'variant' THEN
    SELECT id, barcode_value INTO v_barcode_id, v_barcode_value
    FROM public.barcode_registry
    WHERE variant_id = p_variant_id AND is_active = TRUE
    ORDER BY created_at DESC
    LIMIT 1;
  ELSE
    SELECT id, barcode_value INTO v_barcode_id, v_barcode_value
    FROM public.barcode_registry
    WHERE product_id = p_product_id AND variant_id IS NULL AND is_active = TRUE
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  -- 4. Reuse Existing or Create New Barcode
  IF v_barcode_id IS NOT NULL THEN
    v_is_new_barcode := FALSE;
    v_movement_type := CASE WHEN v_qty_before = 0 THEN 'INITIAL_BARCODE_STOCK' ELSE 'RESTOCK' END;
  ELSE
    v_is_new_barcode := TRUE;
    v_movement_type := 'INITIAL_BARCODE_STOCK';
    v_barcode_value := COALESCE(NULLIF(UPPER(BTRIM(p_custom_barcode)), ''), public.generate_barcode_value(v_entity_type));

    INSERT INTO public.barcode_registry (
      barcode_value, entity_type, product_id, variant_id, is_active, created_by_name
    )
    VALUES (
      v_barcode_value, v_entity_type, p_product_id, p_variant_id, TRUE, COALESCE(p_created_by_name, '')
    )
    RETURNING id INTO v_barcode_id;
  END IF;

  -- 5. Synchronize compatibility column on target table
  IF v_entity_type = 'variant' THEN
    UPDATE public.product_variants
    SET barcode = v_barcode_value, updated_at = NOW()
    WHERE id = p_variant_id;
  ELSE
    UPDATE public.products
    SET barcode = v_barcode_value, updated_at = NOW()
    WHERE id = p_product_id;
  END IF;

  -- 6. Apply Stock Increment & Parent Aggregate Sync
  v_qty_after := v_qty_before + p_quantity_received;

  IF p_quantity_received > 0 THEN
    IF v_entity_type = 'variant' THEN
      UPDATE public.product_variants
      SET stock = v_qty_after, updated_at = NOW()
      WHERE id = p_variant_id;
  
      -- Refresh parent aggregate stock cache
      UPDATE public.products
      SET stock_quantity = (
            SELECT COALESCE(SUM(stock), 0)
            FROM public.product_variants
            WHERE product_id = p_product_id AND is_active = TRUE
          ),
          stock = FLOOR((
            SELECT COALESCE(SUM(stock), 0)
            FROM public.product_variants
            WHERE product_id = p_product_id AND is_active = TRUE
          ))::INTEGER,
          updated_at = NOW()
      WHERE id = p_product_id;
    ELSE
      UPDATE public.products
      SET stock_quantity = v_qty_after,
          stock = FLOOR(v_qty_after)::INTEGER,
          updated_at = NOW()
      WHERE id = p_product_id;
    END IF;
  END IF;

  -- 7. Record Immutable Inventory Movement
  IF p_quantity_received > 0 THEN
    INSERT INTO public.inventory_movements (
      product_id, variant_id, barcode_id, movement_type,
      quantity_delta, quantity_before, quantity_after,
      unit_cost, reference_type, reference_id, note, created_by_name
    )
    VALUES (
      p_product_id, p_variant_id, v_barcode_id, v_movement_type,
      p_quantity_received, v_qty_before, v_qty_after,
      p_unit_cost, 'barcode_receipt', v_barcode_value,
      COALESCE(p_note, ''), COALESCE(p_created_by_name, '')
    );
  END IF;

  RETURN jsonb_build_object(
    'success', TRUE,
    'barcode_id', v_barcode_id,
    'barcode_value', v_barcode_value,
    'is_new_barcode', v_is_new_barcode,
    'movement_type', v_movement_type,
    'quantity_before', v_qty_before,
    'quantity_received', p_quantity_received,
    'quantity_after', v_qty_after,
    'product_id', p_product_id,
    'variant_id', p_variant_id,
    'product_name', v_prod_name,
    'variant_name', v_var_name
  );
END;
$$;
COMMIT;
