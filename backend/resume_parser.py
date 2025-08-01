"""
resume_parser.py

Module for extracting structured information from resumes in PDF,
text, and image formats. Provides functions to split text into
sections and extract fields such as name, location, contact details,
education, skills, projects, experience, and GPA.
"""

import os
import re
from typing import List, Dict

import fitz               # PyMuPDF for PDF text extraction
import easyocr            # OCR for image-based resumes
import spacy
from dateparser.search import search_dates
from docx import Document

# Preinstantiate OCR reader once per process to minimize startup overhead.
reader = easyocr.Reader(["en"])

# Section headers to identify resume segments.
_HEADERS = [
    "Education",
    "Technical Skills",
    "Skills",
    "Projects",
    "Experience",
    "Leadership & Activities",
    "Additional Information",
]

# Compiled regex to locate section headers at the start of a line.
_SECTION_RE = re.compile(
    rf"(?im)^({'|'.join(re.escape(h) for h in _HEADERS)})\s*:?\s*$",
    re.MULTILINE,
)

def parse_docx_text(file_path: str) -> str:
    """
    Extract all paragraph text from a .docx file.
    
    Args:
        file_path: Path to the .docx file.
        
    Returns:
        A single string with paragraphs joined by newline.
    """
    doc = Document(file_path)
    paragraphs = [p.text for p in doc.paragraphs if p.text]
    return "\n".join(paragraphs)


def split_into_strict_sections(text: str) -> Dict[str, str]:
    """
    Partition resume text into segments based on predefined headers.

    Args:
        text: Full resume text to split.

    Returns:
        A dict mapping each uppercase header to its corresponding body text.
        Headers that do not appear are omitted.
    """
    matches = list(_SECTION_RE.finditer(text))
    if not matches:
        return {}

    sections: Dict[str, str] = {}
    for i, match in enumerate(matches):
        header = match.group(1).upper()
        start = match.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        sections[header] = text[start:end].strip()

    return sections


def getExt(file_name: str) -> str:
    """
    Determine the file extension of a given filename.

    Args:
        file_name: Path or name of the file.

    Returns:
        File extension including the leading dot, or an empty string.
    """
    _, extension = os.path.splitext(file_name)
    return extension


def parseFileToText(fileName: str) -> str:
    """
    Extract raw text from a file given its name. Supports PDF, TXT, JPG, PNG.

    Args:
        fileName: Path to the input file.

    Returns:
        Concatenated text content of the file.
    """
    extension = getExt(fileName)
    result_text = ""

    if extension == ".pdf":
        doc = fitz.open(fileName)
        for page in doc:
            result_text += page.get_text()
    elif extension == ".txt":
        with open(fileName, encoding="utf-8") as f:
            result_text = f.read()
    elif extension == ".docx":
        result_text = parse_docx_text(fileName)
    elif extension in {".jpg", ".png"}:
        ocr_results = reader.readtext(fileName)
        # Extract the text portion of each OCR result tuple.
        texts = [item[1] for item in ocr_results]
        result_text = " ".join(texts)

    return result_text


def parseFileAtPathToText(filePath: str) -> str:
    """
    Extract raw text from a file given its full path. Alias of parseFileToText.

    Args:
        filePath: Full path to the input file.

    Returns:
        Concatenated text content of the file.
    """
    return parseFileToText(filePath)


# Keywords for identifying degree lines in education section.
DEGREE_KEYWORDS = [
    r"\bBachelor\b", r"\bB\.S\.?\b", r"\bBA\b", r"\bBSc\b",
    r"\bMaster\b",   r"\bM\.S\.?\b", r"\bMA\b",  r"\bMSc\b",
    r"\bPh\.?D\b",   r"\bDoctor\b",      r"\bAssociate\b"
]


def extract_name(text: str) -> str:
    """
    Identify candidate's name using a three-step strategy:
      1) Heuristic on the first non-empty line (2–4 capitalized words).
      2) Regex for 'Name: John Doe'.
      3) spaCy NER for PERSON entities.

    Args:
        text: Full resume text.

    Returns:
        Detected name in title case, or an empty string if none found.
    """
    # Step 1: first-line heuristic
    for line in text.splitlines():
        candidate = line.strip()
        if not candidate:
            continue
        parts = candidate.split()
        if 2 <= len(parts) <= 4 and all(p[0].isupper() for p in parts):
            name = candidate
            break
        break
    else:
        name = ""

    # Step 2: regex fallback
    if not name:
        m = re.search(r'(?mi)^Name[:\s]+(.+)$', text)
        if m:
            name = m.group(1).strip()

    # Step 3: spaCy NER fallback
    if not name:
        nlp = spacy.load("en_core_web_sm")
        for ent in nlp(text).ents:
            if ent.label_ == "PERSON":
                name = ent.text
                break

    return " ".join(part.capitalize() for part in name.lower().split())


