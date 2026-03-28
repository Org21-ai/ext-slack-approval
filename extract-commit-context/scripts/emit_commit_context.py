#!/usr/bin/env python3
"""
Emit commitShortSha and commitContextMessage to GITHUB_OUTPUT.
Keep logic aligned with extractCommitContext() + ellipsize() in src/index.ts.
"""
import json
import os
import re


def ellipsize(text: str, max_len: int = 300) -> str:
    if len(text) <= max_len:
        return text
    return text[: max_len - 3] + "..."


def main() -> None:
    sha = os.environ.get("GITHUB_SHA", "") or ""
    short_sha = sha[:7] if sha else ""
    message = ""
    event_path = os.environ.get("GITHUB_EVENT_PATH", "") or ""

    if event_path and os.path.isfile(event_path):
        try:
            with open(event_path, encoding="utf-8") as f:
                event = json.load(f)
            head = event.get("head_commit") or {}
            if isinstance(head.get("message"), str):
                message = head["message"]
            pr = event.get("pull_request") or {}
            if isinstance(pr.get("title"), str):
                title = pr["title"]
                body = pr.get("body")
                body_str = body if isinstance(body, str) else ""
                message = f"{title} - {body_str}" if body_str else title
        except (OSError, json.JSONDecodeError):
            pass

    message = ellipsize(re.sub(r"\s+", " ", message).strip())

    out = os.environ.get("GITHUB_OUTPUT")
    if not out:
        print("commitShortSha=", short_sha, sep="")
        print("commitContextMessage=", message, sep="")
        return

    with open(out, "a", encoding="utf-8") as fh:
        fh.write(f"commitShortSha={short_sha}\n")
        if "\n" in message:
            fh.write("commitContextMessage<<COMMIT_CTX_EOF\n")
            fh.write(message + "\n")
            fh.write("COMMIT_CTX_EOF\n")
        else:
            fh.write(f"commitContextMessage={message}\n")


if __name__ == "__main__":
    main()
