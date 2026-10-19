#!/bin/bash
# macOS launcher: double-click in Finder. First run builds a private environment (needs Python 3.9+ with Tk).
cd "$(dirname "$0")" || exit 1
if [ ! -x ".venv/bin/python" ]; then
  echo "First run: setting things up, this takes a minute..."
  PY="$(command -v python3)"
  if [ -z "$PY" ]; then
    echo "Python 3 was not found. Install it from https://www.python.org/downloads/macos/ (it includes Tk), then run this again."
    read -n 1 -s -r -p "Press any key to close"; exit 1
  fi
  "$PY" -m venv .venv || { read -n 1 -s -r -p "venv failed. Press any key to close"; exit 1; }
  .venv/bin/python -m pip install --upgrade pip
  .venv/bin/python -m pip install -r requirements.txt || { read -n 1 -s -r -p "Install failed, see above. Press any key to close"; exit 1; }
fi
if ! .venv/bin/python -c "import tkinter" 2>/dev/null; then
  echo "This Python has no Tk. Use the installer from python.org, or: brew install python-tk"
  read -n 1 -s -r -p "Press any key to close"; exit 1
fi
exec .venv/bin/python app.py "$@"
