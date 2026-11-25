"""The richer catalog entry: title, concise summary, facts, specific headings, related concepts,
and the guards against copied or invented content (REQ-AI-017, REQ-AI-018)."""

import json

from fastapi.testclient import TestClient

from services.llm import CATALOG_SCHEMA, COPIED_RUN_WORDS, SYSTEM_PROMPT, fallback_title
from test_catalog import AUTH, client, completion, use_provider  # noqa: F401  (client is a fixture)

SOURCE = (
    "The Silent Orchard is a 1987 novel by the Welsh writer Mara Ellis. It follows a botanist who "
    "returns to her family farm after a long drought. The book won the Hawthorn Prize in 1988 and "
    "was followed by a sequel, Winter Roots, in 1993. Ellis drew on her own childhood in Ceredigion. "
    "Critics compared its quiet style to the work of Thomas Hardy."
)


def entry(**overrides) -> str:
    value = {
        "title": "The Silent Orchard",
        "summary": "A Welsh novel about a botanist reconnecting with her drought-stricken family farm, praised for its restraint.",
        # The schema's format: "Label | Value" and "Name | Relation" strings.
        "facts": ["Type | Novel", "Author | Mara Ellis", "First published | 1987"],
        "subjects": ["Welsh fiction", "Rural life in literature"],
        "keywords": ["Mara Ellis", "Hawthorn Prize", "drought"],
        "related": ["Winter Roots | Sequel", "Thomas Hardy | Stylistic comparison"],
    }
    value.update(overrides)
    return json.dumps(value)


def catalog(client: TestClient, result, title: str | None = "The Silent Orchard - Example Books"):
    use_provider(completion(result))
    return client.post("/catalog", json={"title": title, "text": SOURCE}, headers=AUTH)


def test_returns_a_structured_catalog_entry(client):
    res = catalog(client, entry())
    assert res.status_code == 200
    body = res.json()
    assert body["title"] == "The Silent Orchard"
    assert body["facts"] == [
        {"label": "Type", "value": "Novel"},
        {"label": "Author", "value": "Mara Ellis"},
        {"label": "First published", "value": "1987"},
    ]
    assert body["subjects"] == ["Welsh fiction", "Rural life in literature"]
    assert body["related"] == [
        {"name": "Winter Roots", "relation": "Sequel"},
        {"name": "Thomas Hardy", "relation": "Stylistic comparison"},
    ]


class TestTitle:
    def test_falls_back_to_the_source_title_without_its_site_suffix(self, client):
        res = catalog(client, entry(title=""))
        assert res.json()["title"] == "The Silent Orchard"

    def test_is_none_without_any_title(self, client):
        res = catalog(client, entry(title="   "), title=None)
        assert res.status_code == 200
        assert res.json()["title"] is None

    def test_rejects_an_overlong_model_title_in_favour_of_the_source(self, client):
        assert catalog(client, entry(title="x" * 201)).json()["title"] == "The Silent Orchard"

    def test_fallback_title_rules(self):
        assert fallback_title("Topic - Wikipedia") == "Topic"
        assert fallback_title("Topic | The Site") == "Topic"
        assert fallback_title("A — B — Encyclopedia") == "A — B"
        assert fallback_title("Plain title") == "Plain title"
        assert fallback_title(None) is None


class TestFacts:
    def test_drops_facts_the_source_does_not_support(self, client):
        facts = [
            {"label": "Author", "value": "Mara Ellis"},
            {"label": "Pages", "value": "412"},  # not in the source
            {"label": "Publisher", "value": "Bluebell Press"},  # invented
        ]
        assert catalog(client, entry(facts=facts)).json()["facts"] == [{"label": "Author", "value": "Mara Ellis"}]

    def test_cleans_duplicates_blanks_and_overlong_values(self, client):
        facts = [
            {"label": " Author ", "value": " Mara  Ellis "},
            {"label": "author", "value": "Mara Ellis"},
            {"label": "", "value": "1987"},
            {"label": "Year", "value": ""},
            {"label": "Award", "value": "Hawthorn Prize " * 20},
            {"label": "x" * 61, "value": "1988"},
            {"label": "Missing value"},
            "not an object",
        ]
        res = catalog(client, entry(facts=[f for f in facts if isinstance(f, dict)]))
        assert res.json()["facts"] == [{"label": "Author", "value": "Mara Ellis"}]

    def test_keeps_at_most_eight(self, client):
        facts = [{"label": f"Fact {i}", "value": "1987"} for i in range(12)]
        assert len(catalog(client, entry(facts=facts)).json()["facts"]) == 8

    def test_an_empty_list_is_fine(self, client):
        res = catalog(client, entry(facts=[]))
        assert res.status_code == 200 and res.json()["facts"] == []

    def test_a_non_list_is_malformed_output(self, client):
        res = catalog(client, entry(facts="Author: Mara Ellis"))
        assert res.status_code == 502
        assert res.json()["error"]["code"] == "INVALID_MODEL_OUTPUT"


