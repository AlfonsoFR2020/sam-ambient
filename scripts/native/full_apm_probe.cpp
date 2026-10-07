// Sam-authored offline C ABI. No device access, dump writer or runtime integration.
#include <array>
#include <algorithm>
#include <cstdint>
#include <cmath>
#include <limits>
#include <new>

#include "api/audio/audio_processing.h"
#include "api/audio/builtin_audio_processing_builder.h"
#include "api/environment/environment_factory.h"

namespace {
constexpr uint32_t kSamples = 160;
struct Processor {
  webrtc::scoped_refptr<webrtc::AudioProcessing> apm;
  webrtc::StreamConfig stream{16000, 1};
  bool linear_output = false;
};
}

extern "C" {
__declspec(dllexport) int sam_apm_create(void** result, int mode) noexcept {
  if (!result || mode < 0 || mode > 3) return -900;
  *result = nullptr;
  try {
    webrtc::AudioProcessing::Config config;
    config.echo_canceller.enabled = mode != 2;
    config.echo_canceller.enforce_high_pass_filtering = mode == 0;
    config.echo_canceller.export_linear_aec_output = mode == 3;
    // Mode 0 is upstream AEC default; 1 disables its forced input high-pass;
    // 2 is bypass; 3 diagnoses linear AEC output, without its suppressor.
    // No gain boost, suppressor tuning or DSP source edit.
    config.gain_controller1.enabled = false;
    config.gain_controller2.enabled = false;
    config.noise_suppression.enabled = false;
    config.high_pass_filter.enabled = false;
    auto* processor = new Processor;
    processor->linear_output = mode == 3;
    try {
      webrtc::BuiltinAudioProcessingBuilder builder(config);
      if (processor->linear_output) {
        webrtc::EchoCanceller3Config aec_config;
        aec_config.filter.export_linear_aec_output = true;
        builder.SetEchoCancellerConfig(aec_config, std::nullopt);
      }
      processor->apm = builder.Build(webrtc::CreateEnvironment());
      if (!processor->apm) { delete processor; return -901; }
    } catch (...) { delete processor; throw; }
    *result = processor;
    return 0;
  } catch (...) { return -902; }
}

__declspec(dllexport) void sam_apm_close(void* handle) noexcept {
  delete static_cast<Processor*>(handle);
}

__declspec(dllexport) int sam_apm_render(
    void* handle, const int16_t* frame, uint32_t samples) noexcept {
  if (!handle || !frame || samples != kSamples) return -900;
  try {
    auto& processor = *static_cast<Processor*>(handle);
    std::array<int16_t, kSamples> unused{};
    return processor.apm->ProcessReverseStream(frame, processor.stream,
                                             processor.stream, unused.data());
  } catch (...) { return -902; }
}

__declspec(dllexport) int sam_apm_capture(
    void* handle, const int16_t* frame, int16_t* output,
    uint32_t samples, int delay_ms) noexcept {
  if (!handle || !frame || !output || samples != kSamples ||
      delay_ms < 0 || delay_ms > 250) return -900;
  try {
    auto& processor = *static_cast<Processor*>(handle);
    int status = processor.apm->set_stream_delay_ms(delay_ms);
    if (status != 0) return status;
    // Upstream's disabled int16 pipeline may leave dest untouched. In-place
    // input/output follows its documented API and makes bypass a valid control.
    std::copy_n(frame, kSamples, output);
    status = processor.apm->ProcessStream(output, processor.stream,
                                         processor.stream, output);
    if (status != 0 || !processor.linear_output) return status;
    std::array<std::array<float, kSamples>, 1> linear{};
    if (!processor.apm->GetLinearAecOutput(linear)) return -903;
    for (uint32_t i = 0; i < kSamples; ++i) {
      output[i] = static_cast<int16_t>(std::lround(
          std::clamp(linear[0][i] * 32768.0f, -32768.0f, 32767.0f)));
    }
    return 0;
  } catch (...) { return -902; }
}

// Missing optional upstream metrics are NaN, never a human-origin verdict.
__declspec(dllexport) int sam_apm_stats(void* handle, double* values) noexcept {
  if (!handle || !values) return -900;
  try {
    auto stats = static_cast<Processor*>(handle)->apm->GetStatistics();
    const double missing = std::numeric_limits<double>::quiet_NaN();
    values[0] = stats.echo_return_loss_enhancement.value_or(missing);
    values[1] = stats.residual_echo_likelihood.value_or(missing);
    values[2] = stats.delay_ms ? static_cast<double>(*stats.delay_ms) : missing;
    return 0;
  } catch (...) { return -902; }
}
}
