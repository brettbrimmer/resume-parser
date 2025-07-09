import spacy
from spacy.matcher import Matcher
import os
import fitz  # PyMuPDF
import easyocr
from specializationData import specializationData

# easyocr setup
reader = easyocr.Reader(['en'])  # Load English model
# results = reader.readtext('resumes/imageResume.jpg')

"""
for bbox, text, confidence in results:
    print(f"{text} (Confidence: {confidence:.2f})")

    print("...............................................")
"""
    
# tesseract for optical parsing
# pillow is an off-sheet of the python imaging library that lets us process images for tesseract to get text from

"""
SPECIALIZATIONS:

Software Engineering
Web Development
Cyber Security
Machine Learning
Artificial Intelligence
"""

# Load the English model
nlp = spacy.load("en_core_web_sm")


# Initialize the Matcher with the shared vocab
matcher = Matcher(nlp.vocab)

# List of section names you expect
sections = ["education", "experience", "skills", "projects", "certifications", "publications"]

def getExt(file_name):
    file_path = "resumes/Brett Brimmer (U Arizona).pdf"
    name, extension = os.path.splitext(file_name)
    # print(extension)  # Output: .pdf
    return extension


def parseFileToText(fileName):
    extension = getExt(fileName)
    result_text = ""

    if(extension == ".pdf"):
        doc = fitz.open(fileName)  # Load the PDF
        # text = ""
        for page in doc:
            result_text += page.get_text()  # Extract text from each page
    elif (extension == ".txt"):
        result_text = open("resumes/resumeBbrim.txt", encoding="utf-8").read()
    elif(extension == ".jpg" or extension == ".png"):
        # parse with OCR
        ocr_results = reader.readtext(fileName)

        # Grab recognized strings
        texts = [text for _, text, _ in ocr_results]

        # Combine all parsed strings
        result_text = " ".join(texts)

        # for bbox, text, confidence in results:
            # print(f"{text} (Confidence: {confidence:.2f})")
    
    return result_text

# Build case-insensitive patterns
patterns = []
for sec in sections:
    patterns.append([{"LOWER": sec}])


# Register each pattern with a unique ID
for sec, pat in zip(sections, patterns):
    matcher.add(sec.upper(), [pat])

def find_headings(text):
    doc = nlp(text)
    matches = matcher(doc)
    # Collect (section_name, start_index) pairs
    headings = []
    for match_id, start, end in matches:
        sec_name = nlp.vocab.strings[match_id]
        headings.append((sec_name, start))
    # Sort by occurrence in the doc
    return sorted(headings, key=lambda x: x[1])

def split_into_sections(text):
    doc = nlp(text)
    headings = find_headings(text)
    sections_dict = {}

    # Append an artificial end-of-doc marker
    headings.append(("END", len(doc)))

    # Slice text spans between each heading
    for (sec, start), (_, next_start) in zip(headings, headings[1:]):
        span = doc[start:next_start].text.strip()
        # Drop the heading label itself from the content
        content = "\n".join(span.splitlines()[1:]).strip()
        sections_dict[sec] = content

    return sections_dict


# Example usage
# resume_text = open("resumes/resumeBbrim.txt", encoding="utf-8").read()
# resume_text = parseFileToText("resumes/Brett Brimmer (U Arizona).pdf")
resume_text = parseFileToText("resumes/imageResume.jpg")

parsed = split_into_sections(resume_text)

for sec, body in parsed.items():
    print(f"===== {sec} =====\n{body}\n")

def score_resume(resume_text, specialization):
    keywords = specializationData[specialization]

    resume_weight = 0.0 # this resume's weight
    specialization_weight = 0.0 # this specialization's overall weight

    # keyword search
    for kw in keywords:
        specialization_weight += kw.weight

        # keyword found in resume
        if kw.phrase in resume_text:
            resume_weight += kw.weight

    return resume_weight / specialization_weight

if __name__ == "__main__":
    # list_keywords()

    print(".................")

    for specialization in specializationData:
        print(f"Score for {specialization} is {score_resume(resume_text,specialization)}")