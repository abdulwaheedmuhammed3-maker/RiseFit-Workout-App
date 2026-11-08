# RiseFit — Smart Fitness, Workout Alarm & Live Exercise Verification

RiseFit is an Android-first fitness app concept that combines a wake-up workout alarm with a separate guided workout library.

## Current web foundation
- React + TypeScript + Vite
- Responsive dark interface with lime accents
- Overview, alarm preview, workout plans, exercise library, individual exercise details, progress view
- Guided session flow with manually logged reps/seconds, rounds, and completion state
- GitHub Actions build workflow

## Roadmap
1. Validate web build and UI foundation
2. Add Capacitor Android shell
3. Implement reliable Android alarm scheduling, permissions, boot recovery and full-screen alarm experience
4. Add live camera exercise form/rep detection
5. Persist workout settings and progress locally

**Important:** Alarm screen controls are currently interface previews; they do not trigger an actual Android alarm. Rep counting in the current guided session is manually logged and is not camera-verified. Native Android integration and device testing are required for those features.

## Run locally
```bash
npm install
npm run dev
```

Build:
```bash
npm run build
```
