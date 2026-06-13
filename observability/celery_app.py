"""Celery application (FR-20). Redis broker + result backend.

Referenced by docker-compose:  celery -A observability.celery_app worker ...
The autoscaler/KEDA scale on this queue's depth (k8s/base/hpa.yaml).
"""
from __future__ import annotations

from celery import Celery

from config import get_settings

settings = get_settings()

celery_app = Celery(
    "orion",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=["observability.tasks"],
)

celery_app.conf.update(
    task_default_queue="research_tasks",   # matches HPA/KEDA selector
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    task_track_started=True,
    worker_prefetch_multiplier=1,          # one task per worker → clean queue-depth signal
)
