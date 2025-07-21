# resume_parser.py
import os
import fitz           # PyMuPDF
import easyocr
import spacy
from spacy.matcher import Matcher
import re
from typing import List, Dict
from dateparser.search import search_dates

# 1. OCR reader (module‐level so it loads once)
reader = easyocr.Reader(["en"])

# only these exact headers, matching at start of line (allow optional colon)
_HEADERS = [
    "Education",
    "Technical Skills",
    "Skills",
    "Projects",
    "Experience",
    "Leadership & Activities",
    "Additional Information",
]

_SECTION_RE = re.compile(
    r"(?im)^(" + "|".join(re.escape(h) for h in _HEADERS) + r")\s*:?\s*$",
    re.MULTILINE,
)

def split_into_strict_sections(text: str) -> Dict[str, str]:
    """
    Split the resume into known headers ONLY when they appear
    at the very start of a line. Returns HEADER->body.
    """
    matches = list(_SECTION_RE.finditer(text))
    if not matches:
        return {}
    sections: Dict[str, str] = {}
    for i, m in enumerate(matches):
        header = m.group(1).upper()
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        sections[header] = text[start:end].strip()
    return sections

def getExt(file_name):
    """Returns extension of file_name as string"""
    name, extension = os.path.splitext(file_name)
    return extension


def parseFileToText(fileName):
    """Parses file at fileName and returns it as a string"""
    extension = getExt(fileName)
    result_text = ""

    if(extension == ".pdf"):
        doc = fitz.open(fileName)  # Load the PDF

        # Extract text from each page
        for page in doc:
            result_text += page.get_text()  
    elif (extension == ".txt"):
        # Parse to string
        result_text = open("resumes/resumeBbrim.txt", encoding="utf-8").read()
    elif(extension == ".jpg" or extension == ".png"):
        ocr_results = reader.readtext(fileName) # parse with OCR
        texts = [text for _, text, _ in ocr_results]    # Grab recognized strings
        result_text = " ".join(texts)   # Join parsed strings
    
    return result_text

def parseFileAtPathToText(filePath):
    """Parses file at fileName and returns it as a string"""
    extension = getExt(filePath)
    result_text = ""

    if(extension == ".pdf"):
        doc = fitz.open(filePath)  # Load the PDF

        # Extract text from each page
        for page in doc:
            result_text += page.get_text()  
    elif (extension == ".txt"):
        # Parse to string
        result_text = open(filePath, encoding="utf-8").read()
    elif(extension == ".jpg" or extension == ".png"):
        ocr_results = reader.readtext(filePath) # parse with OCR
        texts = [text for _, text, _ in ocr_results]    # Grab recognized strings
        result_text = " ".join(texts)   # Join parsed strings
    
    # print(f"Results text for resume parsing: {result_text}")

    return result_text

# ── SMART FIELDS EXTRACTION ─────────────────────────────────────────────

# degree‐line indicators
DEGREE_KEYWORDS = [
    r"\bBachelor\b", r"\bB\.S\.?\b", r"\bBA\b", r"\bBSc\b",
    r"\bMaster\b",   r"\bM\.S\.?\b", r"\bMA\b",  r"\bMSc\b",
    r"\bPh\.?D\b",   r"\bDoctor\b",      r"\bAssociate\b"
]

def extract_name(text: str) -> str:
    # 1) Look at the *very first* non‐empty line and see if it looks like a human name
    for line in text.splitlines():
        candidate = line.strip()
        extracted_name = ""

        if not candidate:
            continue
        # simple heuristic: between 2–4 words, each capitalized
        parts = candidate.split()
        if 2 <= len(parts) <= 4 and all(p[0].isupper() for p in parts):
            print(f"Name parsed as (line‐1 heuristic): {candidate}")
            extracted_name = candidate
        break

    # 2) Regex “Name: John Doe” anywhere
    if(extracted_name == ""):
        m = re.search(r'(?mi)^Name[:\s]+(.+)$', text)
        if m:
            nm = m.group(1).strip()
            print(f"Name parsed via regex: {nm}")
            extracted_name = nm

    if(extracted_name == ""):
        # 3) Finally, fall back to spaCy NER in case the above failed
        doc = nlp(text)
        for ent in doc.ents:
            if ent.label_ == "PERSON":
                print(f"Name parsed via NER: {ent.text}")
                extracted_name = ent.text

    # Change name to Title Case
    extracted_name = " ".join(part.capitalize() for part in extracted_name.lower().split())

    return extracted_name

