/** Future graphical pass only. Importing scene data does not construct a renderer. */
import { INITIAL_UI_STATE, type UiState } from "../../src/protocol/types";
import { VisualInputAdapter } from "../../src/visual-engine/input";
import { MotionEvaluator } from "../../src/visual-engine/motion";
import { RENDER_BUDGETS } from "../../src/visual-engine/quality";
import { DEFAULT_VISUAL_ENGINE_SETTINGS } from "../../src/visual-engine/types";

export const PRESENCE_SEED = 0x5a17;
const ready: UiState = {
  ...INITIAL_UI_STATE,
  connection: "connected",
  sessionId: "fixture",
  provider: "local",
  model: "fixture-chat",
  conversationalState: "IDLE",
  startupLifecycle: "ready_transition",
  providerDiscovery: { status: "available" },
};
const committed: UiState = {
  ...ready,
  turnId: "turn",
  generationId: "generation",
  transcript: [
    {
      id: "synthetic-user",
      role: "user",
      text: "Synthetic fixture request",
      interrupted: false,
      monotonicMs: 1,
      turnId: "turn",
      generationId: "generation",
    },
  ],
};
const loading: UiState = {
  ...ready,
  model: undefined,
  pendingModel: "fixture-chat",
  startupLifecycle: "loading_model",
  providerDiscovery: { status: "scanning" },
};
export const PRESENCE_SCENES = [
  { name: "formation-0", state: INITIAL_UI_STATE, seconds: 0 },
  { name: "formation-04", state: INITIAL_UI_STATE, seconds: 0.4 },
  { name: "formation-12", state: INITIAL_UI_STATE, seconds: 1.2 },
  { name: "loading-6", state: loading, seconds: 6 },
  { name: "loading-30", state: loading, seconds: 30 },
  { name: "idle", state: ready, seconds: 6 },
  { name: "sending", state: { ...ready, pendingUserMessageId: "typed" }, seconds: 6 },
  { name: "committed", state: committed, seconds: 6 },
  { name: "thinking", state: { ...committed, conversationalState: "THINKING" }, seconds: 6 },
  {
    name: "responding",
    state: {
      ...committed,
      provisionalTranscript: {
        role: "assistant",
        text: "Synthetic response",
        monotonicMs: 10,
      },
    },
    seconds: 6,
  },
  {
    name: "speech-preparation",
    state: {
      ...committed,
      conversationalState: "SPEAKING",
      playbackGenerationId: "generation",
      lastMonotonicByType: { "tts.started": 10 },
    },
    seconds: 6,
  },
  {
    name: "synthetic-speech",
    state: {
      ...committed,
      conversationalState: "SPEAKING",
      playbackGenerationId: "generation",
      lastMonotonicByType: { "tts.started": 10 },
    },
    seconds: 6,
    speech: true,
  },
  {
    name: "unloading",
    state: {
      ...ready,
      startupLifecycle: "unloading_model",
      providerDiscovery: { status: "scanning" },
    },
    seconds: 6,
  },
  {
    name: "unloaded",
    state: {
      ...ready,
      model: undefined,
      startupLifecycle: "blocked",
      providerDiscovery: { status: "available", modelUnloaded: true },
    },
    seconds: 6,
  },
  { name: "recovering", state: { ...ready, conversationalState: "INTERRUPTED" }, seconds: 6 },
  { name: "failed", state: { ...ready, conversationalState: "ERROR" }, seconds: 6 },
  { name: "departure-0", state: { ...ready, applicationStopped: true }, seconds: 0 },
  { name: "departure-08", state: { ...ready, applicationStopped: true }, seconds: 0.8 },
] satisfies readonly { name: string; state: UiState; seconds: number; speech?: boolean }[];

export function presenceFixtureFrame(
  scene: (typeof PRESENCE_SCENES)[number],
  reduced = false,
  zero = false,
) {
  const evaluator = new MotionEvaluator(PRESENCE_SEED),
    adapter = new VisualInputAdapter();
  const settings = {
    ...DEFAULT_VISUAL_ENGINE_SETTINGS,
    reducedMotion: reduced ? ("on" as const) : ("off" as const),
    audioReactivity: zero ? 0 : DEFAULT_VISUAL_ENGINE_SETTINGS.audioReactivity,
  };
  let frame = evaluator.currentFrame;
  for (let now = 0; now <= scene.seconds * 1000; now += 20) {
    const state: UiState =
      "speech" in scene && scene.speech
        ? {
            ...scene.state,
            lastMonotonicByType: { "tts.started": 10, "tts.level": 100 + now },
            // Explicit synthetic stepped PCM-equivalent RMS, including a silent pause.
            metrics: {
              ...scene.state.metrics,
              playbackEnvelope:
                now >= 2000 && now < 3000 ? 0 : now >= 3000 ? 700 / 32768 : 4000 / 32768,
            },
          }
        : scene.state;
    frame = evaluator.evaluate(adapter.ingest(state, now), now, settings, RENDER_BUDGETS.high);
  }
  return { ...frame, reactivity: { ...frame.reactivity } };
}

export async function captureResponsivePresence() {
  const api = await import("./visual-identity-II");
  const shots: { name: string; image: string }[] = [];
  for (const scene of PRESENCE_SCENES) {
    const f = api.fixture("high");
    try {
      shots.push({ name: scene.name, image: f.draw(presenceFixtureFrame(scene), 0.75) });
    } finally {
      f.close();
    }
  }
  const speech = PRESENCE_SCENES.find((scene) => scene.name === "synthetic-speech");
  if (!speech) throw new Error("Synthetic speech fixture missing");
  for (const quality of ["low", "medium", "high"] as const) {
    for (const mode of ["normal", "zero", "reduced"] as const) {
      const f = api.fixture(quality);
      try {
        shots.push({
          name: `${quality}-${mode}`,
          image: f.draw(presenceFixtureFrame(speech, mode === "reduced", mode === "zero"), 0.75),
        });
      } finally {
        f.close();
      }
    }
  }
  return {
    shots,
    metadata: {
      seed: PRESENCE_SEED,
      yaw: 0.75,
      size: 720,
      dpr: 1,
      states: PRESENCE_SCENES.map(({ name, seconds }) => ({ name, seconds })),
      limitation:
        "Synthetic fixtures, pending execution. GPU images do not prove physical playback or owner acceptance.",
    },
  };
}
