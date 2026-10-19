import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

try:
    import fitz
except ImportError:
    fitz = None


WORKER = Path(__file__).parents[1] / "src" / "services" / "pdf-editor.worker.py"


@unittest.skipIf(fitz is None, "Install backend/requirements.txt to run PyMuPDF worker tests.")
class PdfEditorWorkerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.source_path = self.root / "original.pdf"
        self.output_path = self.root / "edited.pdf"
        document = fitz.open()
        page = document.new_page(width=612, height=792)
        page.insert_text((72, 100), "Private source text", fontsize=16)
        document.new_page(width=612, height=792).insert_text((72, 100), "Second page", fontsize=12)
        document.save(self.source_path)
        document.close()

    def tearDown(self):
        self.temp.cleanup()

    def worker(self, action, operations=None, output=None):
        command = [sys.executable, str(WORKER), action, str(self.source_path), str(output or "-")]
        result = subprocess.run(
            command,
            input=json.dumps(operations or {}),
            text=True,
            capture_output=True,
            check=False,
            timeout=30,
        )
        try:
            payload = json.loads(result.stdout)
        except json.JSONDecodeError as error:
            self.fail(f"Worker returned invalid JSON: {error}")
        return result.returncode, payload

    def selection_for_first_word(self):
        document = fitz.open(self.source_path)
        page = document[0]
        word = page.get_text("words")[0]
        document.close()
        x0, y0, x1, y1 = word[:4]
        page_height = 792
        return {
            "pageNumber": 1,
            "itemIndex": 0,
            "x": x0,
            "y": page_height - y1,
            "width": x1 - x0,
            "height": y1 - y0,
            "fontSize": 16,
            "fontFamily": "Arial",
            "color": "#000000",
            "originalText": word[4],
            "replacementText": "Classified",
        }

    def test_replacement_is_redacted_in_the_downloadable_pdf(self):
        selection = self.selection_for_first_word()
        operations = {"edits": [selection], "addedTexts": [], "annotations": []}
        code, result = self.worker("apply", operations, self.output_path)
        self.assertEqual(code, 0, result)
        original = fitz.open(self.source_path)
        edited = fitz.open(self.output_path)
        self.assertIn("Private source text", original[0].get_text())
        self.assertNotIn("Private", edited[0].get_text())
        self.assertIn("Classified", edited[0].get_text())
        self.assertIn("Second page", edited[1].get_text())
        original.close()
        edited.close()

    def test_overlapping_neighbor_text_is_reported_before_edit(self):
        selection = self.selection_for_first_word()
        selection["width"] += 55
        code, result = self.worker("preview", {"edits": [selection]})
        self.assertEqual(code, 0, result)
        self.assertTrue(result["warnings"])
        self.assertIn("nearby page content", result["warnings"][0]["message"])

    def test_export_applies_page_order_and_keeps_original_unchanged(self):
        operations = {
            "edits": [],
            "addedTexts": [],
            "annotations": [],
            "pageOrder": [1, 0],
            "deletedPages": [],
            "pageRotations": {},
        }
        code, result = self.worker("apply", operations, self.output_path)
        self.assertEqual(code, 0, result)
        original = fitz.open(self.source_path)
        edited = fitz.open(self.output_path)
        self.assertEqual(original[0].get_text().strip(), "Private source text")
        self.assertEqual(edited[0].get_text().strip(), "Second page")
        self.assertEqual(edited[1].get_text().strip(), "Private source text")
        original.close()
        edited.close()


if __name__ == "__main__":
    unittest.main()
