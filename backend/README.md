# SAMARTH backend

FastAPI + SQLAlchemy over PostgreSQL. `schema.sql` is the only schema definition — the
SQLAlchemy models in `app/models/` map onto it and never create tables themselves.

## Setup (Windows, PowerShell, from `backend/`)

```powershell
py -3.14 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env      # then fill in your postgres password
```

## Database

```powershell
python init_db.py                # creates sih_db if missing, applies schema.sql once
python init_db.py --reset        # DEV ONLY: wipes every table + row and re-applies schema.sql
```

After editing `schema.sql`, run `--reset` and update the matching model in `app/models/`;
`pytest` fails if the two drift apart.

## Run

```powershell
uvicorn app.main:app --reload --port 8000
curl http://localhost:8000/health    # {"status":"ok","database":"ok"}
```

## Test

```powershell
pytest    # needs the schema applied (python init_db.py)
```
