#!/usr/bin/env python3
"""Embed JSON rows with a local SentenceTransformers model.

Input on stdin:
{"rows": [{"id": "1", "text": "..."}]}

Output on stdout:
{"embeddings": [{"id": "1", "embedding": [...]}]}
"""

from __future__ import annotations

import argparse
import json
import sys


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="SentenceTransformers embedding bridge")
    parser.add_argument("--model", required=True)
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--cache-dir", default=None)
    parser.add_argument("--device", default=None)
    parser.add_argument("--trust-remote-code", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        from sentence_transformers import SentenceTransformer
    except ImportError as exc:
        print(
            "sentence_transformers is required for --provider huggingface. "
            "Install it in the selected --python-bin environment.",
            file=sys.stderr,
        )
        raise SystemExit(2) from exc

    payload = json.load(sys.stdin)
    rows = payload.get("rows") or []
    texts = [str(row.get("text") or "") for row in rows]
    model_kwargs = {}
    if args.device:
        model_kwargs["device"] = args.device
    if args.cache_dir:
        model_kwargs["cache_folder"] = args.cache_dir
    if args.trust_remote_code:
        model_kwargs["trust_remote_code"] = True

    model = SentenceTransformer(args.model, **model_kwargs)
    embeddings = model.encode(
        texts,
        batch_size=max(1, args.batch_size),
        normalize_embeddings=True,
        convert_to_numpy=True,
        show_progress_bar=False,
    )

    output = {
        "embeddings": [
            {
                "id": row.get("id"),
                "embedding": [round(float(value), 8) for value in embedding.tolist()],
            }
            for row, embedding in zip(rows, embeddings, strict=True)
        ]
    }
    json.dump(output, sys.stdout)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
