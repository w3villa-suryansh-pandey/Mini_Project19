"""Isolated PyMuPDF worker for S19 PDF inspection and version processing."""

import base64
import json
import math
import re
import sys

try:
    import fitz
except ImportError:
    print(json.dumps({"error": "PyMuPDF is not installed. Install backend/requirements.txt."}))
    sys.exit(2)


MAX_PAGES = 250
MAX_OPERATIONS = 500
MAX_IMAGE_BYTES = 8 * 1024 * 1024
FONT_MAP = {
    "helvetica": "helv", "arial": "helv", "sans-serif": "helv",
    "times": "tiro", "serif": "tiro", "courier": "cour", "mono": "cour",
}


def fail(message):
    print(json.dumps({"error": message}))
    sys.exit(2)


def finite(value, label, minimum=None, maximum=None):
    try:
        result = float(value)
    except (TypeError, ValueError):
        raise ValueError(f"{label} must be a number.")
    if not math.isfinite(result) or (minimum is not None and result < minimum) or (maximum is not None and result > maximum):
        raise ValueError(f"{label} is outside the supported range.")
    return result


def color_from_hex(value, fallback=(0, 0, 0)):
    if not isinstance(value, str):
        return fallback
    match = re.fullmatch(r"#?([0-9a-fA-F]{6})", value.strip())
    if not match:
        return fallback
    raw = match.group(1)
    return tuple(int(raw[index:index + 2], 16) / 255 for index in (0, 2, 4))


def pdf_rect_to_page(page, x, y, width, height, baseline=False):
    x = finite(x, "x", -100000, 100000)
    y = finite(y, "y", -100000, 100000)
    width = finite(width, "width", 0.1, 100000)
    height = finite(height, "height", 0.1, 100000)
    pdf_rect = fitz.Rect(x, y - height if baseline else y, x + width, y if baseline else y + height)
    rect = pdf_rect * page.transformation_matrix
    rect.normalize()
    return rect & page.rect


def operation_font(value, weight="400", italic=False):
    name = str(value or "helv").lower()
    bold = "bold" in name or str(weight).lower() in ("bold", "700", "800", "900")
    italic = italic or "italic" in name or "oblique" in name
    for family, mapped in FONT_MAP.items():
        if family in name:
            name = mapped
            break
    suffix = ("b" if bold else "") + ("i" if italic else "")
    if name == "tiro":
        return {"": "tiro", "b": "tibo", "i": "tiit", "bi": "tibi"}[suffix]
    if name == "cour":
        return {"": "cour", "b": "cobo", "i": "coit", "bi": "cobi"}[suffix]
    return {"": "helv", "b": "hebo", "i": "heit", "bi": "hebi"}[suffix]


def page_number(operation):
    value = operation.get("pageNumber")
    if isinstance(value, bool) or not isinstance(value, int) or value < 1:
        raise ValueError("Every PDF operation needs a valid 1-based page number.")
    return value - 1


def inspect_document(document, detailed=False):
    if document.page_count < 1 or document.page_count > MAX_PAGES:
        raise ValueError(f"PDFs must contain between 1 and {MAX_PAGES} pages.")
    pages = []
    detailed_span_count = 0
    for index, page in enumerate(document):
        text = page.get_text("dict")
        spans = []
        for block in text.get("blocks", []):
            for line in block.get("lines", []):
                for span in line.get("spans", []):
                    if not span.get("text", "").strip():
                        continue
                    if detailed and detailed_span_count < 10000:
                        pdf_bbox = fitz.Rect(span["bbox"]) * ~page.transformation_matrix
                        pdf_bbox.normalize()
                        spans.append({
                            "text": span["text"][:512],
                            "bbox": [round(value, 3) for value in pdf_bbox],
                            "font": span.get("font", ""),
                            "fontSize": round(float(span.get("size", 0)), 2),
                            "color": f"#{int(span.get('color', 0)):06x}",
                            "flags": int(span.get("flags", 0)),
                            "page": index + 1,
                        })
                        detailed_span_count += 1
        has_text = any(line.get("spans") for block in text.get("blocks", []) for line in block.get("lines", []))
        pages.append({
            "pageNumber": index + 1,
            "width": round(page.rect.width, 2),
            "height": round(page.rect.height, 2),
            "rotation": page.rotation,
            "textItemCount": sum(len(line.get("spans", [])) for block in text.get("blocks", []) for line in block.get("lines", [])),
            "isScanned": not has_text and bool(page.get_images(full=True)),
            **({"textItems": spans} if detailed else {}),
        })
    return {"pageCount": document.page_count, "pages": pages}