def extract_location(text: str) -> str:
    """
    Identify candidate's location using:
      1) Bullet symbol pattern '📍 City, State'.
      2) Regex for 'City, ST'.
      3) spaCy NER for GPE entities.

    Args:
        text: Full resume text.

    Returns:
        First matching location, or an empty string.
    """
    # Pattern 1: bullet icon
    m = re.search(r'📍\s*([^|]+)', text)
    if m:
        return m.group(1).strip()

    # Pattern 2: City, ST
    m = re.search(r'([A-Z][a-z]+(?: [A-Z][a-z]+)*,\s*[A-Z]{2})', text)
    if m:
        return m.group(1)

    # Pattern 3: spaCy NER fallback
    nlp = spacy.load("en_core_web_sm")
    for ent in nlp(text).ents:
        if ent.label_ == "GPE":
            return ent.text

    return ""


def extract_email(text: str) -> str:
    """
    Find the first email address in the text.

    Args:
        text: Full resume text.

    Returns:
        Email string if found, otherwise empty.
    """
    m = re.search(r'[\w\.-]+@[\w\.-]+\.\w+', text)
    return m.group(0) if m else ""


def extract_phone(text: str) -> str:
    """
    Find the first US-style phone number in the text.

    Supported formats:
      - (408) 555-1278
      - 408-555-1278
      - 408.555.1278
      - +1 408 555 1278

    Args:
        text: Full resume text.

    Returns:
        Phone number string if found, otherwise empty.
    """
    pattern = (
        r'(\+?\d{1,2}\s*)?'               # optional country code
        r'(\(\d{3}\)|\d{3})[\s\-.]?'      # area code
        r'\d{3}[\s\-.]?\d{4}'             # subscriber number
    )
    m = re.search(pattern, text)
    return m.group(0) if m else ""


def extract_degrees(text: str):
    """
    Scan lines for academic degree indicators and optional dates.

    Args:
        text: Full resume text.

    Returns:
        Tuple of two lists:
          earned      – [(degree_line, date_str), ...]
          in_progress – same format for ongoing studies.
    """
    earned, in_progress = [], []
    for line in text.splitlines():
        for pat in DEGREE_KEYWORDS:
            if re.search(pat, line, re.IGNORECASE):
                dates = search_dates(line)
                date_str = dates[0][0] if dates else ""
                target = (
                    in_progress
                    if re.search(r"expected|in progress|ongoing", line, re.IGNORECASE)
                    else earned
                )
                target.append((line.strip(), date_str))
                break
    return earned, in_progress


def extract_skills_section(text: str) -> List[str]:
    """
    Retrieve individual skills from the 'Skills' or 'Technical Skills' section.

    Args:
        text: Full resume text.

    Returns:
        List of skill substrings.
    """
    pattern = (
        r'(?im)^[ \t]*(?:skills|technical skills)'
        r'\s*[:]?[\r\n]+([\s\S]+?)(?=\n\s*\n|$)'
    )
    m = re.search(pattern, text)
    if not m:
        return []
    block = m.group(1).strip()
    items = []
    for line in re.split(r'[\r\n]+', block):
        cleaned = line.strip('•*- \t')
        if not cleaned:
            continue
        for part in cleaned.split(','):
            part = part.strip()
            if part:
                items.append(part)
    return items


