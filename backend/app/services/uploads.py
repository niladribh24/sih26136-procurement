"""Saving and serving uploaded PDFs.

Files go to <upload_dir>/<subdir>/<random uuid>.pdf. The client's filename never becomes
part of the path (a name like "../../app/main.py" would otherwise write outside the
folder), and the DB stores the path relative to upload_dir so the folder can move.
"""

import os
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile, status

from app.config import get_settings

MAX_UPLOAD_BYTES = 10 * 1024 * 1024
CHUNK_BYTES = 1024 * 1024
# Every PDF starts with these bytes. The filename and Content-Type are chosen by the
# client and prove nothing, so this is the check that actually counts.
PDF_MAGIC = b"%PDF-"

STARTUP_DOCS = "startup_docs"
SOLUTIONS = "solutions"


def _not_pdf() -> HTTPException:
    return HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="Only PDF files are accepted")


def save_pdf(file: UploadFile, subdir: str) -> str:
    """Validate and store an uploaded PDF, returning its path relative to upload_dir.

    Raises 415 if the file isn't a PDF, 413 if it's over MAX_UPLOAD_BYTES.
    """
    rel_path = f"{subdir}/{uuid.uuid4().hex}.pdf"
    dest = upload_path(rel_path)
    dest.parent.mkdir(parents=True, exist_ok=True)

    size = 0
    try:
        with dest.open("wb") as out:
            # Read in chunks and stop as soon as the limit is passed, rather than trusting
            # Content-Length (client-supplied) or reading the whole file into memory.
            while chunk := file.file.read(CHUNK_BYTES):
                if size == 0 and not chunk.startswith(PDF_MAGIC):
                    raise _not_pdf()
                size += len(chunk)
                if size > MAX_UPLOAD_BYTES:
                    raise HTTPException(status.HTTP_413_CONTENT_TOO_LARGE, detail="File exceeds the 10 MB limit")
                out.write(chunk)
        if size == 0:
            raise _not_pdf()
    except BaseException:
        dest.unlink(missing_ok=True)
        raise
    return rel_path


def upload_path(rel_path: str) -> Path:
    return get_settings().upload_dir / rel_path


def delete_upload(rel_path: str) -> None:
    upload_path(rel_path).unlink(missing_ok=True)


def display_name(filename: str | None) -> str | None:
    """The uploaded file's own name, for showing in the UI only — never used as a path."""
    if not filename:
        return None
    return os.path.basename(filename.replace("\\", "/"))[:255] or None