def preview_overlap(document, operations):
    warnings = []
    source_edits = operations.get("edits", [])
    added_texts = operations.get("addedTexts", [])
    if not isinstance(source_edits, list) or not isinstance(added_texts, list):
        raise ValueError("The PDF text edit list is invalid.")
    edits = list(source_edits)
    edits.extend(item for item in added_texts if isinstance(item, dict) and item.get("ocrLine"))
    if len(edits) > MAX_OPERATIONS:
        raise ValueError("The PDF text edit list is invalid or too large.")
    for edit in edits:
        page_index = page_number(edit)
        if page_index >= document.page_count:
            raise ValueError("An edit refers to a page outside this document.")
        page = document[page_index]
        rect = pdf_rect_to_page(
            page,
            edit.get("x"),
            edit.get("y"),
            edit.get("width"),
            edit.get("height"),
            baseline=bool(edit.get("ocrLine")),
        )
        if rect.is_empty or rect.get_area() < 1:
            raise ValueError("A text edit rectangle is outside the page or too small.")
        source_text = edit.get("originalText", edit.get("text", ""))
        original_tokens = set(re.findall(r"\w+", str(source_text).casefold()))
        overlapping = []
        for word in page.get_text("words"):
            word_rect = fitz.Rect(word[:4])
            if word_rect.intersects(rect):
                token = str(word[4]).casefold()
                if token not in original_tokens:
                    overlapping.append(token[:60])
        if overlapping:
            warnings.append({
                "pageNumber": page_index + 1,
                "message": "The selected redaction rectangle also overlaps nearby text.",
                "overlappingText": overlapping[:12],
            })
    return warnings


def add_text(page, item, baseline=False):
    text = item.get("replacementText") if "replacementText" in item else item.get("text")
    if not isinstance(text, str) or not text.strip():
        return
    page_index = page_number(item)
    if page_index >= page.parent.page_count:
        raise ValueError("Text refers to a page outside this document.")
    rect = pdf_rect_to_page(
        page, item.get("x"), item.get("y"), item.get("width"), item.get("height"), baseline=baseline
    )
    if rect.is_empty or rect.get_area() < 1:
        raise ValueError("A text box is outside the page or too small.")
    size = finite(item.get("fontSize", 12), "font size", 4, 144)
    font = operation_font(item.get("fontFamily"), item.get("fontWeight", "400"), bool(item.get("italic")))
    color = color_from_hex(item.get("color"))
    alignment = {"left": 0, "center": 1, "right": 2}.get(str(item.get("alignment", "left")).lower(), 0)
    fit_size = size
    result = -1
    while fit_size >= 4:
        result = page.insert_textbox(rect, text[:10000], fontname=font, fontsize=fit_size, color=color, align=alignment, overlay=True)
        if result >= 0:
            break
        fit_size -= 1
    if result < 0:
        # Give wrapped text a bounded extra height; preserve position and report the fallback.
        expanded = fitz.Rect(rect.x0, rect.y0, rect.x1, min(page.rect.y1, rect.y1 + max(size * 2, rect.height)))
        if expanded.height <= rect.height:
            raise ValueError("Replacement text does not fit in the selected area.")
        result = page.insert_textbox(expanded, text[:10000], fontname=font, fontsize=4, color=color, align=alignment, overlay=True)
        if result < 0:
            raise ValueError("Replacement text does not fit in the selected area.")


