"""Checks the endpoint's shape without a GPU: a fake generate stands in for the model.
Run: python3 local/test_server.py   (the node contract local-server.mjs runs it)"""
import json
import os
import sys
import threading
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from serve_qwen_unsloth import make_handler  # noqa: E402

seen = {}


def fake_generate(messages, max_tokens, temperature):
    seen.update(messages=messages, max_tokens=max_tokens, temperature=temperature)
    return "<think>内部想法</think>\n{\"ok\": true}"


server = ThreadingHTTPServer(("127.0.0.1", 0), make_handler(fake_generate, "fake-qwen", threading.Lock()))
port = server.server_address[1]
threading.Thread(target=server.serve_forever, daemon=True).start()
base = f"http://127.0.0.1:{port}"


def post(path, body, raw=None):
    data = raw if raw is not None else json.dumps(body).encode()
    req = urllib.request.Request(base + path, data=data, headers={"content-type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())


status, out = post("/v1/chat/completions", {
    "model": "fake-qwen", "max_tokens": 77, "temperature": 0.2,
    "messages": [{"role": "system", "content": "S"}, {"role": "user", "content": "U"}],
})
assert status == 200
assert out["choices"][0]["message"] == {"role": "assistant", "content": "{\"ok\": true}"}, "thinking is removed"
assert seen["max_tokens"] == 77 and seen["temperature"] == 0.2
assert seen["messages"][1]["content"] == "U"

assert post("/v1/chat/completions", {"messages": []})[0] == 400
assert post("/v1/chat/completions", None, raw=b"not json")[0] == 400
assert post("/v1/other", {"messages": [{"role": "user", "content": "x"}]})[0] == 404

server.shutdown()
print("local-server: ok — chat endpoint shape, thinking removed, options passed through, bad requests refused")
