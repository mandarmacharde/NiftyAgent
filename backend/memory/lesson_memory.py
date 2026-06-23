import json
from pathlib import Path


LESSONS_FILE = Path(__file__).resolve().parent / "lessons.json"


class LessonMemoryError(Exception):
    pass


class InvalidLessonDataError(LessonMemoryError):
    pass


def _read_lessons():
    if not LESSONS_FILE.exists():
        return []

    try:
        with LESSONS_FILE.open("r", encoding="utf-8") as file:
            lessons = json.load(file)
    except json.JSONDecodeError as exc:
        raise InvalidLessonDataError("lessons.json contains invalid JSON") from exc

    if not isinstance(lessons, list):
        raise InvalidLessonDataError("lessons.json must contain a list of lessons")

    return lessons


def _write_lessons(lessons):
    LESSONS_FILE.parent.mkdir(parents=True, exist_ok=True)

    with LESSONS_FILE.open("w", encoding="utf-8") as file:
        json.dump(lessons, file, indent=4)


def save_lesson(lesson):
    _validate_lesson(lesson)
    lessons = _read_lessons()
    lessons.append(lesson)
    _write_lessons(lessons)
    return lesson


def get_lessons():
    return _read_lessons()


def get_lesson_performance():
    performance = {}

    for lesson in _read_lessons():
        _validate_lesson(lesson)
        lesson_type = lesson["lesson_type"]

        if lesson_type not in performance:
            performance[lesson_type] = {
                "wins": 0,
                "losses": 0
            }

        if lesson["result"] == "success":
            performance[lesson_type]["wins"] += 1
        else:
            performance[lesson_type]["losses"] += 1

    return performance


def get_best_and_worst_setup():
    performance = get_lesson_performance()

    if not performance:
        return None, None

    ranked = sorted(
        performance.items(),
        key=lambda item: _setup_win_rate(item[1]),
        reverse=True
    )

    return _format_setup(ranked[0]), _format_setup(ranked[-1])


def _setup_win_rate(setup):
    total = setup["wins"] + setup["losses"]
    return setup["wins"] / total if total else 0


def _format_setup(item):
    lesson_type, results = item
    total = results["wins"] + results["losses"]

    return {
        "lesson_type": lesson_type,
        "wins": results["wins"],
        "losses": results["losses"],
        "win_rate": round((results["wins"] / total) * 100, 2) if total else 0
    }


def _validate_lesson(lesson):
    if not isinstance(lesson, dict):
        raise InvalidLessonDataError("Lesson must be an object")

    for field in ("lesson_type", "result", "confidence", "pnl"):
        if field not in lesson:
            raise InvalidLessonDataError(f"Lesson is missing {field}")

    if lesson["result"] not in {"success", "failure"}:
        raise InvalidLessonDataError("Lesson result must be success or failure")
