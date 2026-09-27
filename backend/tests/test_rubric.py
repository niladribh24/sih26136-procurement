"""POST /api/solutions/:id/rubric."""

from tests.helpers import auth, create_problem, make_admin, signup, submit_solution

RUBRIC = {"technicalMerit": 27, "costRealism": 16, "teamCapability": 18, "timelineViability": 25}


def _setup(client):
    officer = signup(client, "govt_officer")
    startup = signup(client, "startup")
    problem = create_problem(client, officer["token"])
    solution = submit_solution(client, startup["token"], problem["id"])
    return officer, startup, solution


def _post(client, token_or_headers, solution_id, body=RUBRIC):
    headers = token_or_headers if isinstance(token_or_headers, dict) else auth(token_or_headers)
    return client.post(f"/api/solutions/{solution_id}/rubric", json=body, headers=headers)


def test_officer_saves_rubric_and_it_shows_on_the_solution(client):
    officer, startup, solution = _setup(client)
    assert "rubricScore" not in solution

    res = _post(client, officer["token"], solution["id"])
    assert res.status_code == 200, res.text
    assert res.json()["rubricScore"] == {**RUBRIC, "total": 86}

    # Visible on every read, including the startup's own view of its proposal.
    listed = client.get(f"/api/solutions/{solution['id']}", headers=auth(startup["token"])).json()
    assert listed["rubricScore"]["total"] == 86


def test_latest_save_wins(client):
    officer, _, solution = _setup(client)
    evaluator = signup(client, "evaluator")
    _post(client, officer["token"], solution["id"])
    res = _post(client, evaluator["token"], solution["id"], {**RUBRIC, "technicalMerit": 10})
    assert res.status_code == 200
    assert res.json()["rubricScore"]["total"] == 69


def test_out_of_range_is_422(client):
    officer, _, solution = _setup(client)
    for field, bad in [("technicalMerit", 31), ("costRealism", 21), ("teamCapability", -1), ("timelineViability", 30.5)]:
        assert _post(client, officer["token"], solution["id"], {**RUBRIC, field: bad}).status_code == 422, field
    assert _post(client, officer["token"], solution["id"], {"technicalMerit": 10}).status_code == 422


def test_roles(client, db):
    officer, startup, solution = _setup(client)
    other_officer = signup(client, "govt_officer")
    other_startup = signup(client, "startup")

    assert _post(client, startup["token"], solution["id"]).status_code == 403
    assert _post(client, other_startup["token"], solution["id"]).status_code == 403
    assert _post(client, other_officer["token"], solution["id"]).status_code == 403
    assert _post(client, make_admin(db), solution["id"]).status_code == 403
    assert _post(client, signup(client, "evaluator")["token"], solution["id"]).status_code == 200
    assert client.post(f"/api/solutions/{solution['id']}/rubric", json=RUBRIC).status_code == 401
