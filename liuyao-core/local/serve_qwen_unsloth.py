"""Serve a local Qwen model, loaded with unsloth, as an OpenAI-style chat endpoint.

The reading pipeline talks to a chat-completions endpoint, so this file puts one
in front of the model:  POST /v1/chat/completions  (the same shape as OpenRouter).

Start it (on the machine with the GPU):

    pip install unsloth
    QWEN_MODEL=<path or Hugging Face id of the Qwen model> python3 local/serve_qwen_unsloth.py --port 8000

Then point the reading at it (see local/README.md):

    LOCAL_LLM_BASE_URL=http://127.0.0.1:8000/v1 LOCAL_MODEL=<same name> node scripts/ask.mjs --local ...

Qwen3 can think before it answers. Thinking is switched off in the chat template,
and any <think>…</think> block that still appears is removed, so the JSON the
program checks is the only text returned.
"""
import argparse
import json
import os
import re
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

THINK = re.compile(r"<think>.*?</think>\s*", re.S)


def clean(text):
    return THINK.sub("", text).strip()


def make_handler(generate, model_name, lock):
    """generate(messages, max_tokens, temperature) -> str. One request at a time: the GPU runs one."""

    class Handler(BaseHTTPRequestHandler):
        def do_POST(self):
            if self.path.rstrip("/") != "/v1/chat/completions":
                return self._send(404, {"error": {"message": "not found"}})
            length = int(self.headers.get("content-length", 0) or 0)
            try:
                body = json.loads(self.rfile.read(length) or b"{}")
            except ValueError:
                return self._send(400, {"error": {"message": "body is not JSON"}})
            messages = body.get("messages") or []
            if not messages:
                return self._send(400, {"error": {"message": "messages is empty"}})
            max_tokens = int(body.get("max_tokens") or 1024)
            temperature = float(body.get("temperature", 0.3))
            with lock:
                text = generate(messages, max_tokens, temperature)
            self._send(200, {
                "id": "local",
                "object": "chat.completion",
                "model": model_name,
                "choices": [{"index": 0, "message": {"role": "assistant", "content": clean(text)}, "finish_reason": "stop"}],
            })

        def _send(self, code, obj):
            data = json.dumps(obj, ensure_ascii=False).encode("utf-8")
            self.send_response(code)
            self.send_header("content-type", "application/json")
            self.send_header("content-length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def log_message(self, *args):
            pass

    return Handler


def load_unsloth_model(model_path, max_seq_length=int(os.environ.get("LOCAL_MAX_SEQ", "16384"))):
    """Loads the Qwen model with unsloth in 4-bit, ready for inference."""
    from unsloth import FastLanguageModel

    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=model_path,
        max_seq_length=max_seq_length,
        load_in_4bit=True,
    )
    FastLanguageModel.for_inference(model)

    def generate(messages, max_tokens, temperature):
        prompt = tokenizer.apply_chat_template(
            messages, tokenize=False, add_generation_prompt=True, enable_thinking=False
        )
        inputs = tokenizer(prompt, return_tensors="pt").to(model.device)
        out = model.generate(
            **inputs,
            max_new_tokens=max_tokens,
            do_sample=temperature > 0,
            temperature=max(temperature, 1e-5),
            top_p=0.9,
        )
        new_tokens = out[0][inputs["input_ids"].shape[1]:]
        return tokenizer.decode(new_tokens, skip_special_tokens=True)

    return generate


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()
    model_path = os.environ.get("QWEN_MODEL")
    if not model_path:
        raise SystemExit("set QWEN_MODEL to the Qwen model path or Hugging Face id")
    # The prompts (packet, claims, and the synthesis that carries them) need a long window.
    generate = load_unsloth_model(model_path)
    handler = make_handler(generate, model_path, threading.Lock())
    server = ThreadingHTTPServer((args.host, args.port), handler)
    print(f"ready: http://{args.host}:{args.port}/v1  model={model_path}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
