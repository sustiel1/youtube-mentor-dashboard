#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""youtube-transcript-api wrapper for YouTube Mentor Dashboard.
Usage: python transcript_api.py <videoId>
Outputs one JSON line to stdout.
"""
import sys
import json


def _format_duration(seconds):
    if not seconds or not isinstance(seconds, (int, float)):
        return None
    s = int(seconds)
    h, rem = divmod(s, 3600)
    m, sec = divmod(rem, 60)
    return f"{h}:{m:02d}:{sec:02d}" if h > 0 else f"{m}:{sec:02d}"


def fetch_metadata(video_id):
    try:
        import yt_dlp
        ydl_opts = {"quiet": True, "no_warnings": True, "skip_download": True}
        url = f"https://www.youtube.com/watch?v={video_id}"
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
        duration_sec = info.get("duration")
        return {
            "viewCount": info.get("view_count"),
            "durationSeconds": duration_sec,
            "durationText": _format_duration(duration_sec),
            "uploader": info.get("uploader") or info.get("channel"),
            "publishDate": info.get("upload_date"),
        }
    except Exception:
        return None


def _seg_field(seg, key, default=None):
    """Read a segment field by attribute (v1.x) or dict key (older)."""
    try:
        return getattr(seg, key)
    except AttributeError:
        pass
    try:
        return seg[key]
    except (KeyError, TypeError):
        return default


def _segments_to_list(data):
    result = []
    for seg in data:
        text = str(_seg_field(seg, "text", "") or "").strip()
        start = _seg_field(seg, "start", 0)
        duration = _seg_field(seg, "duration", 0)
        if text:
            result.append({
                "text": text,
                "startSeconds": float(start or 0),
                "durationSeconds": float(duration or 0),
            })
    return result


def fetch_transcript(video_id):
    try:
        from youtube_transcript_api import YouTubeTranscriptApi
    except ImportError:
        print(json.dumps({
            "success": False,
            "text": "",
            "error": "youtube-transcript-api לא מותקן. הרץ: pip install youtube-transcript-api",
            "source": "youtube-transcript-api",
        }))
        return

    # Error classes moved in v1.x — try both locations
    try:
        from youtube_transcript_api._errors import TranscriptsDisabled, NoTranscriptFound, VideoUnavailable
    except ImportError:
        try:
            from youtube_transcript_api.errors import TranscriptsDisabled, NoTranscriptFound, VideoUnavailable
        except ImportError:
            TranscriptsDisabled = NoTranscriptFound = VideoUnavailable = type("_Never", (Exception,), {})

    try:
        ytt_api = YouTubeTranscriptApi()

        # v1.x uses .list(); older versions used the static .list_transcripts()
        try:
            transcript_list = ytt_api.list(video_id)
        except AttributeError:
            transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)

        transcript = None
        language = None
        is_generated = False

        # Priority: Hebrew manual > Hebrew auto > English manual > English auto
        for langs, generated in [
            (["he", "iw"], False),
            (["he", "iw"], True),
            (["en"], False),
            (["en"], True),
        ]:
            try:
                if generated:
                    transcript = transcript_list.find_generated_transcript(langs)
                else:
                    transcript = transcript_list.find_manually_created_transcript(langs)
                language = langs[0]
                is_generated = generated
                break
            except Exception:
                continue

        if transcript is None:
            # Fallback: let the API pick any available language
            try:
                fetched = ytt_api.fetch(video_id, languages=["he", "iw", "en"])
                segments = _segments_to_list(fetched)
                if segments:
                    fallback_result = {
                        "success": True,
                        "text": " ".join(s["text"] for s in segments),
                        "language": "he",
                        "isGenerated": True,
                        "source": "youtube-transcript-api",
                        "segments": segments,
                    }
                    meta = fetch_metadata(video_id)
                    if meta:
                        fallback_result["metadata"] = meta
                    print(json.dumps(fallback_result))
                    return
            except Exception:
                pass

            print(json.dumps({
                "success": False,
                "text": "",
                "error": "לא נמצא תמלול זמין לסרטון",
                "source": "youtube-transcript-api",
            }))
            return

        segments = _segments_to_list(transcript.fetch())
        result = {
            "success": True,
            "text": " ".join(s["text"] for s in segments),
            "language": language,
            "isGenerated": is_generated,
            "source": "youtube-transcript-api",
            "segments": segments,
        }
        meta = fetch_metadata(video_id)
        if meta:
            result["metadata"] = meta
        print(json.dumps(result))

    except TranscriptsDisabled:
        print(json.dumps({"success": False, "text": "", "error": "תמלול מושבת לסרטון זה", "source": "youtube-transcript-api"}))
    except NoTranscriptFound:
        print(json.dumps({"success": False, "text": "", "error": "לא נמצא תמלול לסרטון", "source": "youtube-transcript-api"}))
    except VideoUnavailable:
        print(json.dumps({"success": False, "text": "", "error": "הסרטון לא זמין או פרטי", "source": "youtube-transcript-api"}))
    except Exception as e:
        err_msg = str(e).lower()
        if "too many requests" in err_msg or "429" in err_msg or "rate" in err_msg:
            error = "YouTube חסם את הבקשה (rate limit) — נסה שוב בעוד כמה דקות"
        else:
            error = f"שגיאה: {str(e)[:200]}"
        print(json.dumps({"success": False, "text": "", "error": error, "source": "youtube-transcript-api"}))


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "text": "", "error": "חסר videoId", "source": "youtube-transcript-api"}))
        sys.exit(1)
    fetch_transcript(sys.argv[1])
