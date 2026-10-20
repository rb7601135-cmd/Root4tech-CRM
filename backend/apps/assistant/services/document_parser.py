import os
import csv
import io
from django.core.exceptions import ValidationError

ALLOWED_DOCUMENT_EXTENSIONS = ['.txt', '.csv', '.pdf', '.docx']
MAX_DOCUMENT_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB

def validate_and_extract_text(uploaded_file) -> str:
    """
    Validates uploaded document (type, size) and extracts plain text safely.
    All extracted text is treated as untrusted user input.
    """
    if uploaded_file.size > MAX_DOCUMENT_SIZE_BYTES:
        raise ValidationError(f"Document size exceeds maximum allowed limit of {MAX_DOCUMENT_SIZE_BYTES // (1024*1024)} MB.")

    ext = os.path.splitext(uploaded_file.name)[1].lower()
    if ext not in ALLOWED_DOCUMENT_EXTENSIONS:
        raise ValidationError(f"Unsupported file format '{ext}'. Allowed formats: {', '.join(ALLOWED_DOCUMENT_EXTENSIONS)}.")

    content = ""
    try:
        if ext == '.txt':
            raw = uploaded_file.read()
            content = raw.decode('utf-8', errors='replace')

        elif ext == '.csv':
            raw = uploaded_file.read()
            text_stream = io.StringIO(raw.decode('utf-8', errors='replace'))
            reader = csv.reader(text_stream)
            rows = []
            for i, row in enumerate(reader):
                if i > 200: # limit to first 200 rows to prevent huge prompt bloat
                    rows.append("... [truncated remaining CSV rows]")
                    break
                rows.append(" | ".join(row))
            content = "\n".join(rows)

        elif ext == '.pdf':
            # Safe extraction: read string tokens or use basic text filtering
            raw = uploaded_file.read()
            # Basic text-stream scan for safe text without executing embedded JS/streams
            clean_chars = []
            for b in raw:
                if 32 <= b <= 126 or b in (10, 13, 9):
                    clean_chars.append(chr(b))
            filtered = "".join(clean_chars)
            # Take reasonable sample
            content = filtered[:8000]

        elif ext == '.docx':
            # Basic text extraction from docx zip stream if possible
            import zipfile
            import xml.etree.ElementTree as ET
            try:
                with zipfile.ZipFile(uploaded_file) as docx_zip:
                    xml_content = docx_zip.read('word/document.xml')
                    tree = ET.fromstring(xml_content)
                    texts = [node.text for node in tree.iter() if node.text]
                    content = " ".join(texts)[:8000]
            except Exception:
                content = "Could not parse DOCX xml structure."

    except Exception as e:
        raise ValidationError(f"Failed to safely process document: {str(e)}")

    # Truncate to safe length
    return content[:12000].strip()
