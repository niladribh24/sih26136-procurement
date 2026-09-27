# Running SAMARTH on a fresh Windows laptop

This guide takes you from a new machine to the full demo running locally. All commands are
for **Command Prompt (cmd.exe)**, not PowerShell. The first setup takes about 30–45
minutes, most of it downloads.

Three services run side by side, each in its own cmd window:

| Service  | Folder      | Port | Health check                    |
|----------|-------------|------|---------------------------------|
| ML (NLP) | `nlp\`      | 8001 | http://localhost:8001/healthz   |
| Backend  | `backend\`  | 8000 | http://localhost:8000/health    |
| Frontend | `frontend\` | 3000 | http://localhost:3000           |

The frontend only talks to the backend. The backend talks to Postgres and the ML service.

---

## 1. Install the tools (once)

### Python 3.12
Download the **Python 3.12** Windows installer from https://www.python.org/downloads/windows/.
In the installer, tick **"Add python.exe to PATH"** and keep **"py launcher"** ticked.

Use 3.12 specifically. The ML service pins `torch 2.4.1` and `numpy 1.26.4`, and neither
installs on newer Pythons.

Check it:
```cmd
py -3.12 --version
```

### PostgreSQL
Download the installer from https://www.postgresql.org/download/windows/ (EDB, version 16 or 17).
- **Write down the password you set for the `postgres` user.** You'll need it in step 4.
- Keep the port at **5432**.
- You can skip Stack Builder at the end.

The installer sets Postgres up as a Windows service that starts automatically. You don't
need `psql` on your PATH, because the setup script creates the database for you.

### Node.js LTS
Download the **LTS** installer from https://nodejs.org/ and accept the defaults. Check it in a
**new** cmd window:
```cmd
node --version
npm --version
```

### Git
Install it from https://git-scm.com/download/win if you don't have it, then clone the repo
and `cd` into it. Every path below is relative to the repo root.

---

## 2. ML service: venv and packages (once)

```cmd
cd nlp
py -3.12 -m venv .venv
.venv\Scripts\activate.bat
pip install -r requirements.txt
python -m spacy download en_core_web_sm
cd ..
```

When the venv is active, your prompt starts with `(.venv)`. `pip install` pulls in PyTorch
and takes a while.

Optional: the OCR fallback for *scanned* PDFs needs the Tesseract binary
(https://github.com/UB-Mannheim/tesseract/wiki). Normal text PDFs work without it.

## 3. Backend: venv and packages (once)

Open a **new** cmd window, or run `deactivate` first, so you don't install into the ML venv.

```cmd
cd backend
py -3.12 -m venv .venv
.venv\Scripts\activate.bat
pip install -r requirements.txt
cd ..
```

## 4. Environment files (once)

### `backend\.env`
```cmd
copy backend\.env.example backend\.env
notepad backend\.env
```

| Setting | What it is | What to put |
|---|---|---|
| `DATABASE_URL` | How the backend reaches Postgres | `postgresql+psycopg://postgres:YOUR_PASSWORD@localhost:5432/sih_db`, with your postgres password (see below) |
| `JWT_SECRET` | Key used to sign login tokens | Any long random string. Generate one with `python -c "import secrets; print(secrets.token_urlsafe(48))"` |
| `JWT_EXPIRE_MINUTES` | How long a login lasts (optional) | Leave it commented out for 1440 minutes (24 h) |
| `ML_SERVICE_URL` | Where the ML service runs | `http://localhost:8001` |
| `ML_TIMEOUT_SECONDS` | Longest wait for one ML call (optional) | Default 60. Raise it to 120 on a slow CPU-only laptop |
| `FRONTEND_URL` | Browser origins allowed by CORS | `http://localhost:3000`. Separate several with commas. The `127.0.0.1` twin is added automatically |
| `UPLOAD_DIR` | Where uploaded PDFs are stored (optional) | Leave it commented out to use `backend\uploads` |

**Special characters in the password must be URL-encoded** inside `DATABASE_URL`, or the URL
gets parsed wrong and you'll see "password authentication failed" or a bad-host error.

| Character | Write it as |
|---|---|
| `@` | `%40` |
| `:` | `%3A` |
| `/` | `%2F` |
| `#` | `%23` |
| `%` | `%25` |
| `?` | `%3F` |
| `&` | `%26` |
| space | `%20` |

For example, the password `Pg@2026#x` becomes
`postgresql+psycopg://postgres:Pg%402026%23x@localhost:5432/sih_db`. To encode any password:
```cmd
python -c "import urllib.parse; print(urllib.parse.quote(input('password: '), safe=''))"
```

Never commit `.env`. It's already in `.gitignore`.

### `frontend\.env`
```cmd
copy frontend\.env.example frontend\.env
```

| Setting | What it is | What to put |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Where the frontend finds the backend | `http://localhost:8000` |
| `NEXT_PUBLIC_USE_MOCK_API` | `true` runs the frontend on a fake in-browser API with no backend | `false` |

`NEXT_PUBLIC_*` values are baked in when the dev server starts, so restart `npm run dev`
after changing them. If a `frontend\.env.local` also exists, its values override `.env`.

## 5. Create the database (once)

Postgres must be running (it starts with Windows). With the **backend** venv active:

```cmd
cd backend
.venv\Scripts\activate.bat
python init_db.py
```

This connects with the password in `DATABASE_URL`, creates `sih_db` if it doesn't exist,
and applies `schema.sql`. Running it again does nothing if the schema is already there.

---

## 6. Start everything (every time)

