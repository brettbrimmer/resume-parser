from resume_parser import parseFileToText, split_into_sections
from specializationData import specializationData

# easyocr setup
# reader = easyocr.Reader(['en'])  # Load English model
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

resume_text = ""

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

def parseResume(file_path):
    # Example usage
    # resultText = open("resumes/resumeBbrim.txt", encoding="utf-8").read()
    # resume_text = parseFileToText("resumes/Brett Brimmer (U Arizona).pdf")
    # resume_text = parseFileToText("resumes/imageResume.jpg")
    resultText = parseFileToText(file_path)

    parsed = split_into_sections(resultText)

    for sec, body in parsed.items():
        print(f"===== {sec} =====\n{body}\n")

    return resultText;

if __name__ == "__main__":
    
    resume_text = parseResume("resumes/imageResume.jpg")

    # list_keywords()

    print(".................")

    for specialization in specializationData:
        print(f"Score for {specialization} is {score_resume(resume_text,specialization)}")