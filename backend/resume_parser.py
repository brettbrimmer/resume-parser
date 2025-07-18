# resume_parser.py
import os
import fitz           # PyMuPDF
import easyocr
import spacy
from spacy.matcher import Matcher
import re
from typing import List
from dateparser.search import search_dates

# 1. OCR reader (module‐level so it loads once)
reader = easyocr.Reader(["en"])

# 2. spaCy model + matcher (load once at import)
nlp = spacy.load("en_core_web_sm")
matcher = Matcher(nlp.vocab)
SECTIONS = ["education", "experience", "skills",
            "projects", "certifications", "publications"]

# Build and register patterns (sections)
for sec in SECTIONS:
    # Use uppercase labels but match on token.lower_ for case-insensitive section headings detection.
    matcher.add(sec.upper(), [[{"LOWER": sec}]])


def find_headings(text: str) -> list[tuple[str, int]]:
    """Return a sorted list of (SECTION_NAME, token_start_index)."""
    doc = nlp(text) # converts text into a data structure usable by spacy
    matches = matcher(doc)  # creates a list of tuples that each have a section header, and start/end points as integers
     # 'mid' is the integer id that was assigned to the section header, we use that to get the header name
     # 'start' is the start index for that header section in 'matches' (above) '_' is the end point (not used)
    headings = [(nlp.vocab.strings[mid], start) for mid, start, _ in matches]

     # sort headings data by 2nd item ('start' index)
    headings = sorted(headings, key=lambda x: x[1])

    return headings


def split_into_sections(text: str) -> dict[str, str]:
    """Build a dictionary by mapping section headings to the section's body text."""
    doc = nlp(text)
    heads = find_headings(text)
    heads.append(("END", len(doc)))  # sentinel

    sections = {}
    for (sec, start), (_, nxt) in zip(heads, heads[1:]):
        span = doc[start:nxt].text.strip().splitlines()
        # remove heading itself
        content = "\n".join(span[1:]).strip()
        sections[sec] = content

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
    
    print(f"Results text for resume parsing: {result_text}")

    return result_text

# ── SMART FIELDS EXTRACTION ─────────────────────────────────────────────

# degree‐line indicators
DEGREE_KEYWORDS = [
    r"\bBachelor\b", r"\bB\.S\.?\b", r"\bBA\b", r"\bBSc\b",
    r"\bMaster\b",   r"\bM\.S\.?\b", r"\bMA\b",  r"\bMSc\b",
    r"\bPh\.?D\b",   r"\bDoctor\b",      r"\bAssociate\b"
]

def extract_name(text: str) -> str:
    doc = nlp(text)
    # 1) NER
    for ent in doc.ents:
        if ent.label_ == "PERSON":
            return ent.text

    # 2) “Name:” pattern
    for match_id, start, end in matcher(doc):
        span = doc[start:end].text
        return span.split(":", 1)[-1].strip()

    # 3) First non-blank line
    for line in text.splitlines():
        if line.strip():
            return line.strip()

    return ""

def extract_location(text: str) -> str:
    """Returns the first GPE (geo‐political entity) SpaCy finds."""
    doc = nlp(text)
    for ent in doc.ents:
        if ent.label_ == "GPE":
            return ent.text
    return ""

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
    return earned, in_prog

def parse_resume(path: str) -> dict:
    """
    Master entrypoint:
      • parses raw text
      • extracts name, location
      • splits out earned vs in‐progress degrees
    """
    text = parseFileAtPathToText(path)
    name, location = extract_name(text), extract_location(text)
    earned, in_prog = extract_degrees(text)

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
        "gpa": gpa,
        "degrees_earned": earned,
        "degrees_in_progress": in_prog
    }


import re
from typing import List

import re
from typing import List

import re
from typing import List

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
        block = normalized[s:e]
        text = "\n".join(block).strip()
        if text:
            projects.append(text)

    return projects




"""
def printProjects_from_sections(resume_path):
    print("printProjects_from_sections run.")

    myText     = parseFileToText(resume_path)
    mySections = split_into_sections(myText)
    raw_projects = mySections.get("PROJECTS", "")
    print(f"raw_projects is: {raw_projects}")
    project_list = split_projects_by_bullets(raw_projects)
    for i, proj in enumerate(project_list, 1):
        print(f"── Project #{i} ──")
        print(proj)
        print()
"""