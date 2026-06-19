#!/usr/bin/env python3
"""
extract_manual_figures.py — Phase A figure-extraction pipeline.

For a product's manual PDF:
  1. Render each page to PNG (PyMuPDF — captures VECTOR wiring schematics that
     embedded-image extraction misses) and upload to Supabase Storage; stamp
     manual_chunks.page_image_url for that page.
  2. Ask Claude vision for the technical figures on the page (normalized bbox +
     figure_type + caption), crop each at high DPI, upload, and insert a
     manual_figures row.

This makes the /tech diagnostic steps SHOW the real diagram/part.

Run (not executed in CI — run against a real manual + Supabase):
  pip install pymupdf anthropic supabase requests
  export NEXT_PUBLIC_SUPABASE_URL=...  SUPABASE_SERVICE_ROLE_KEY=...  ANTHROPIC_API_KEY=...
  python scripts/extract_manual_figures.py <product_id> [manual_url]

If manual_url is omitted, it's read from products.manual_url.
Buckets 'manual-pages' and 'manual-figures' are created if missing (public).
"""
import os, sys, io, json, time, tempfile, base64
import requests, fitz                      # fitz = PyMuPDF
from anthropic import Anthropic
from supabase import create_client

SB_URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
SB_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
sb = create_client(SB_URL, SB_KEY)
claude = Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

LOCATE_DPI, CROP_DPI = 150, 230
PAGES_BUCKET, FIGS_BUCKET = "manual-pages", "manual-figures"


def ensure_bucket(name):
    try: sb.storage.create_bucket(name, options={"public": True})
    except Exception: pass  # already exists


def upload(bucket, path, data, content_type="image/png"):
    try: sb.storage.from_(bucket).upload(path, data, {"content-type": content_type, "upsert": "true"})
    except Exception: sb.storage.from_(bucket).update(path, data, {"content-type": content_type})
    return sb.storage.from_(bucket).get_public_url(path)


def claude_find_figures(page_png_b64):
    """Return [{bbox:[x1,y1,x2,y2] 0-1, figure_type, caption}] for the page."""
    msg = claude.messages.create(
        model="claude-haiku-4-5-20251001", max_tokens=700,
        messages=[{"role": "user", "content": [
            {"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": page_png_b64}},
            {"type": "text", "text":
                "List the TECHNICAL FIGURES on this manual page (wiring diagrams, terminal/connector "
                "drawings, dimension drawings, component photos, tables). Respond ONLY as JSON: "
                '{"figures":[{"bbox":[x1,y1,x2,y2],"figure_type":"wiring|dimension|photo|table|other",'
                '"caption":"short caption"}]} where bbox values are 0..1 fractions of the page '
                "(top-left origin). Skip plain body text. Empty list if none."},
        ]}],
    )
    raw = msg.content[0].text if msg.content and msg.content[0].type == "text" else "{}"
    raw = raw[raw.find("{"): raw.rfind("}") + 1] or "{}"
    try: return json.loads(raw).get("figures", [])
    except Exception: return []


def main(product_id, manual_url=None):
    if not manual_url:
        row = sb.table("products").select("manual_url").eq("id", product_id).single().execute()
        manual_url = (row.data or {}).get("manual_url")
    if not manual_url:
        print("No manual_url for product", product_id); return
    ensure_bucket(PAGES_BUCKET); ensure_bucket(FIGS_BUCKET)

    pdf = requests.get(manual_url, timeout=60).content
    doc = fitz.open(stream=pdf, filetype="pdf")
    print(f"{doc.page_count} pages")

    for i, page in enumerate(doc):
        pno = i + 1
        # 1) full page render → upload → stamp chunks
        pm = page.get_pixmap(dpi=LOCATE_DPI)
        page_png = pm.tobytes("png")
        page_url = upload(PAGES_BUCKET, f"{product_id}/p{pno}.png", page_png)
        try:
            sb.table("manual_chunks").update({"page_image_url": page_url}).eq("product_id", product_id).eq("page_number", pno).execute()
        except Exception as e:
            print("  chunk stamp skipped:", e)

        # 2) vision figure picker → crop hi-DPI → upload → insert
        figs = claude_find_figures(base64.b64encode(page_png).decode())
        for j, f in enumerate(figs):
            try:
                bb = f.get("bbox") or [0, 0, 1, 1]
                rect = fitz.Rect(bb[0] * page.rect.width, bb[1] * page.rect.height,
                                 bb[2] * page.rect.width, bb[3] * page.rect.height)
                rect = rect + (-6, -6, 6, 6)            # small padding (vision bbox is approximate)
                crop = page.get_pixmap(dpi=CROP_DPI, clip=rect).tobytes("png")
                url = upload(FIGS_BUCKET, f"{product_id}/p{pno}_{j}.png", crop)
                sb.table("manual_figures").insert({
                    "product_id": product_id, "manual_url": manual_url, "page_number": pno,
                    "figure_type": f.get("figure_type"), "caption": f.get("caption"),
                    "bbox": {"x1": bb[0], "y1": bb[1], "x2": bb[2], "y2": bb[3]}, "image_url": url,
                }).execute()
                print(f"  p{pno} fig {j}: {f.get('figure_type')} — {f.get('caption')}")
            except Exception as e:
                print(f"  p{pno} fig {j} skipped:", e)
        time.sleep(0.3)   # gentle on rate limits
    print("Done.")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("usage: python extract_manual_figures.py <product_id> [manual_url]"); sys.exit(1)
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None)
