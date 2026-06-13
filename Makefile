.PHONY: install dev api frontend test test-report verify-determinism reports lint build clean

install:
	python3 -m venv .venv && . .venv/bin/activate && pip install -U pip && pip install -r requirements.txt
	cd frontend && npm install

dev:
	docker-compose up -d postgres redis
	. .venv/bin/activate && uvicorn api.main:app --reload --port 8000 & \
	cd frontend && npm run dev

api:
	. .venv/bin/activate && uvicorn api.main:app --reload --port 8000

frontend:
	cd frontend && npm run dev

test:
	. .venv/bin/activate && ORION_LLM_CACHE_MODE=read_write pytest -q

test-e2e:
	cd frontend && npm run test:e2e

integration-compose:
	bash scripts/integration_compose_test.sh

test-report:
	. .venv/bin/activate && pytest --html=reports/phases/test_report.html --self-contained-html -q

# NFR-1: run the same session twice and prove the report hashes match.
verify-determinism:
	. .venv/bin/activate && python scripts/verify_determinism.py

reports:
	. .venv/bin/activate && python scripts/generate_all_phase_reports.py

lint:
	. .venv/bin/activate && ruff check . --fix

build:
	docker build -t orion-researcher:local .

clean:
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null; true
	rm -rf .cache reports/phases/* 2>/dev/null; true