def apply_operations(document, operations):
    if not isinstance(operations, dict):
        raise ValueError("PDF edits must be an object.")
    edits = operations.get("edits", [])
    added_texts = operations.get("addedTexts", [])
    annotations = operations.get("annotations", [])
    for collection, label in ((edits, "text edits"), (added_texts, "added text"), (annotations, "annotations")):
        if not isinstance(collection, list) or len(collection) > MAX_OPERATIONS:
            raise ValueError(f"The {label} list is invalid or too large.")

    per_page = {}
    for edit in edits:
        index = page_number(edit)
        if index >= document.page_count:
            raise ValueError("An edit refers to a page outside this document.")
        per_page.setdefault(index, []).append(edit)

    ocr_pages = {}
    for item in added_texts:
        if not item.get("ocrLine"):
            continue
        index = page_number(item)
        if index >= document.page_count:
            raise ValueError("OCR text refers to a page outside this document.")
        page = document[index]
        rect = pdf_rect_to_page(page, item.get("x"), item.get("y"), item.get("width"), item.get("height"), baseline=True)
        if rect.is_empty or rect.get_area() < 1:
            raise ValueError("An OCR text region is outside the page or too small.")
        page.add_redact_annot(rect, fill=False, cross_out=False)
        ocr_pages.setdefault(index, []).append(item)

    for index in set(per_page) | set(ocr_pages):
        page = document[index]
        replacements = []
        for edit in per_page.get(index, []):
            rect = pdf_rect_to_page(page, edit.get("x"), edit.get("y"), edit.get("width"), edit.get("height"))
            if rect.is_empty or rect.get_area() < 1:
                raise ValueError("A text edit rectangle is outside the page or too small.")
            page.add_redact_annot(rect, fill=False, cross_out=False)
            if str(edit.get("replacementText", "")).strip():
                replacements.append(edit)
        page.apply_redactions(images=2 if index in ocr_pages else 0, graphics=0, text=0)
        for edit in replacements:
            add_text(page, edit)

    for item in added_texts:
        page_index = page_number(item)
        if page_index >= document.page_count:
            raise ValueError("Added text refers to a page outside this document.")
        add_text(document[page_index], item, baseline=True)

    for annotation in annotations:
        page_index = page_number(annotation)
        if page_index >= document.page_count:
            raise ValueError("An annotation refers to a page outside this document.")
        page = document[page_index]
        kind = annotation.get("type")
        rect = pdf_rect_to_page(page, annotation.get("x"), annotation.get("y"), annotation.get("width"), annotation.get("height"))
        if kind == "highlight":
            page.draw_rect(rect, color=None, fill=(1, 0.82, 0.2), fill_opacity=0.35, overlay=True)
        elif kind == "image":
            encoded = annotation.get("dataUrl", "")
            match = re.fullmatch(r"data:image/(png|jpeg);base64,([A-Za-z0-9+/=]+)", encoded)
            if not match:
                raise ValueError("Only PNG and JPEG images can be inserted.")
            data = base64.b64decode(match.group(2), validate=True)
            if not data or len(data) > MAX_IMAGE_BYTES:
                raise ValueError("Inserted images must be smaller than 8 MB.")
            page.insert_image(rect, stream=data, keep_proportion=False, overlay=True)
        elif kind == "draw":
            points = annotation.get("points", [])
            if not isinstance(points, list) or len(points) > 5000:
                raise ValueError("The drawing path is invalid or too large.")
            previous = None
            for point in points:
                if not isinstance(point, dict):
                    raise ValueError("Drawing points must include PDF coordinates.")
                point_rect = pdf_rect_to_page(page, point.get("x"), point.get("y"), 0.1, 0.1)
                current = fitz.Point(point_rect.x0, point_rect.y1)
                if previous is not None:
                    page.draw_line(previous, current, color=(0.14, 0.43, 0.35), width=1.8, overlay=True)
                previous = current
        elif kind in ("rectangle", "ellipse"):
            if kind == "rectangle":
                page.draw_rect(rect, color=(0.25, 0.35, 0.8), width=1.5, overlay=True)
            else:
                page.draw_oval(rect, color=(0.25, 0.35, 0.8), width=1.5, overlay=True)

    page_order = operations.get("pageOrder")
    deleted_pages = operations.get("deletedPages", [])
    page_rotations = operations.get("pageRotations", {})
    if not isinstance(deleted_pages, list) or not isinstance(page_rotations, dict):
        raise ValueError("Page operations are invalid.")
    if page_order is not None:
        if not isinstance(page_order, list) or len(page_order) != document.page_count:
            raise ValueError("The page order does not match this document.")
        if any(isinstance(value, bool) or not isinstance(value, int) for value in page_order):
            raise ValueError("Page order values must be integers.")
        if sorted(page_order) != list(range(document.page_count)):
            raise ValueError("The page order does not match this document.")
    deleted = set(deleted_pages)
    if any(isinstance(value, bool) or not isinstance(value, int) or value < 0 or value >= document.page_count for value in deleted):
        raise ValueError("A deleted page is outside this document.")
    order = page_order if page_order is not None else list(range(document.page_count))
    visible = [index for index in order if index not in deleted]
    if not visible:
        raise ValueError("A PDF must contain at least one page.")
    for source_index in visible:
        rotation = page_rotations.get(str(source_index), page_rotations.get(source_index, 0))
        rotation = finite(rotation, "page rotation", 0, 270)
        if rotation % 90:
            raise ValueError("Page rotation must be a multiple of 90 degrees.")
        if rotation:
            page = document[source_index]
            page.set_rotation((page.rotation + int(rotation)) % 360)
    if len(visible) != document.page_count or visible != list(range(document.page_count)):
        output = fitz.open()
        for index in visible:
            output.insert_pdf(document, from_page=index, to_page=index)
        document.close()
        document = output
    return document


def main():
    action, input_path, output_path = sys.argv[1:4]
    document = fitz.open(input_path)
    if document.is_encrypted:
        fail("Password-protected PDFs are not supported. Remove the password before editing.")
    if action == "inspect":
        result = inspect_document(document)
    elif action == "extract":
        result = inspect_document(document, detailed=True)
    elif action == "preview":
        operations = json.load(sys.stdin)
        result = {"warnings": preview_overlap(document, operations)}
    elif action == "apply":
        operations = json.load(sys.stdin)
        document = apply_operations(document, operations)
        document.save(output_path, garbage=4, deflate=True, clean=True)
        result = {"pageCount": document.page_count}
    else:
        fail("Unknown PDF processing operation.")
    print(json.dumps(result, separators=(",", ":")))
    document.close()


try:
    main()
except (ValueError, fitz.FileDataError, fitz.EmptyFileError):
    fail(str(sys.exc_info()[1])[:300])
except Exception:
    # Keep document contents, private paths, and tracebacks out of logs and API errors.
    print(json.dumps({"error": "The PDF could not be processed. It may contain unsupported fonts, objects, or encryption."}))
    sys.exit(2)
