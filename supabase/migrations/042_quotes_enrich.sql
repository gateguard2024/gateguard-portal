ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS quote_mode       text NOT NULL DEFAULT 'line_item'
    CHECK (quote_mode IN ('wizard','line_item')),
  ADD COLUMN IF NOT EXISTS client_name      text,
  ADD COLUMN IF NOT EXISTS client_email     text,
  ADD COLUMN IF NOT EXISTS client_phone     text,
  ADD COLUMN IF NOT EXISTS property_address text,
  ADD COLUMN IF NOT EXISTS cover_image_url  text,
  ADD COLUMN IF NOT EXISTS cover_message    text,
  ADD COLUMN IF NOT EXISTS terms_text       text,
  ADD COLUMN IF NOT EXISTS tax_rate         numeric(5,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_percent numeric(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deposit_percent  numeric(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS survey_id        uuid REFERENCES surveys(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS package_mode     boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS selected_package text
    CHECK (selected_package IN ('basic','standard','premium')),
  ADD COLUMN IF NOT EXISTS created_by_name  text,
  ADD COLUMN IF NOT EXISTS expiry_date      date;

ALTER TABLE quote_line_items
  ADD COLUMN IF NOT EXISTS section_name   text DEFAULT 'Equipment',
  ADD COLUMN IF NOT EXISTS product_id     uuid REFERENCES products(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS item_type      text DEFAULT 'equipment'
    CHECK (item_type IN ('equipment','labor','service','custom')),
  ADD COLUMN IF NOT EXISTS unit           text DEFAULT 'each',
  ADD COLUMN IF NOT EXISTS is_optional    boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_included    boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS package_tier   text
    CHECK (package_tier IN ('basic','standard','premium')),
  ADD COLUMN IF NOT EXISTS image_url      text,
  ADD COLUMN IF NOT EXISTS model_number   text,
  ADD COLUMN IF NOT EXISTS notes          text,
  ADD COLUMN IF NOT EXISTS sku            text;

CREATE INDEX IF NOT EXISTS idx_qli_quote_section
  ON quote_line_items (quote_id, section_name, sort_order);
CREATE INDEX IF NOT EXISTS idx_qli_product
  ON quote_line_items (product_id) WHERE product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_quotes_survey
  ON quotes (survey_id) WHERE survey_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_quotes_mode
  ON quotes (org_id, quote_mode, status);