def parse_resume(path: str) -> dict:
    """
    Orchestrate full resume parsing pipeline.

    Steps:
      1. Extract raw text from file.
      2. Extract name, location, email, phone.
      3. Identify earned vs. in-progress degrees.
      4. Split text into sections for skills, projects, experience.
      5. Compute GPA if present.

    Args:
        path: File path to the resume.

    Returns:
        Dictionary with keys:
          text, name, location, email, phone, skills,
          projects, experience, degrees_earned,
          degrees_in_progress, gpa.
    """
    text = parseFileAtPathToText(path)
    name = extract_name(text)
    location = extract_location(text)
    email = extract_email(text)
    phone = extract_phone(text)
    earned, in_progress = extract_degrees(text)

    sections = split_into_strict_sections(text)
    skills_raw = max(
        [sections.get("SKILLS", ""), sections.get("TECHNICAL SKILLS", "")],
        key=len
    )
    skills = skills_raw.strip()
    projects = split_projects_by_bullets(sections.get("PROJECTS", ""))
    experience = split_projects_by_bullets(sections.get("EXPERIENCE", ""))

    def extract_gpa(txt: str) -> float | None:
        m = re.search(r"GPA[:\s]*([0-4](?:\.\d{1,2})?)", txt, re.IGNORECASE)
        return float(m.group(1)) if m else None

    gpa = extract_gpa(text)

    return {
        "text": text,
        "name": name,
        "location": location,
        "email": email,
        "phone": phone,
        "skills": skills,
        "projects": projects,
        "experience": experience,
        "degrees_earned": earned,
        "degrees_in_progress": in_progress,
        "gpa": gpa
    }


# Regex to identify project headers of the form "Title (YYYY–YYYY):"
PROJECT_HEADER_RE = re.compile(
    r'^(?P<name>[\w &\-,]+?)\s*'
    r'(?:\(\s*(?P<dates>\d{4}(?:–\d{4})?)\s*\))?:?$'
)


def extract_projects(text: str) -> List[Dict]:
    """
    Parse project entries by header and description lines.

    Args:
        text: Text block containing multiple project descriptions.

    Returns:
        List of dicts, each with keys 'name', 'dates', and 'desc' (list of lines).
    """
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    blocks, current = [], []

    for ln in lines:
        if PROJECT_HEADER_RE.match(ln):
            if current:
                blocks.append(current)
            current = [ln]
        else:
            if not current:
                current = ["Untitled Project"]
            current.append(ln)
    if current:
        blocks.append(current)

    projects = []
    for blk in blocks:
        header = blk[0]
        m = PROJECT_HEADER_RE.match(header)
        name = (m.group("name").strip() if m else header)
        dates = (m.group("dates") or "")
        desc = [re.sub(r'^[\-\*•]\s*', '', line) for line in blk[1:]]
        projects.append({"name": name, "dates": dates, "desc": desc})

    return projects

def split_projects_by_bullets(projects_text: str) -> List[str]:
    """
    Split a PROJECTS section into individual project entries.

    Steps:
      1. Merge wrapped lines (continuations) onto the previous line.
      2. Identify all bullet markers (▪ or •) and group contiguous runs.
      3. Determine slice boundaries based on those runs.
      4. Extract and clean each block into a single string.

    Args:
        projects_text: Raw text of the PROJECTS section.

    Returns:
        A list of cleaned project strings.
    """
    if not projects_text or not projects_text.strip():
        return []

    # 1) Normalize wraps: re-join lines that start with space or lowercase
    raw = projects_text.splitlines()
    normalized: List[str] = []
    for line in raw:
        stripped = line.strip()
        if not stripped:
            continue
        if normalized and (line.startswith(" ") or stripped[0].islower()):
            normalized[-1] += " " + stripped
        else:
            normalized.append(stripped)

    # 2) Find bullet indices in normalized
    bullet_re = re.compile(r'^[▪•]')
    bullet_idxs = [i for i, L in enumerate(normalized) if bullet_re.match(L)]
    if not bullet_idxs:
        # No bullets: return the entire block as one project
        return ["\n".join(normalized).strip()]

    # 3) Group contiguous bullets into runs
    runs: List[List[int]] = []
    run = [bullet_idxs[0]]
    for idx in bullet_idxs[1:]:
        if idx == run[-1] + 1:
            run.append(idx)
        else:
            runs.append(run)
            run = [idx]
    runs.append(run)

    # 4) Build slice boundaries: start=0, then last_bullet+1 for each run, then end
    last_bullets = [r[-1] for r in runs]
    starts = [0] + [i + 1 for i in last_bullets]
    ends = starts[1:] + [len(normalized)]

    # 5) Extract and clean each project block
    projects: List[str] = []
    for s, e in zip(starts, ends):
        block = normalized[s:e]
        cleaned = [re.sub(r'^[▪•\-\*]+\s*', '', line) for line in block]
        proj_text = "\n".join(cleaned).strip()
        if proj_text:
            projects.append(proj_text)

    return projects
