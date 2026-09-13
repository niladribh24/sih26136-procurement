"""
PDF -> plain text, with an OCR fallback for scanned documents.

Per the latency SLA in NLP_UI_REQUIREMENTS.md section 5.1:
if extracted text is under 100 chars, treat it as a scanned document
and re-run through Tesseract OCR on rasterized pages.
"""
import io
import logging
from typing import Tuple

logger = logging.getLogger("samarth-nlp.pdf")

MIN_TEXT_LEN_BEFORE_OCR = 100


def _extract_with_pdfplumber(pdf_bytes: bytes) -> str:
    import pdfplumber
    text_parts = []
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text() or ""
            text_parts.append(page_text)
    return "\n".join(text_parts).strip()


def _extract_with_pymupdf(pdf_bytes: bytes) -> str:
    import fitz  # PyMuPDF
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    text_parts = [page.get_text() for page in doc]
    doc.close()
    return "\n".join(text_parts).strip()


def _ocr_pdf(pdf_bytes: bytes) -> str:
    import fitz
    import pytesseract
    from PIL import Image

    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    ocr_text_parts = []
    for page in doc:
        pix = page.get_pixmap(dpi=200)
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        ocr_text_parts.append(pytesseract.image_to_string(img))
    doc.close()
    return "\n".join(ocr_text_parts).strip()


def extract_text_from_pdf(pdf_bytes: bytes) -> Tuple[str, bool]:
    """Returns (text, ocr_performed)."""
    try:
        text = _extract_with_pdfplumber(pdf_bytes)
    except Exception as e:
        logger.warning("pdfplumber failed (%s), falling back to PyMuPDF", e)
        text = ""

    if len(text) < MIN_TEXT_LEN_BEFORE_OCR:
        try:
            text = _extract_with_pymupdf(pdf_bytes)
        except Exception as e:
            logger.warning("PyMuPDF failed too (%s)", e)
            text = text or ""

    if len(text) < MIN_TEXT_LEN_BEFORE_OCR:
        logger.info("Extracted text < %d chars, treating as scanned PDF -> OCR", MIN_TEXT_LEN_BEFORE_OCR)
        try:
            ocr_text = _ocr_pdf(pdf_bytes)
            if len(ocr_text) > len(text):
                return ocr_text, True
        except Exception as e:
            logger.error("OCR fallback failed: %s", e)

    return text, False
