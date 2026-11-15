"""
Thin wrapper around the LLM. Two providers:

  gemini  Google Gemini API (free tier works). Needs GEMINI_API_KEY.
  openai  Any OpenAI-compatible endpoint: OpenAI, Groq, OpenRouter, or a local Ollama
          server (OPENAI_BASE_URL=http://localhost:11434/v1, OPENAI_API_KEY=ollama).

If no key is configured, `llm.available` is False and the GraphRAG engine uses its
rule-based path instead.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any, Dict, List, Optional

import httpx

from backend.config import settings

logger = logging.getLogger("heatshield.llm")

GEMINI_FALLBACK_MODELS = ["gemini-flash-latest", "gemini-3.5-flash", "gemini-3.1-flash-lite"]


class LLMError(RuntimeError):
    pass


class LLM:
    def __init__(self) -> None:
        self._gemini = None
        self._gemini_model: Optional[str] = None

    # ------------------------------------------------------------------ status
    @property
    def provider(self) -> Optional[str]:
        p = settings.LLM_PROVIDER.lower()
        if p == "gemini" and settings.GEMINI_API_KEY:
            return "gemini"
        if p == "openai" and settings.OPENAI_API_KEY:
            return "openai"
        if settings.GEMINI_API_KEY:
            return "gemini"
        if settings.OPENAI_API_KEY:
            return "openai"
        return None

    @property
    def available(self) -> bool:
        return self.provider is not None

    @property
    def model_name(self) -> Optional[str]:
        if self.provider == "gemini":
            return self._gemini_model or settings.GEMINI_MODEL
        if self.provider == "openai":
            return settings.OPENAI_MODEL
        return None

    # -------------------------------------------------------------- generation
    def generate(self, system: str, prompt: str, json_mode: bool = False, temperature: float = 0.1) -> str:
        if self.provider == "gemini":
            return self._gemini_generate(system, prompt, json_mode, temperature)
        if self.provider == "openai":
            return self._openai_generate(system, prompt, json_mode, temperature)
        raise LLMError("No LLM configured. Add GEMINI_API_KEY (or OPENAI_API_KEY) to .env.")

    def generate_json(self, system: str, prompt: str) -> Dict[str, Any]:
        text = self.generate(system, prompt, json_mode=True, temperature=0.0)
        return parse_json(text)

    def _gemini_generate(self, system: str, prompt: str, json_mode: bool, temperature: float) -> str:
        from google import genai
        from google.genai import types

        if self._gemini is None:
            self._gemini = genai.Client(api_key=settings.GEMINI_API_KEY)
        candidates = [self._gemini_model] if self._gemini_model else \
            list(dict.fromkeys([settings.GEMINI_MODEL] + GEMINI_FALLBACK_MODELS))
        config = types.GenerateContentConfig(
            system_instruction=system, temperature=temperature,
            response_mime_type="application/json" if json_mode else "text/plain",
        )
        last: Optional[Exception] = None
        for model in candidates:
            try:
                resp = self._gemini.models.generate_content(model=model, contents=prompt, config=config)
                self._gemini_model = model
                return resp.text or ""
            except Exception as exc:
                last = exc
                msg = str(exc)
                if "404" in msg or "NOT_FOUND" in msg or "not found" in msg.lower():
                    logger.warning("Gemini model %s unavailable, trying next", model)
                    continue
                raise LLMError(_short(msg)) from exc
        raise LLMError(f"No Gemini model worked: {_short(str(last))}")

    def _openai_generate(self, system: str, prompt: str, json_mode: bool, temperature: float) -> str:
        body: Dict[str, Any] = {
            "model": settings.OPENAI_MODEL, "temperature": temperature,
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": prompt}],
        }
        if json_mode:
            body["response_format"] = {"type": "json_object"}
        try:
            r = httpx.post(f"{settings.OPENAI_BASE_URL.rstrip('/')}/chat/completions", json=body, timeout=60,
                           headers={"Authorization": f"Bearer {settings.OPENAI_API_KEY}"})
            r.raise_for_status()
            return r.json()["choices"][0]["message"]["content"]
        except Exception as exc:
            raise LLMError(_short(str(exc))) from exc


def parse_json(text: str) -> Dict[str, Any]:
    text = text.strip()
    fence = re.search(r"```(?:json)?\s*(.*?)```", text, re.S)
    if fence:
        text = fence.group(1)
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end == -1:
        raise LLMError("LLM did not return JSON.")
    return json.loads(text[start:end + 1])


def _short(msg: str) -> str:
    return msg.strip().splitlines()[0][:300] if msg.strip() else "unknown error"


llm = LLM()
