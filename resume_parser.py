# resume_parser.py
import os
import fitz           # PyMuPDF
import easyocr
import spacy
from spacy.matcher import Matcher

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