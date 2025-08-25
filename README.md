# EdVoice Advisor — AI Voice Course Consultant (No external APIs)

A hackathon-friendly, offline-capable web app that acts as a bilingual (English/Hindi) course consultant. Uses only browser capabilities for ASR and TTS (Web Speech API), no paid APIs.

## Features
- Voice and text chat with interruption (barge-in)
- English and Hindi with Indian-accent voices when available
- Static course catalog with recommendations and details (fees, duration, syllabus, placement)
- Callback scheduler with localStorage and ICS download
- Attractive responsive UI; offline via service worker

## Run locally
No build needed. Use any static server (required for service worker and mic permissions).

```bash
# From /workspace
python3 -m http.server 8080
# then open http://localhost:8080
```

If using a browser preview, open over http:// (not file://).

## Notes
- Speech Recognition and TTS availability differ by browser. Chrome desktop/mobile recommended. Use the language toggle to switch between `en-IN` and `hi-IN`.
- No external APIs used; all data is local in `data/courses.js`.
- Feel free to extend the catalog with your platform's courses.

## License
MIT