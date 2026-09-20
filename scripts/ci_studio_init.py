#!/usr/bin/env python3
"""Drive `genlayer init` without hanging on inquirer prompts.

The CLI always asks:
  1. Confirm docker/db reset (Y/n)
  2. LLM provider checkbox (space to select, enter to submit)
  3. Provider API key

Sending space+enter in one packet submits an empty checkbox, then
createRandomValidators fails with "No providers available".
"""
from __future__ import annotations

import errno
import os
import pty
import select
import sys
import time

CMD = ["genlayer", "init", "--headless", "--numValidators", "3"]
DEADLINE_SEC = 700


def _send(fd: int, data: str) -> None:
    os.write(fd, data.encode("utf-8"))


def main() -> int:
    api_key = (os.environ.get("OPENAI_API_KEY") or "").strip()
    if not api_key:
        print(
            "OPENAI_API_KEY is not set; cannot create Studio validators.",
            file=sys.stderr,
        )
        return 2

    pid, fd = pty.fork()
    if pid == 0:
        os.execvp(CMD[0], CMD)

    buf = b""
    state = "confirm"
    deadline = time.time() + DEADLINE_SEC
    exit_code: int | None = None

    try:
        while time.time() < deadline:
            ready, _, _ = select.select([fd], [], [], 0.4)
            if ready:
                try:
                    chunk = os.read(fd, 8192)
                except OSError as exc:
                    if exc.errno == errno.EIO:
                        break
                    raise
                if not chunk:
                    break
                sys.stdout.buffer.write(chunk)
                sys.stdout.buffer.flush()
                buf += chunk

            text = buf.decode("utf-8", "replace")
            low = text.lower()

            if state == "confirm" and "continue" in low:
                time.sleep(0.4)
                _send(fd, "y\r")
                state = "llm"
                buf = b""
            elif state in {"confirm", "llm"} and "llm providers" in low:
                # Wait for the checkbox to finish rendering, then select
                # the first option (OpenAI) before submitting.
                time.sleep(1.2)
                _send(fd, " ")
                time.sleep(0.8)
                _send(fd, "\r")
                state = "key"
                buf = b""
            elif state == "key" and "api key" in low:
                time.sleep(0.4)
                _send(fd, api_key + "\r")
                state = "running"
                buf = b""

            try:
                waited, status = os.waitpid(pid, os.WNOHANG)
            except ChildProcessError:
                break
            if waited == pid:
                exit_code = os.waitstatus_to_exitcode(status)
                break
        else:
            print("Timed out waiting for genlayer init.", file=sys.stderr)
            try:
                os.kill(pid, 9)
                os.waitpid(pid, 0)
            except OSError:
                pass
            return 1
    finally:
        try:
            os.close(fd)
        except OSError:
            pass

    return 0 if exit_code is None else exit_code


if __name__ == "__main__":
    raise SystemExit(main())