class TestRelatedConcepts:
    def test_drops_concepts_the_source_never_names(self, client):
        related = [
            {"name": "Winter Roots", "relation": "Sequel"},
            {"name": "Summer Leaves", "relation": "Prequel"},  # invented
        ]
        assert catalog(client, entry(related=related)).json()["related"] == [{"name": "Winter Roots", "relation": "Sequel"}]

    def test_drops_the_subject_itself_duplicates_and_overlong_relations(self, client):
        related = [
            {"name": "The Silent Orchard", "relation": "Itself"},
            {"name": "winter roots", "relation": "Sequel"},
            {"name": "Winter Roots", "relation": "Sequel again"},
            {"name": "Ceredigion", "relation": "x" * 61},
            {"name": "Thomas Hardy", "relation": ""},
        ]
        assert catalog(client, entry(related=related)).json()["related"] == [{"name": "winter roots", "relation": "Sequel"}]

    def test_keeps_at_most_eight(self, client):
        names = ["Mara Ellis", "Winter Roots", "Thomas Hardy", "Ceredigion", "Hawthorn Prize", "botanist", "drought", "family farm", "novel", "sequel"]
        related = [{"name": n, "relation": "Mentioned"} for n in names]
        assert len(catalog(client, entry(related=related)).json()["related"]) == 8


class TestHeadingsAndKeywords:
    def test_keywords_do_not_repeat_the_title_or_headings(self, client):
        res = catalog(client, entry(keywords=["The Silent Orchard", "welsh fiction", "Mara Ellis", "drought"]))
        assert res.json()["keywords"] == ["Mara Ellis", "drought"]

    def test_keeps_keywords_if_all_of_them_repeat(self, client):
        res = catalog(client, entry(keywords=["Welsh fiction"]))
        assert res.status_code == 200 and res.json()["keywords"] == ["Welsh fiction"]

    def test_prompt_asks_for_specific_headings_not_broad_ones(self):
        assert "most specific first" in SYSTEM_PROMPT
        assert "Avoid broad" in SYSTEM_PROMPT
        assert "broad subject headings" not in SYSTEM_PROMPT


class TestCopyrightSafety:
    def test_rejects_a_summary_that_copies_the_source(self, client):
        copied = "It follows a botanist who returns to her family farm after a long drought. A fine book."
        res = catalog(client, entry(summary=copied))
        assert res.status_code == 502
        assert res.json()["error"]["code"] == "INVALID_MODEL_OUTPUT"

    def test_allows_short_shared_phrases(self, client):
        words = SOURCE.split()[: COPIED_RUN_WORDS - 1]
        res = catalog(client, entry(summary=" ".join(words) + " and more in other words."))
        assert res.status_code == 200

    def test_prompt_requires_original_wording_and_grounding(self):
        assert "own words" in SYSTEM_PROMPT
        assert "Never copy" in SYSTEM_PROMPT
        assert "Only include relationships the document states" in SYSTEM_PROMPT
        assert "60 words" in SYSTEM_PROMPT


def test_accepts_an_answer_in_the_older_shape(client):
    old = json.dumps({"summary": "A short original description.", "subjects": ["Welsh fiction"], "keywords": ["Mara Ellis"]})
    res = catalog(client, old)
    assert res.status_code == 200
    assert res.json()["facts"] == [] and res.json()["related"] == []
    assert res.json()["title"] == "The Silent Orchard"


def test_schema_is_flat_and_within_the_strict_subset():
    # Only the shape Meta Model API accepted in production: a root object of strings and arrays
    # of strings. Nested objects made the provider answer model_not_found for every model.
    assert CATALOG_SCHEMA["additionalProperties"] is False
    assert sorted(CATALOG_SCHEMA["required"]) == sorted(CATALOG_SCHEMA["properties"])
    for field in CATALOG_SCHEMA["properties"].values():
        assert field["type"] in ("string", "array")
        if field["type"] == "array":
            assert field["items"] == {"type": "string"}


class TestPairFormat:
    def test_accepts_objects_from_older_answers(self, client):
        res = catalog(
            client,
            entry(
                facts=[{"label": "Author", "value": "Mara Ellis"}],
                related=[{"name": "Winter Roots", "relation": "Sequel"}],
            ),
        )
        assert res.json()["facts"] == [{"label": "Author", "value": "Mara Ellis"}]
        assert res.json()["related"] == [{"name": "Winter Roots", "relation": "Sequel"}]

    def test_splits_on_the_side_that_keeps_names_and_values_whole(self, client):
        res = catalog(
            client,
            entry(
                facts=["Award | Hawthorn Prize | 1988"],  # value keeps its own "|"
                related=["Winter Roots | Sequel"],
            ),
        )
        assert res.json()["facts"] == [{"label": "Award", "value": "Hawthorn Prize | 1988"}]

    def test_drops_strings_without_a_separator_or_a_side(self, client):
        res = catalog(client, entry(facts=["Author Mara Ellis", "| 1987", "Author |"], related=["Winter Roots", " | Sequel"]))
        assert res.status_code == 200
        assert res.json()["facts"] == [] and res.json()["related"] == []
