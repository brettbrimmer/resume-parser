import spacy
from spacy.matcher import Matcher


# Load the English model
nlp = spacy.load("en_core_web_sm")


# Initialize the Matcher with the shared vocab
matcher = Matcher(nlp.vocab)

# List of section names you expect
sections = ["education", "experience", "skills", "projects", "certifications", "publications"]


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
resume_text = open("resumeBbrim.txt", encoding="utf-8").read()
parsed = split_into_sections(resume_text)
for sec, body in parsed.items():
    print(f"===== {sec} =====\n{body}\n")