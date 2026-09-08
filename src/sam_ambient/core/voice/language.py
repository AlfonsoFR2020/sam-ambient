"""Bounded, deterministic response-language evidence; short text keeps context."""

from functools import lru_cache

from langdetect.detector_factory import PROFILES_DIRECTORY, DetectorFactory
from langdetect.lang_detect_exception import LangDetectException


@lru_cache(maxsize=1)
def _factory() -> DetectorFactory:
    factory = DetectorFactory()
    factory.load_profile(PROFILES_DIRECTORY)
    factory.seed = 0
    return factory


def response_language(text: str, fallback: str = "auto") -> str:
    # Scores aren't calibrated confidence. Require enough prose as well as a
    # decisive classification; identifiers and tiny acknowledgements keep context.
    sample = text[:4000]
    if sum(character.isalpha() for character in sample) < 20:
        return fallback
    detector = _factory().create()
    detector.append(sample)
    try:
        candidates = detector.get_probabilities()
    except LangDetectException:
        return fallback
    if not candidates or candidates[0].prob < 0.80:
        return fallback
    detected = candidates[0].lang
    if fallback.lower().replace("_", "-").split("-")[0] == detected:
        return fallback
    return detected
