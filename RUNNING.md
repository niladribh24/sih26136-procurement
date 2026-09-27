# Running SAMARTH locally (Windows cmd)

Three processes, each in its own `cmd` window, started in this order:

| Service  | Folder      | URL                     | Check                           |
|----------|-------------|-------------------------|---------------------------------|
| ML (NLP) | `nlp/`      | http://localhost:8001   | http://localhost:8001/healthz   |
| Backend  | `backend/`  | http://localhost:8000   | http://localhost:8000/health    |
| Frontend | `frontend/` | http://localhost:3000   | open it in a browser            |

The ML service is optional. If it's down, the backend still works and ML results
(tags, summaries, match scores) show as pending. Run `python retry_ml.py` in `backend\`
once it's up to fill them in.

Prerequisites: Python 3.14 (backend), Python for the NLP service, Node.js, and
PostgreSQL running on `localhost:5432` with user `postgres`.

All commands below are for **cmd.exe**. In PowerShell, activate with
`.venv\Scripts\Activate.ps1` instead of `activate.bat`.

---

## 1. ML service (`nlp/`)

First time only:

```cmd
cd nlp
python -m venv .venv
.venv\Scripts\activate.bat
pip install -r requirements.txt
python -m spacy download en_core_web_sm
```

The first run downloads `all-MiniLM-L6-v2` (~90 MB) and `facebook/bart-large-mnli`
(~1.6 GB) from Hugging Face, so do it once with internet access before the demo.
The OCR fallback for scanned PDFs needs the Tesseract binary installed separately.
Text PDFs work without it.

Every time:

```cmd
cd nlp
.venv\Scripts\activate.bat
uvicorn app.main:app --host 0.0.0.0 --port 8001
```

Add `--reload` while developing. Leave it off for the demo.

## 2. Backend (`backend/`)

First time only:

```cmd
cd backend
py -3.14 -m venv .venv
.venv\Scripts\activate.bat
pip install -r requirements.txt
copy .env.example .env
```

Then edit `backend\.env`: put your Postgres password into `DATABASE_URL` (URL-encode
`@ : / # %`, e.g. `@` becomes `%40`) and set `JWT_SECRET` to a long random string.
`ML_SERVICE_URL` defaults to `http://localhost:8001`.

Every time:

```cmd
cd backend
.venv\Scripts\activate.bat
uvicorn app.main:app --reload --port 8000
```

## 3. Frontend (`frontend/`)

First time only:

```cmd
cd frontend
npm install
copy .env.example .env.local
```

The defaults in `.env.local` point at the backend on `:8000`. Setting
`NEXT_PUBLIC_USE_MOCK_API=true` runs the frontend offline on a `localStorage` mock
with no backend. Restart the dev server after changing `.env.local`.

Every time:

```cmd
cd frontend
npm run dev
```

Open http://localhost:3000.

Don't run `npm run build` while `npm run dev` is running. They share `.next\`, and the
dev server will start serving stale pages.

---

## 4. Database: create, reset, seed

Run these in `backend\` with the venv active. Postgres must be running. Start the ML
service first if you want the seeded data to have real tags and match scores.

```cmd
cd backend
.venv\Scripts\activate.bat

python init_db.py                  :: create sih_db if missing and apply schema.sql
python seed.py                     :: add the demo data and print the logins
```

To start over from a clean database (**deletes every table and row**):

```cmd
python init_db.py --reset --yes
python seed.py
```

To rebuild only the demo data and leave everything else alone:

```cmd
python seed.py --reset --yes       :: remove the @samarth.demo data, then seed again
python seed.py --clear             :: only remove the demo data
```

Drop `--yes` to get a confirmation prompt first.

If the ML service was down while seeding, start it and run:

```cmd
python retry_ml.py
```

## 5. Demo accounts

The password for every account is **`Samarth@2026`**. The persona buttons on the
landing page, login page and header log in as these accounts, so they only work
after `python seed.py`.

| Email                          | Role          | Who                                                             |
|--------------------------------|---------------|-----------------------------------------------------------------|
| `officer.agri@samarth.demo`    | govt_officer  | Dr. Anjali Mehra, Ministry of Agriculture & Farmers Welfare     |
| `officer.urban@samarth.demo`   | govt_officer  | Vikram Rao, Ministry of Housing & Urban Affairs                 |
| `evaluator@samarth.demo`       | evaluator     | Prof. Meera Iyer, Independent Technical Evaluation Panel        |
| `krishinetra@samarth.demo`     | startup       | Aditya Kulkarni, KrishiNetra Vision Pvt Ltd (DIPP41872)         |
| `bhoomisense@samarth.demo`     | startup       | Harpreet Kaur, BhoomiSense IoT Solutions (DPIIT20931)           |
| `mandimitra@samarth.demo`      | startup       | Sneha Deshpande, MandiMitra Agri Analytics (DIPP57306)          |
| `punarchakra@samarth.demo`     | startup       | Rohan Joshi, PunarChakra CleanTech (DPIIT33418)                 |
| `jansetu@samarth.demo`         | startup       | Imran Siddiqui, JanSetu Civic AI (DIPP68245)                    |

What the seed sets up:
- **KrishiNetra** has an active pilot on P1. The evaluator has scored it, milestone 1 is verified and paid, and milestone 2 is submitted and waiting for verification.
- **BhoomiSense** has a procured pilot on P2 (milestone 2 failed once), which is now a proven solution. The urban officer has a pending replication request on it.

`seed.py` prints this same list, plus each problem and its proposals, when it finishes.
