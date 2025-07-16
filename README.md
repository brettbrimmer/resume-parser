To run:

In terminal, cd to 'frontend'
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
npm install
npm run dev
Go to http://localhost:5173 or whatever link it gives you in the terminal.

In terminal, cd to 'backend'

cd backend
python -m venv venv
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
venv\Scripts\activate
pip install -r requirements.txt
cd .. // return to root
uvicorn backend.main:app --reload --port 8000
