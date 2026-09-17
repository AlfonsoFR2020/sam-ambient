# Sam 0.2.1 alpha release notes

Sam 0.2.1 is a focused stabilization patch for the Windows-first public alpha.

## What changed

- Visual Engine polish: a quieter halo, wider and more elevated peels, working
  drag/flick and rotation speed, visible gold orbital particles, effective bounded
  quality/density controls, contained help popovers, and corrected renderer/fallback
  lifecycle semantics.
- Voice reliability: response-monitor teardown now accepts authoritative playback
  completion reaching `IDLE`, and every initial STT candidate has a bounded
  24-second finalization lifecycle even under dense VAD-positive noise.
- Portability: Sam remains importable and text-capable without PortAudio, and shared
  test helpers resolve consistently on hosted Windows.
- Setup guidance: the LM Studio documentation now covers both app and CLI paths for
  loading an installed model, starting the localhost server and verifying readiness.
- Design record: future audio-reactive visual embodiment and diagnostics now have a
  constrained feature/mapping direction and required staged design checkpoints.

## Known limitations

Text interaction remains the recommended path. Voice is experimental and still needs
physical acoustic acceptance; language drift/noise hallucination risk, mute semantics,
transcript/history behavior and session-resume policy remain open. Human visual and
native acceptance also remain deferred.

Windows is the validated 0.2.1 alpha path. Hosted Ubuntu currently reaches Python
tests but has an unresolved Linux-only failure, so its dependent package-smoke job is
skipped. This is recorded deferred work for a potential 0.3.0+ Linux compatibility
review; CI has not been weakened or marked green artificially.

The exact versioned release-preparation commit must pass the hosted Windows quality,
native-package and package-smoke gates before publication.

The release preparation does not include a signed Windows installer, model bundle,
cloud speech service, automatic model download, AEC, or implementation of the newly
documented audio-reactive visual direction.
