"""Checks which Muse models a Meta Model API key can actually call.

Usage (from backend/fastapi):
    .venv\\Scripts\\python scripts\\check_models.py                 # Windows
    .venv/bin/python scripts/check_models.py                       # macOS / Linux
    ... scripts/check_models.py muse-spark-1.3 muse-ember-1.0      # specific models
    ... scripts/check_models.py --shapes muse-spark-1.3            # which request shape is refused

The key is read from MODEL_API_KEY, or asked for without echoing it. It is never printed.
Each model gets a few tiny requests ("Reply with: ready"); the total cost is well under $0.001.
For each attempt it prints the HTTP status, Meta's error code and Meta's x-request-id, which Meta
support can look up.
"""

import getpass
import os
import sys

import httpx

BASE_URL = os.environ.get("MODEL_API_BASE_URL", "https://api.meta.ai/v1").strip().rstrip("/")
DEFAULT_MODELS = ["muse-spark-1.3", "muse-spark-1.2", "muse-ember-1.0"]
ATTEMPTS = 3


def main() -> int:
    key = (os.environ.get("MODEL_API_KEY") or getpass.getpass("MODEL_API_KEY (hidden): ")).strip().strip("\"'")
    if not key:
        print("No key given.")
        return 1
    headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    args = sys.argv[1:]
    if args and args[0] == "--shapes":
        with httpx.Client(base_url=BASE_URL, headers=headers, timeout=60) as client:
            for model in args[1:] or ["muse-spark-1.3"]:
                check_shapes(client, model)
        return 0
    models = args or DEFAULT_MODELS

    with httpx.Client(base_url=BASE_URL, headers=headers, timeout=60) as client:
        listed = client.get("/models")
        print(f"GET /models -> {listed.status_code}  x-request-id={listed.headers.get('x-request-id')}")
        if listed.status_code != 200:
            print(f"  error: {error_code(listed)}")
            return 1
        ids = sorted(m.get("id", "?") for m in listed.json().get("data", []))
        print("  models listed for this key:", ", ".join(ids) or "(none)")

        for model in models:
            print(f"\n{model}: {'listed' if model in ids else 'NOT listed'}")
            for attempt in range(1, ATTEMPTS + 1):
                res = client.post(
                    "/chat/completions",
                    json={
                        "model": model,
                        "messages": [{"role": "user", "content": "Reply with: ready"}],
                        "reasoning_effort": "low",
                        "max_tokens": 200,
                    },
                )
                outcome = "ok" if res.status_code == 200 else error_code(res)
                print(f"  attempt {attempt}: {res.status_code} {outcome}  x-request-id={res.headers.get('x-request-id')}")
    return 0


def _pair(first: str, second: str) -> dict:
    return {
        "type": "object",
        "additionalProperties": False,
        "required": [first, second],
        "properties": {first: {"type": "string"}, second: {"type": "string"}},
    }


def check_shapes(client: httpx.Client, model: str) -> None:
    """Sends one small catalog-like request in three shapes, to see which one the provider refuses."""
    flat = {
        "type": "object",
        "additionalProperties": False,
        "required": ["summary", "facts"],
        "properties": {"summary": {"type": "string"}, "facts": {"type": "array", "items": {"type": "string"}}},
    }
    nested = {
        "type": "object",
        "additionalProperties": False,
        "required": ["summary", "facts"],
        "properties": {"summary": {"type": "string"}, "facts": {"type": "array", "items": _pair("label", "value")}},
    }
    shapes = {
        "no schema": None,
        "flat schema (strings only)": flat,
        "nested schema (objects in arrays)": nested,
    }
    print(f"\nRequest shapes for {model}:")
    for label, schema in shapes.items():
        body: dict = {
            "model": model,
            "messages": [{"role": "user", "content": 'Return JSON: {"summary": "ok", "facts": []}'}],
            "reasoning_effort": "low",
            "max_tokens": 300,
        }
        if schema:
            body["response_format"] = {"type": "json_schema", "json_schema": {"name": "probe", "strict": True, "schema": schema}}
        res = client.post("/chat/completions", json=body)
        outcome = "ok" if res.status_code == 200 else error_code(res)
        print(f"  {label}: {res.status_code} {outcome}  x-request-id={res.headers.get('x-request-id')}")


def error_code(res: httpx.Response) -> str:
    try:
        error = res.json().get("error", {})
        return f"type={error.get('type')} code={error.get('code')}"
    except ValueError:
        return "(no JSON body)"


if __name__ == "__main__":
    sys.exit(main())
