#!/usr/bin/env python3
"""Infer synthetic cognitive/relational profiles from uploaded task exports.

This script intentionally uses only Python's standard library so it can run in a
clean Cursor/Cloud workspace. It treats uploaded rows as synthetic behavioral
records and writes aggregate/persona-style summaries without modifying or
committing raw workbooks.
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import statistics
import sys
import xml.etree.ElementTree as ET
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable
from zipfile import ZipFile


UPLOAD_CANDIDATES = [
    Path("/home/ubuntu/.cursor/projects/workspace/uploads"),
    Path("uploads"),
    Path("data/uploads"),
]


TRAIT_LABELS = {
    "attunement": "Relational attunement",
    "emotionalCalibration": "Emotional calibration",
    "responseFlexibility": "Response flexibility",
    "patienceUnderAmbiguity": "Patience under ambiguity",
    "boundaryClarity": "Boundary clarity",
    "socialLearningOrientation": "Social learning orientation",
}


PROFILE_TARGETS = [
    {
        "id": "secure-collaborator",
        "label": "Secure collaborator",
        "summary": "Balances warmth with clear interpretation, steady listening, and repair-oriented pacing.",
        "targets": {
            "attunement": 82,
            "emotionalCalibration": 84,
            "responseFlexibility": 76,
            "patienceUnderAmbiguity": 78,
            "boundaryClarity": 72,
            "socialLearningOrientation": 80,
        },
    },
    {
        "id": "empathic-harmonizer",
        "label": "Empathic harmonizer",
        "summary": "Highly responsive to relational signals and motivated to maintain connection.",
        "targets": {
            "attunement": 88,
            "emotionalCalibration": 78,
            "responseFlexibility": 74,
            "patienceUnderAmbiguity": 70,
            "boundaryClarity": 62,
            "socialLearningOrientation": 82,
        },
    },
    {
        "id": "analytical-boundary-setter",
        "label": "Analytical boundary setter",
        "summary": "Deliberate, restrained, and clear about limits while preserving collaborative intent.",
        "targets": {
            "attunement": 70,
            "emotionalCalibration": 76,
            "responseFlexibility": 68,
            "patienceUnderAmbiguity": 84,
            "boundaryClarity": 86,
            "socialLearningOrientation": 68,
        },
    },
    {
        "id": "adaptive-explorer",
        "label": "Adaptive explorer",
        "summary": "Learns quickly from feedback and adjusts interaction style across contexts.",
        "targets": {
            "attunement": 74,
            "emotionalCalibration": 72,
            "responseFlexibility": 86,
            "patienceUnderAmbiguity": 72,
            "boundaryClarity": 70,
            "socialLearningOrientation": 88,
        },
    },
]


@dataclass(frozen=True)
class MeasureSpec:
    construct: str
    dataset_prefix: str
    task: str
    core_measure: str
    label: str
    direction: str = "high"
    weight: float = 1.0


MEASURE_SPECS = [
    # Attention / signal detection.
    MeasureSpec("attentionControl", "shared_AS_", "AS", "acc", "Auditory accuracy"),
    MeasureSpec("attentionControl", "shared_AS_", "AS", "hit_ct", "Auditory hit count"),
    MeasureSpec("attentionControl", "shared_CRT_", "CRT", "hit_ct", "Choice RT hit count"),
    MeasureSpec("attentionControl", "shared_HP_", "HP", "adj_hit_ct", "Hidden Patterns adjusted hits"),
    MeasureSpec("attentionControl", "shared_IP_", "IP", "adj_hit_ct", "Identical Pictures adjusted hits"),
    # Speed.
    MeasureSpec("processingSpeed", "shared_CRT_", "CRT", "crt_mean", "Choice RT mean", "low"),
    MeasureSpec("processingSpeed", "shared_SRT_", "SRT", "mean", "Simple RT mean", "low"),
    MeasureSpec("processingSpeed", "shared_AS_", "AS", "mdn", "Auditory median RT", "low"),
    MeasureSpec("processingSpeed", "shared_TMA_", "TMA", "comp_time", "Trail A completion time", "low"),
    MeasureSpec("processingSpeed", "shared_TMB_", "TMB", "comp_time", "Trail B completion time", "low"),
    # Inhibition / error control.
    MeasureSpec("responseInhibition", "shared_CRT_", "CRT", "inc_ct", "Choice RT incorrect count", "low"),
    MeasureSpec("responseInhibition", "shared_CRT_", "CRT", "miss_ct", "Choice RT miss count", "low"),
    MeasureSpec("responseInhibition", "shared_TMA_", "TMA", "err_ct", "Trail A error count", "low"),
    MeasureSpec("responseInhibition", "shared_TMB_", "TMB", "err_ct", "Trail B error count", "low"),
    MeasureSpec("responseInhibition", "shared_DF_", "DF", "rpt_pat_ct", "Design Fluency repeat count", "low"),
    # Flexibility / planning.
    MeasureSpec("cognitiveFlexibility", "shared_TMA_", "TMA", "crctness", "Trail A circuitousness", "low"),
    MeasureSpec("cognitiveFlexibility", "shared_TMB_", "TMB", "crctness", "Trail B circuitousness", "low"),
    MeasureSpec("cognitiveFlexibility", "shared_TMA_", "TMA", "draw_vel", "Trail A drawing velocity"),
    MeasureSpec("cognitiveFlexibility", "shared_DF_", "DF", "unq_pat_ct", "Design Fluency unique patterns"),
    # Working memory.
    MeasureSpec("workingMemory", "shared_SS_", "SS", "max_corr", "Spatial Span max correct"),
    MeasureSpec("workingMemory", "shared_SS_", "SS", "adj_MS", "Spatial Span adjusted mean span"),
    # Perceptual discrimination.
    MeasureSpec("perceptualDiscrimination", "shared_HP_", "HP", "hit_ct", "Hidden Patterns hits"),
    MeasureSpec("perceptualDiscrimination", "shared_HP_", "HP", "inc_ct", "Hidden Patterns incorrect count", "low"),
    MeasureSpec("perceptualDiscrimination", "shared_IP_", "IP", "hit_ct", "Identical Pictures hits"),
    MeasureSpec("perceptualDiscrimination", "shared_IP_", "IP", "inc_ct", "Identical Pictures incorrect count", "low"),
    # Generativity.
    MeasureSpec("generativity", "shared_DF_", "DF", "tot_pat_ct", "Design Fluency total patterns"),
    MeasureSpec("generativity", "shared_DF_", "DF", "lgl_pat_ct", "Design Fluency legal patterns"),
    MeasureSpec("generativity", "shared_DF_", "DF", "unq_pat_ct", "Design Fluency unique patterns"),
    # Feedback / learning proxies. Prefer non-word-ish efficiency signals where possible.
    MeasureSpec("feedbackLearning", "shared_DF_", "DF", "unq_pat_ct", "Design Fluency unique patterns"),
    MeasureSpec("feedbackLearning", "shared_TMB_", "TMB", "err_ct", "Trail B error count", "low"),
    MeasureSpec("feedbackLearning", "shared_SS_", "SS", "adj_MS", "Spatial Span adjusted mean span"),
    # Risk/reward is not directly represented in the uploaded neuropsych battery,
    # so we estimate it conservatively from inhibition and flexible adjustment.
    MeasureSpec("riskRewardLearning", "shared_CRT_", "CRT", "inc_ct", "Choice RT incorrect count", "low"),
    MeasureSpec("riskRewardLearning", "shared_DF_", "DF", "rpt_pat_ct", "Design Fluency repeat count", "low"),
    MeasureSpec("riskRewardLearning", "shared_TMB_", "TMB", "err_ct", "Trail B error count", "low"),
]


CONSTRUCT_LABELS = {
    "riskRewardLearning": "Risk-reward learning proxy",
    "attentionControl": "Attention control",
    "processingSpeed": "Processing speed",
    "responseInhibition": "Response inhibition",
    "cognitiveFlexibility": "Cognitive flexibility",
    "workingMemory": "Working memory",
    "perceptualDiscrimination": "Perceptual discrimination",
    "generativity": "Generativity",
    "feedbackLearning": "Feedback learning",
}


CONSTRUCT_TO_TRAITS = {
    "attunement": {
        "attentionControl": 0.32,
        "perceptualDiscrimination": 0.24,
        "workingMemory": 0.16,
        "responseInhibition": 0.16,
        "processingSpeed": 0.12,
    },
    "emotionalCalibration": {
        "riskRewardLearning": 0.30,
        "responseInhibition": 0.24,
        "attentionControl": 0.18,
        "feedbackLearning": 0.16,
        "workingMemory": 0.12,
    },
    "responseFlexibility": {
        "cognitiveFlexibility": 0.34,
        "generativity": 0.22,
        "feedbackLearning": 0.18,
        "processingSpeed": 0.14,
        "workingMemory": 0.12,
    },
    "patienceUnderAmbiguity": {
        "responseInhibition": 0.30,
        "workingMemory": 0.20,
        "attentionControl": 0.18,
        "riskRewardLearning": 0.18,
        "feedbackLearning": 0.14,
    },
    "boundaryClarity": {
        "responseInhibition": 0.34,
        "riskRewardLearning": 0.22,
        "cognitiveFlexibility": 0.16,
        "attentionControl": 0.16,
        "generativity": 0.12,
    },
    "socialLearningOrientation": {
        "feedbackLearning": 0.30,
        "cognitiveFlexibility": 0.20,
        "workingMemory": 0.18,
        "generativity": 0.16,
        "attentionControl": 0.16,
    },
}


def find_upload_dir(explicit: str | None) -> Path:
    if explicit:
        path = Path(explicit).expanduser().resolve()
        if not path.exists():
            raise SystemExit(f"Upload directory not found: {path}")
        return path
    for candidate in UPLOAD_CANDIDATES:
        if candidate.exists():
            return candidate.resolve()
    raise SystemExit(
        "No upload directory found. Pass --uploads-dir PATH containing shared_*.xlsx and dict_shared_*.csv files."
    )


def text_of_cell(cell: ET.Element, shared_strings: list[str], ns: dict[str, str]) -> str:
    cell_type = cell.attrib.get("t")
    value = cell.find("m:v", ns)
    if value is None:
        inline = cell.find("m:is/m:t", ns)
        return inline.text if inline is not None and inline.text is not None else ""
    raw = value.text or ""
    if cell_type == "s":
        try:
            return shared_strings[int(raw)]
        except (ValueError, IndexError):
            return ""
    return raw


def load_shared_strings(zip_file: ZipFile) -> list[str]:
    if "xl/sharedStrings.xml" not in zip_file.namelist():
        return []
    ns = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    root = ET.fromstring(zip_file.read("xl/sharedStrings.xml"))
    strings: list[str] = []
    for item in root.findall("m:si", ns):
        parts = [text.text or "" for text in item.findall(".//m:t", ns)]
        strings.append("".join(parts))
    return strings


def column_index(cell_ref: str) -> int:
    letters = "".join(ch for ch in cell_ref if ch.isalpha())
    index = 0
    for letter in letters:
        index = index * 26 + (ord(letter.upper()) - ord("A") + 1)
    return index - 1


def read_xlsx_selected(path: Path, wanted_columns: set[str]) -> tuple[list[str], list[dict[str, str]]]:
    ns = {
        "m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
        "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
        "p": "http://schemas.openxmlformats.org/package/2006/relationships",
    }
    with ZipFile(path) as zip_file:
        shared_strings = load_shared_strings(zip_file)
        workbook = ET.fromstring(zip_file.read("xl/workbook.xml"))
        relationships = ET.fromstring(zip_file.read("xl/_rels/workbook.xml.rels"))
        rel_map = {
            rel.attrib["Id"]: rel.attrib["Target"].lstrip("/")
            for rel in relationships.findall("p:Relationship", ns)
        }
        first_sheet = workbook.find("m:sheets/m:sheet", ns)
        if first_sheet is None:
            return [], []
        rel_id = first_sheet.attrib.get(
            "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"
        )
        target = rel_map.get(rel_id or "", "worksheets/sheet1.xml")
        sheet_path = f"xl/{target}" if not target.startswith("xl/") else target

        rows_iter = ET.iterparse(zip_file.open(sheet_path), events=("end",))
        header: list[str] | None = None
        selected_positions: dict[int, str] = {}
        rows: list[dict[str, str]] = []
        for _event, element in rows_iter:
            if not element.tag.endswith("row"):
                continue
            values_by_index: dict[int, str] = {}
            for cell in element:
                if not cell.tag.endswith("c"):
                    continue
                ref = cell.attrib.get("r", "")
                values_by_index[column_index(ref)] = text_of_cell(cell, shared_strings, ns)

            if header is None:
                max_index = max(values_by_index) if values_by_index else -1
                header = [values_by_index.get(i, "") for i in range(max_index + 1)]
                selected_positions = {
                    index: name
                    for index, name in enumerate(header)
                    if name in wanted_columns or name == "subject_id"
                }
            else:
                row = {
                    name: values_by_index.get(index, "")
                    for index, name in selected_positions.items()
                }
                if row.get("subject_id"):
                    rows.append(row)
            element.clear()
        return header or [], rows


def read_dictionary(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8-sig") as file:
        return list(csv.DictReader(file, delimiter="\t"))


def find_file(upload_dir: Path, prefix: str, suffix: str) -> Path | None:
    matches = sorted(upload_dir.glob(f"{prefix}*{suffix}"))
    return matches[0] if matches else None


def resolve_measure_columns(upload_dir: Path) -> tuple[dict[MeasureSpec, str], list[str]]:
    resolved: dict[MeasureSpec, str] = {}
    notes: list[str] = []
    dictionary_cache: dict[str, list[dict[str, str]]] = {}

    for spec in MEASURE_SPECS:
        dictionary_prefix = f"dict_{spec.dataset_prefix}"
        dictionary_path = find_file(upload_dir, dictionary_prefix, ".csv")
        if dictionary_path is None:
            notes.append(f"Missing dictionary for {spec.dataset_prefix}; skipped {spec.label}.")
            continue
        cache_key = str(dictionary_path)
        if cache_key not in dictionary_cache:
            dictionary_cache[cache_key] = read_dictionary(dictionary_path)
        for row in dictionary_cache[cache_key]:
            if row.get("task") == spec.task and row.get("core_measure") == spec.core_measure:
                resolved[spec] = row["col_name"]
                break
        if spec not in resolved:
            notes.append(
                f"Missing column for {spec.dataset_prefix} {spec.task}.{spec.core_measure}; skipped {spec.label}."
            )
    return resolved, notes


def parse_float(value: str) -> float | None:
    if value is None or value == "":
        return None
    try:
        parsed = float(value)
    except ValueError:
        return None
    if math.isnan(parsed) or math.isinf(parsed):
        return None
    return parsed


def percentile_scores(values: dict[str, float], high_is_good: bool) -> dict[str, float]:
    ordered = sorted(values.items(), key=lambda item: item[1])
    count = len(ordered)
    if count == 0:
        return {}
    if count == 1:
        only_id = ordered[0][0]
        return {only_id: 50.0}
    scores: dict[str, float] = {}
    for rank, (subject_id, _value) in enumerate(ordered):
        pct = 100 * rank / (count - 1)
        scores[subject_id] = pct if high_is_good else 100 - pct
    return scores


def weighted_mean(items: Iterable[tuple[float, float]]) -> float | None:
    total_weight = 0.0
    weighted = 0.0
    for value, weight in items:
        weighted += value * weight
        total_weight += weight
    if total_weight == 0:
        return None
    return weighted / total_weight


def score_constructs(
    upload_dir: Path,
    resolved_columns: dict[MeasureSpec, str],
) -> tuple[dict[str, dict[str, float]], dict[str, dict[str, list[str]]], list[str]]:
    measure_values: dict[MeasureSpec, dict[str, float]] = defaultdict(dict)
    notes: list[str] = []

    by_dataset: dict[str, list[tuple[MeasureSpec, str]]] = defaultdict(list)
    for spec, column in resolved_columns.items():
        by_dataset[spec.dataset_prefix].append((spec, column))

    for dataset_prefix, specs in by_dataset.items():
        workbook_path = find_file(upload_dir, dataset_prefix, ".xlsx")
        if workbook_path is None:
            notes.append(f"Missing workbook for {dataset_prefix}; skipped its measures.")
            continue
        wanted = {column for _spec, column in specs}
        wanted.add("subject_id")
        _header, rows = read_xlsx_selected(workbook_path, wanted)
        for row in rows:
            subject_id = row.get("subject_id", "")
            for spec, column in specs:
                value = parse_float(row.get(column, ""))
                if value is not None:
                    measure_values[spec][subject_id] = value

    normalized_by_spec: dict[MeasureSpec, dict[str, float]] = {}
    for spec, values in measure_values.items():
        normalized_by_spec[spec] = percentile_scores(values, spec.direction == "high")

    construct_inputs: dict[str, dict[str, list[tuple[float, float, str]]]] = defaultdict(
        lambda: defaultdict(list)
    )
    for spec, scores in normalized_by_spec.items():
        for subject_id, score in scores.items():
            construct_inputs[spec.construct][subject_id].append(
                (score, spec.weight, spec.label)
            )

    subject_constructs: dict[str, dict[str, float]] = defaultdict(dict)
    evidence: dict[str, dict[str, list[str]]] = defaultdict(lambda: defaultdict(list))
    subject_ids = sorted({sid for construct in construct_inputs.values() for sid in construct})
    for subject_id in subject_ids:
        for construct in CONSTRUCT_LABELS:
            inputs = construct_inputs.get(construct, {}).get(subject_id, [])
            score = weighted_mean((score, weight) for score, weight, _label in inputs)
            if score is not None:
                subject_constructs[subject_id][construct] = round(score, 1)
                top_inputs = sorted(inputs, key=lambda item: item[0], reverse=True)[:3]
                evidence[subject_id][construct] = [
                    f"{label}: {round(score)}" for score, _weight, label in top_inputs
                ]
    return subject_constructs, evidence, notes


def score_traits(constructs: dict[str, float]) -> dict[str, float]:
    traits: dict[str, float] = {}
    for trait, weights in CONSTRUCT_TO_TRAITS.items():
        available = [
            (constructs[key], weight) for key, weight in weights.items() if key in constructs
        ]
        score = weighted_mean(available)
        traits[trait] = round(score, 1) if score is not None else 0.0
    return traits


def profile_matches(traits: dict[str, float]) -> list[dict[str, Any]]:
    matches = []
    for profile in PROFILE_TARGETS:
        distances = [
            abs(traits.get(trait, 0) - target)
            for trait, target in profile["targets"].items()
        ]
        fit = max(0, min(100, 100 - statistics.mean(distances)))
        matches.append(
            {
                "profileId": profile["id"],
                "label": profile["label"],
                "fit": round(fit, 1),
                "summary": profile["summary"],
            }
        )
    return sorted(matches, key=lambda match: match["fit"], reverse=True)


def profile_narrative(profile: dict[str, Any], traits: dict[str, float], constructs: dict[str, float]) -> str:
    top_traits = sorted(traits.items(), key=lambda item: item[1], reverse=True)[:2]
    lower_traits = sorted(traits.items(), key=lambda item: item[1])[:2]
    top_constructs = sorted(constructs.items(), key=lambda item: item[1], reverse=True)[:2]
    article = "an" if profile["label"][0].lower() in "aeiou" else "a"
    spread = max(traits.values()) - min(traits.values()) if traits else 0
    watchout = (
        "No clear relative watch-out appears because the trait scores are tightly clustered."
        if spread < 5
        else (
            f"Developmental watch-outs are {TRAIT_LABELS[lower_traits[0][0]]} "
            f"({lower_traits[0][1]}) and {TRAIT_LABELS[lower_traits[1][0]]} ({lower_traits[1][1]})."
        )
    )
    return (
        f"Reads as {article} {profile['label']} pattern: strongest relational signals are "
        f"{TRAIT_LABELS[top_traits[0][0]]} ({top_traits[0][1]}) and "
        f"{TRAIT_LABELS[top_traits[1][0]]} ({top_traits[1][1]}), supported by "
        f"{CONSTRUCT_LABELS[top_constructs[0][0]]} ({top_constructs[0][1]}) and "
        f"{CONSTRUCT_LABELS[top_constructs[1][0]]} ({top_constructs[1][1]}). "
        f"{watchout}"
    )


def build_profiles(
    subject_constructs: dict[str, dict[str, float]],
    evidence: dict[str, dict[str, list[str]]],
    limit_profiles: int,
) -> list[dict[str, Any]]:
    profiles = []
    for index, subject_id in enumerate(sorted(subject_constructs)):
        constructs = subject_constructs[subject_id]
        if len(constructs) < 4:
            continue
        traits = score_traits(constructs)
        matches = profile_matches(traits)
        pseudo_id = f"synthetic_person_{index + 1:04d}"
        profiles.append(
            {
                "id": pseudo_id,
                "sourceRowKey": f"row_{index + 1:04d}",
                "constructScores": {
                    CONSTRUCT_LABELS[key]: value
                    for key, value in sorted(constructs.items())
                },
                "traitScores": {
                    TRAIT_LABELS[key]: value for key, value in sorted(traits.items())
                },
                "topProfile": matches[0],
                "profileMatches": matches,
                "narrative": profile_narrative(matches[0], traits, constructs),
                "evidence": {
                    CONSTRUCT_LABELS[key]: values
                    for key, values in evidence.get(subject_id, {}).items()
                },
            }
        )
    return profiles[:limit_profiles]


def summarize_archetypes(profiles: list[dict[str, Any]]) -> list[dict[str, Any]]:
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for profile in profiles:
        grouped[profile["topProfile"]["label"]].append(profile)
    archetypes = []
    for label, items in sorted(grouped.items()):
        trait_keys = list(items[0]["traitScores"].keys())
        construct_keys = list(items[0]["constructScores"].keys())
        avg_traits = {
            key: round(statistics.mean(item["traitScores"][key] for item in items), 1)
            for key in trait_keys
        }
        avg_constructs = {
            key: round(statistics.mean(item["constructScores"].get(key, 0) for item in items), 1)
            for key in construct_keys
        }
        archetypes.append(
            {
                "label": label,
                "count": len(items),
                "averageTraits": avg_traits,
                "averageConstructs": avg_constructs,
                "strongestTrait": max(avg_traits.items(), key=lambda item: item[1]),
                "strongestConstruct": max(avg_constructs.items(), key=lambda item: item[1]),
            }
        )
    return sorted(archetypes, key=lambda item: item["count"], reverse=True)


def write_markdown(path: Path, profiles: list[dict[str, Any]], archetypes: list[dict[str, Any]], notes: list[str]) -> None:
    lines = [
        "# Synthetic Cognitive-Trait Reverse Engineering Report",
        "",
        "This report treats uploaded rows as synthetic behavioral records. It is not a clinical, hiring, or diagnostic interpretation.",
        "",
        "## Archetype summary",
        "",
    ]
    if not archetypes:
        lines.append("No archetypes could be generated from the available files.")
    for archetype in archetypes:
        lines.extend(
            [
                f"### {archetype['label']} ({archetype['count']} synthetic profiles)",
                "",
                f"- Strongest trait: {archetype['strongestTrait'][0]} ({archetype['strongestTrait'][1]})",
                f"- Strongest construct: {archetype['strongestConstruct'][0]} ({archetype['strongestConstruct'][1]})",
                "",
            ]
        )
    lines.extend(["## Example synthetic profiles", ""])
    for profile in profiles[:10]:
        lines.extend(
            [
                f"### {profile['id']} - {profile['topProfile']['label']} ({profile['topProfile']['fit']}% fit)",
                "",
                profile["narrative"],
                "",
                "**Top traits**",
                "",
            ]
        )
        for trait, score in sorted(profile["traitScores"].items(), key=lambda item: item[1], reverse=True)[:3]:
            lines.append(f"- {trait}: {score}")
        lines.extend(["", "**Top constructs**", ""])
        for construct, score in sorted(profile["constructScores"].items(), key=lambda item: item[1], reverse=True)[:3]:
            lines.append(f"- {construct}: {score}")
        lines.append("")
    if notes:
        lines.extend(["## Coverage notes", ""])
        for note in notes[:40]:
            lines.append(f"- {note}")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--uploads-dir", help="Directory containing shared_*.xlsx and dict_shared_*.csv files.")
    parser.add_argument("--out-dir", default=".analysis/synthetic-profiles", help="Output directory for JSON/Markdown reports.")
    parser.add_argument("--limit-profiles", type=int, default=25, help="Number of example synthetic profiles to emit.")
    args = parser.parse_args()

    upload_dir = find_upload_dir(args.uploads_dir)
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    resolved, resolve_notes = resolve_measure_columns(upload_dir)
    constructs, evidence, scoring_notes = score_constructs(upload_dir, resolved)
    profiles = build_profiles(constructs, evidence, args.limit_profiles)
    archetypes = summarize_archetypes(profiles)

    payload = {
        "inputDirectory": str(upload_dir),
        "model": "synthetic-open-cognitive-reverse-engineering-v1",
        "generatedProfileCount": len(profiles),
        "availableSyntheticRows": len(constructs),
        "archetypes": archetypes,
        "profiles": profiles,
        "notes": resolve_notes + scoring_notes,
        "guardrails": [
            "Rows are treated as synthetic behavioral records.",
            "Scores are transparent heuristic transformations, not Pymetrics scores.",
            "Do not use as a clinical diagnosis or automated hiring decision.",
            "Do not commit raw uploaded workbooks or participant-level data.",
        ],
    }

    (out_dir / "synthetic-profiles.json").write_text(
        json.dumps(payload, indent=2), encoding="utf-8"
    )
    write_markdown(out_dir / "synthetic-profiles.md", profiles, archetypes, payload["notes"])

    print(f"Read uploads from: {upload_dir}")
    print(f"Resolved measures: {len(resolved)}")
    print(f"Rows with construct coverage: {len(constructs)}")
    print(f"Wrote: {out_dir / 'synthetic-profiles.json'}")
    print(f"Wrote: {out_dir / 'synthetic-profiles.md'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