Use three cmd windows, started in this order.

### Window 1: ML service
```cmd
cd nlp
.venv\Scripts\activate.bat
uvicorn app.main:app --host 0.0.0.0 --port 8001
```
**On the first run, it downloads about 1.7 GB of models** from Hugging Face
(`all-MiniLM-L6-v2` and `facebook/bart-large-mnli`), so you need internet access and several
minutes. Later runs load them from the local cache. Wait until the log says
`Application startup complete`, then check http://localhost:8001/healthz.

### Window 2: Backend
```cmd
cd backend
.venv\Scripts\activate.bat
uvicorn app.main:app --reload --port 8000
```
Check http://localhost:8000/health. It also confirms the database connection.

### Window 3: Frontend
```cmd
cd frontend
npm install
npm run dev
```
You only need `npm install` the first time, and again after `package.json` changes. Open
http://localhost:3000.

## 7. Load the demo data

Start the **ML service first**, so the seeded startups get real tags, domains and match
scores. Then, in a fourth window (or stop the backend briefly and reuse its window):

```cmd
cd backend
.venv\Scripts\activate.bat
python seed.py
```

It prints every login and each problem with its ranked proposals. Other variants:

```cmd
python seed.py --reset --yes     :: wipe the demo data and seed it again (do this before each demo)
python seed.py --clear           :: remove the demo data only
python init_db.py --reset --yes  :: DANGER: drop every table and row, then re-apply the schema (run seed.py after)
python retry_ml.py               :: fill in ML results left pending because the ML service was down
```

## 8. Demo accounts

The password for every account is **`Samarth@2026`**. The persona buttons on the landing
page, login page and header log in as these accounts, so they only work after `seed.py`.

| Email | Role | Who |
|---|---|---|
| `officer.agri@samarth.demo` | govt_officer | Dr. Anjali Mehra, Ministry of Agriculture & Farmers Welfare |
| `officer.urban@samarth.demo` | govt_officer | Vikram Rao, Ministry of Housing & Urban Affairs |
| `evaluator@samarth.demo` | evaluator | Prof. Meera Iyer, Independent Technical Evaluation Panel |
| `krishinetra@samarth.demo` | startup | Aditya Kulkarni, KrishiNetra Vision Pvt Ltd |
| `bhoomisense@samarth.demo` | startup | Harpreet Kaur, BhoomiSense IoT Solutions |
| `mandimitra@samarth.demo` | startup | Sneha Deshpande, MandiMitra Agri Analytics |
| `punarchakra@samarth.demo` | startup | Rohan Joshi, PunarChakra CleanTech |
| `jansetu@samarth.demo` | startup | Imran Siddiqui, JanSetu Civic AI |

The seed also sets up KrishiNetra's pilot as active (milestone 2 waiting for verification)
and BhoomiSense's pilot as procured and listed as a proven solution, with a pending
replication request from the urban officer. See `DEMO.md` for the click-through.

---

## 9. Troubleshooting

**The venv isn't activated.**
Symptoms: `'uvicorn' is not recognized`, `No module named fastapi` / `sqlalchemy` / `spacy`,
or the prompt doesn't start with `(.venv)`. Fix: `cd` into the right folder and run
`.venv\Scripts\activate.bat`. The ML service and the backend each have their **own** venv,
so activating one doesn't help the other. `where python` should list the `.venv` path
first. In PowerShell the command is `.venv\Scripts\Activate.ps1` instead.

**A port is already in use.**
Symptoms: `[Errno 10048] ... only one usage of each socket address`, or Next.js starts on
3001 instead of 3000. Find and stop whatever holds the port:
```cmd
netstat -ano | findstr :8000
taskkill /PID <the PID from the last column> /F
```
Use `:8001` or `:3000` for the other services. It's often an old uvicorn or `next dev`
left running in another window.

**CORS errors in the browser console.**
- Open the site at exactly `http://localhost:3000` (or `http://127.0.0.1:3000`). Any other
  origin, such as another port or your LAN IP, has to be added to `FRONTEND_URL` in
  `backend\.env`, comma-separated. Restart the backend after changing it.
- A CORS error often hides a backend that's down or crashing. Check that
  http://localhost:8000/health works and look at the backend window for a traceback.
- Check `NEXT_PUBLIC_API_URL` in `frontend\.env`, and restart `npm run dev` after changing it.

**The ML service is offline.**
The app keeps working. Uploads, proposals and pilots all save normally, but tags, domains
and match scores show as pending ("AI match analysis pending."), and the domain eligibility
rule stays pending. Fix:
1. Start the ML service and wait for `Application startup complete`.
2. Check http://localhost:8001/healthz.
3. Check that `ML_SERVICE_URL` is `http://localhost:8001`.
4. Run `python retry_ml.py` in `backend\`, or click **Re-run AI Ranking** on a problem's shortlist.

If ML calls time out on a slow laptop, raise `ML_TIMEOUT_SECONDS`. If the first start
fails while downloading models, check your internet connection and start it again. The
download resumes.

**The frontend shows stale pages or odd build errors.**
`npm run build` and `npm run dev` share the `frontend\.next` folder. Running a build while
the dev server is up makes it serve stale pages. Fix:
```cmd
:: stop npm run dev first (Ctrl+C), then:
cd frontend
rmdir /s /q .next
npm run dev
```

**`python init_db.py` fails with "password authentication failed".**
The password in `DATABASE_URL` is wrong or not URL-encoded (see step 4). Also check that
the "postgresql-x64-…" service is running in `services.msc`.
