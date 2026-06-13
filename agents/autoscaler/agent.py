"""Autoscaler Agent (FR-13) — emits a scaling signal from queue depth / latency.

Deterministic pure function: given metrics, returns the desired replica count per agent
type. KEDA/HPA consume this via the /metrics endpoint; nothing here mutates a cluster.
"""
from __future__ import annotations

from typing import Any

SCALE_UP_THRESHOLD = 5  # tasks per pod (matches k8s/base/hpa.yaml)
MAX_REPLICAS = 20


class AutoscalerAgent:
    role = "autoscaler"

    async def run(self, state: dict[str, Any]) -> dict[str, Any]:
        metrics = state.get("queue_metrics", {})  # {agent_type: queue_depth}
        desired = {a: self.desired_replicas(d) for a, d in metrics.items()}
        return {**state, "scaling_decision": desired}

    @staticmethod
    def desired_replicas(queue_depth: int) -> int:
        if queue_depth <= 0:
            return 0  # scale-to-zero (KEDA)
        return min(MAX_REPLICAS, -(-queue_depth // SCALE_UP_THRESHOLD))  # ceil division