def extract_location(text: str) -> str:
# 1) Look for a “📍 City, State” pattern on the top line
    m = re.search(r'📍\s*([^|]+)', text)
    if m:
        loc = m.group(1).strip()
        print(f"Location parsed via bullet: {loc}")
        return loc

    # 2) Regex capture “City, ST”
    m2 = re.search(r'([A-Z][a-z]+(?: [A-Z][a-z]+)*,\s*[A-Z]{2})', text)
    if m2:
        loc = m2.group(1)
        print(f"Location parsed via regex: {loc}")
        return loc

    # 3) Fallback to spaCy GPE
    doc = nlp(text)
    for ent in doc.ents:
        if ent.label_ == "GPE":
            print(f"Location parsed via NER: {ent.text}")
            return ent.text

    return ""

def extract_email(text: str) -> str:
    """Find the first email address in the text."""
    m = re.search(r'[\w\.-]+@[\w\.-]+\.\w+', text)
    email = m.group(0) if m else ""
    if email:
        print(f"Email parsed as: {email}")
    else:
            print("extracting email failed.")
    return email

def extract_phone(text: str) -> str:
    """
    Find the first US‐style phone number, e.g.
    (408) 555-1278, 408-555-1278, 408.555.1278, +1 408 555 1278
    """
    m = re.search(
        r'(\+?\d{1,2}\s*)?'                    # optional country code
        r'(\(\d{3}\)|\d{3})[\s\-.]?'          # area code
        r'\d{3}[\s\-.]?\d{4}',                # local number
        text
    )
    phone = m.group(0) if m else ""
    if phone:
        print(f"Phone parsed as: {phone}")
    else:
            print("extracting phone number failed.")
    return phone

def extract_degrees(text: str):
    """
    Scans each line for degree keywords.
    Returns two lists of tuples: (full line, date-string or ''):
      earned      – true degrees
      in_progress – lines with 'expected' or 'in progress'
    """
    earned, in_prog = [], []
    for line in text.splitlines():
        for pat in DEGREE_KEYWORDS:
            if re.search(pat, line, re.IGNORECASE):
                # pull any date-like substring
                result = search_dates(line)
                date_str = result[0][0] if result else ""

                target = in_prog if re.search(r"expected|in progress|ongoing",
                                               line, re.IGNORECASE) else earned
                target.append((line.strip(), date_str))
                break

    print(f"degrees parsed as {earned} .. {in_prog}")
    return earned, in_prog

def extract_skills_section(text: str) -> List[str]:
    """
    Finds a SKILLS block like "SKILLS" or "Technical Skills"
    and returns individual skills split on commas or newlines.
    """
    print(f"extract_skills run with argument: {str}")
    # capture until the first blank line or EOF
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
        line = line.strip('•*- \t ')
        if not line:
            continue
        # split comma-separated values
        parts = [p.strip() for p in line.split(',')]
        items.extend([p for p in parts if p])

    print(f"extra_skills returning {items}")
    return items

def parse_resume(path: str) -> dict:
    """
    Master entrypoint:
      • parses raw text
      • extracts name, location
      • splits out earned vs in‐progress degrees
    """
    text = parseFileAtPathToText(path)
    name, location      = extract_name(text), extract_location(text)
    earned, in_prog     = extract_degrees(text)
    email               = extract_email(text)
    # skills              = extract_skills_section(text)
    

    # ── PROJECTS extraction ──────────────────────────────────────────
    # ── PROJECTS extraction via spaCy splitter ───────────────────────
    # sections      = split_sections(text)
    # projects_text = sections.get("projects", "")
    # projects      = extract_projects(projects_text)

    # myText     = parseFileToText(resume_path)
    # mySections = split_into_sections(myText)
    # raw_projects = mySections.get("PROJECTS", "")

    # ── PROJECTS extraction (existing split/split‐by‐bullets) ────────
    sections      = split_into_strict_sections(text)
    skills = sections.get("TECHNICAL SKILLS", "").strip()
    projects_text = sections.get("PROJECTS", "")
    projects      = split_projects_by_bullets(projects_text)

    # ── EXPERIENCE extraction ───────────────────────────────────────
    exp_text        = sections.get("EXPERIENCE", "")
    print(f"exp_text is: {exp_text}")
    experience      = split_projects_by_bullets(exp_text)
    print(f"Experience parsed as: {experience}")

    phone               = extract_phone(text)

    # ── GPA extraction ─────────────────────────────────────────────────
    def extract_gpa(txt: str) -> float | None:
        # look for patterns like "GPA: 3.82" or "GPA 3.8/4.0"
        m = re.search(r"GPA[:\s]*([0-4](?:\.\d{1,2})?)", txt, re.IGNORECASE)
        return float(m.group(1)) if m else None

    gpa = extract_gpa(text)

    return {
        "text": text,
        "name": name,
        "location": location,
        "email":                email,
        "phone":                phone,
        "projects":             projects,
        "experience":  experience,
        "gpa": gpa,
        "degrees_earned": earned,
        "degrees_in_progress": in_prog,
        "skills": skills
    }


