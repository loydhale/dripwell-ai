# TASK-005 — Photo capture with AR guidance (F-3)

```
TASK_ID: TASK-005
TITLE: Photo capture with AR guidance
PARENT_REQUEST: PRD requires standardized photo capture with AR overlays for positioning and lighting. Photos upload directly, never stored on device.

GOAL (one sentence):
Build the tablet photo capture interface with AR guidance overlays, direct upload to backend, and support for multiple required angles.

SCOPE:
In scope:
- Camera access via getUserMedia API
- AR overlay showing: face positioning guide, lighting indicator, capture button
- Support for 4 required angles: face (front), under-eyes (close-up), back of hand/forearm, tongue (optional)
- Real-time preview with overlay graphics
- Capture photo and immediately upload to backend (POST /assessments/:id/photos)
- No local storage — image data never saved to device
- Show upload progress and confirmation
- Provider can retake if needed
- Responsive for tablet (primary) and desktop

Out of scope (do NOT do these even if tempting):
- Do NOT implement vision AI analysis (that's TASK-006)
- Do NOT store photos locally or in browser cache
- Do NOT add filters, editing, or enhancement
- Do NOT support video recording
- Do NOT add 3D face mesh or advanced AR (keep it simple 2D overlays)

FILES LIKELY INVOLVED:
- apps/web/src/components/CameraCapture.ts — main camera component
- apps/web/src/components/ARGuideOverlay.ts — AR overlay graphics
- apps/web/src/pages/AssessmentFlow.ts — assessment flow page (or update existing)
- apps/web/src/lib/camera.ts — camera utilities
- apps/web/src/lib/upload.ts — upload helpers
- apps/web/src/styles/camera.css — camera-specific styles
- apps/api/src/routes/assessments.ts — add photo upload endpoint
- apps/api/src/lib/storage.ts — photo storage abstraction (S3 placeholder)

RELEVANT MEMORY ENTRIES:
- PRD F-3: Photo capture with AR guidance, direct upload
- PRD F-4: Vision AI signal extraction (depends on photos)
- LESSONS: L-003 (innerHTML LCP overhead)
- PATTERNS: P-001 — branded ID types

ACCEPTANCE CRITERIA (Auditor will check these):
- [ ] Camera opens and shows live preview
- [ ] AR overlay displays positioning guide for each angle
- [ ] Capture button works and takes photo
- [ ] Photo uploads immediately to backend (no local storage)
- [ ] Upload progress shown to provider
- [ ] Success confirmation after upload
- [ ] Provider can retake photo before proceeding
- [ ] All 4 angles supported: face, under-eyes, hand, tongue
- [ ] Works on iPad Safari and Chrome tablet
- [ ] Graceful fallback if camera permission denied
- [ ] Photos encrypted in transit (HTTPS)

NOTES / HINTS:
- Use getUserMedia with facingMode: "user" for front camera
- Canvas API for capturing frame from video stream
- Overlay graphics: simple CSS/SVG positioning guides (circle for face, rectangle for under-eyes, etc.)
- Lighting indicator: analyze brightness histogram from canvas
- Upload via fetch with FormData
- Backend endpoint should accept multipart/form-data
- Store image metadata in DB (url, angle, capturedAt), actual image in S3 (placeholder for now)
- The assessment flow starts with patient intake (F-2), then photo capture (F-3), then AI analysis (F-4)
- Keep the UI clean and clinical — no flashy effects
```
