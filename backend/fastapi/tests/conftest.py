"""Test settings. Set before the app is imported, so no real .env value or key is used."""

import os
import sys
from pathlib import Path

TEST_ENV = {
    "MODEL_API_KEY": "test-model-api-key-not-real",
    "MODEL_API_BASE_URL": "https://api.example.test/v1",
    "MUSE_CATALOG_MODEL": "muse-ember-1.0",
    "MUSE_CATALOG_REASONING_EFFORT": "low",
    "CATALOG_MAX_INPUT_CHARS": "2000",
    "AI_SERVICE_TOKEN": "test-internal-token-0123456789abcdef0123",
}
os.environ.update(TEST_ENV)

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