import re
from typing import List
from typing import Dict

# ── PROJECT EXTRACTION (spaCy + header matching) ─────────────────────────
PROJECT_HEADER_RE = re.compile(
    r'^(?P<name>[\w &\-,]+?)\s*'
    r'(?:\(\s*(?P<dates>\d{4}(?:–\d{4})?)\s*\))?:?$'
)

def extract_projects(text: str) -> List[Dict]:
    """
    Pull out each project header + its detail lines into
    a list of dicts { name, dates, desc }.
    """
    # normalize and trim lines
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    blocks: List[List[str]] = []
    current: List[str] = []

    for ln in lines:
        if PROJECT_HEADER_RE.match(ln):
            if current:
                blocks.append(current)
            current = [ln]
        else:
            # continuation of current project
            if not current:
                current = ["Untitled Project"]
            current.append(ln)
    if current:
        blocks.append(current)

    projects: List[Dict] = []
    for blk in blocks:
        header = blk[0]
        m = PROJECT_HEADER_RE.match(header)
        name = m.group("name").strip() if m else header
        dates = m.group("dates") or ""
        # strip any leading bullet markers
        desc = [re.sub(r'^[\-\*•]\s*', '', line) for line in blk[1:]]
        projects.append({"name": name, "dates": dates, "desc": desc})
    return projects

def split_projects_by_bullets(projects_text: str) -> List[str]:
    """
    Split a PROJECTS section into individual projects.
    1) Merge any wrapped‐around lines (starting with whitespace or lowercase)
       onto the previous line.
    2) Split into project blocks by finding bullets (▪ or •) and slicing
       after each bullet‐run ends.
    3) Everything before the first bullet is kept as Project #1.
    """
    if not projects_text or not projects_text.strip():
        return []

    # 1) Normalize wraps: re‐join lines that start with space or lowercase
    raw = projects_text.splitlines()
    normalized = []
    for line in raw:
        stripped = line.strip()
        if not stripped:
            continue
        # if this line is a wrap (starts with space or lowercase), merge it
        if normalized and (line.startswith(" ") or stripped[0].islower()):
            normalized[-1] += " " + stripped
        else:
            normalized.append(stripped)

    # 2) Find all bullet indices in normalized
    bullet_re = re.compile(r'^[▪•]')
    bullet_idxs = [i for i, L in enumerate(normalized) if bullet_re.match(L)]
    if not bullet_idxs:
        # no bullets → one big project
        return ["\n".join(normalized).strip()]

    # 3) Group contiguous bullets into runs
    runs = []
    run = [bullet_idxs[0]]
    for idx in bullet_idxs[1:]:
        if idx == run[-1] + 1:
            run.append(idx)
        else:
            runs.append(run)
            run = [idx]
    runs.append(run)

    # 4) For each run, we split *after* its last bullet
    last_bullets = [r[-1] for r in runs]

    # 5) Build slice boundaries: start=0, then each last_bullet+1, then end
    starts = [0] + [i+1 for i in last_bullets] + [len(normalized)]

    # 6) Slice out each project
    projects = []

    for s, e in zip(starts, starts[1:]):
        # slice & clean each line of its leading bullet marker
        block = normalized[s:e]
        cleaned = [re.sub(r'^[▪•\-\*]+\s*', '', line) for line in block]
        text = "\n".join(cleaned).strip()
        if text:
            projects.append(text)

    return projects