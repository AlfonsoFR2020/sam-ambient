// Sam-authored offline probe, not a production adapter. Windows SDK interfaces
// only; no source from a DSP implementation is copied or bundled.
#define NOMINMAX
#include <windows.h>
#include <dmo.h>
#include <uuids.h>
#include <wmcodecdsp.h>
#include <propsys.h>
#include <wrl/client.h>
#include <atomic>
#include <cstring>
#include <new>
#include <vector>

using Microsoft::WRL::ComPtr;
constexpr DWORD kFrameBytes = 320;
constexpr REFERENCE_TIME kFrameTime = 100000; // 10 ms in 100 ns units.

class Buffer final : public IMediaBuffer {
    std::atomic<ULONG> refs_{1};
    std::vector<BYTE> data_;
    DWORD length_ = 0;
public:
    explicit Buffer(DWORD capacity) : data_(capacity) {}
    HRESULT STDMETHODCALLTYPE QueryInterface(REFIID iid, void** out) override {
        if (!out) return E_POINTER;
        *out = nullptr;
        if (iid != IID_IUnknown && iid != __uuidof(IMediaBuffer)) return E_NOINTERFACE;
        *out = static_cast<IMediaBuffer*>(this); AddRef(); return S_OK;
    }
    ULONG STDMETHODCALLTYPE AddRef() override { return ++refs_; }
    ULONG STDMETHODCALLTYPE Release() override {
        ULONG count = --refs_; if (!count) delete this; return count;
    }
    HRESULT STDMETHODCALLTYPE SetLength(DWORD length) override {
        if (length > data_.size()) return E_INVALIDARG;
        length_ = length; return S_OK;
    }
    HRESULT STDMETHODCALLTYPE GetMaxLength(DWORD* length) override {
        if (!length) return E_POINTER;
        *length = static_cast<DWORD>(data_.size()); return S_OK;
    }
    HRESULT STDMETHODCALLTYPE GetBufferAndLength(BYTE** data, DWORD* length) override {
        if (data) *data = data_.data();
        if (length) *length = length_;
        return S_OK;
    }
    void assign(const BYTE* data) { std::memcpy(data_.data(), data, kFrameBytes); length_ = kFrameBytes; }
};

struct Processor {
    ComPtr<IMediaObject> dmo;
    bool initialized = false;
    REFERENCE_TIME time = 0;
    ~Processor() { dmo.Reset(); if (initialized) CoUninitialize(); }
};

HRESULT property(IPropertyStore* store, const PROPERTYKEY& key, LONG value, bool boolean = false) {
    PROPVARIANT prop{};
    prop.vt = static_cast<VARTYPE>(boolean ? VT_BOOL : VT_I4);
    if (boolean) prop.boolVal = value ? VARIANT_TRUE : VARIANT_FALSE;
    else prop.lVal = value;
    return store->SetValue(key, prop);
}

HRESULT media_type(IMediaObject* dmo, DWORD stream, bool output) {
    DMO_MEDIA_TYPE type{};
    HRESULT hr = MoInitMediaType(&type, sizeof(WAVEFORMATEX));
    if (FAILED(hr)) return hr;
    type.majortype = MEDIATYPE_Audio; type.subtype = MEDIASUBTYPE_PCM;
    type.bFixedSizeSamples = TRUE; type.lSampleSize = 2;
    type.formattype = FORMAT_WaveFormatEx;
    auto* format = reinterpret_cast<WAVEFORMATEX*>(type.pbFormat);
    *format = {WAVE_FORMAT_PCM, 1, 16000, 32000, 2, 16, 0};
    hr = output ? dmo->SetOutputType(0, &type, 0) : dmo->SetInputType(stream, &type, 0);
    MoFreeMediaType(&type); return hr;
}

extern "C" __declspec(dllexport) HRESULT sam_aec_create(LONG suppression, void** result, DWORD* stage) noexcept {
    if (!result || !stage) return E_POINTER;
    if (suppression < 0 || suppression > 2) return E_INVALIDARG;
    *result = nullptr;
    auto* processor = new (std::nothrow) Processor;
    if (!processor) return E_OUTOFMEMORY;
    *stage = 1;
    HRESULT hr = CoInitializeEx(nullptr, COINIT_MULTITHREADED);
    if (SUCCEEDED(hr)) {
        processor->initialized = true;
        *stage = 2;
        hr = CoCreateInstance(CLSID_CWMAudioAEC, nullptr, CLSCTX_INPROC_SERVER,
                             IID_PPV_ARGS(processor->dmo.GetAddressOf()));
    }
    ComPtr<IPropertyStore> store;
    if (SUCCEEDED(hr)) { *stage = 3; hr = processor->dmo.As(&store); }
    if (SUCCEEDED(hr)) { *stage = 4; hr = property(store.Get(), MFPKEY_WMAAECMA_DMO_SOURCE_MODE, 0, true); }
    if (SUCCEEDED(hr)) { *stage = 5; hr = property(store.Get(), MFPKEY_WMAAECMA_SYSTEM_MODE, SINGLE_CHANNEL_AEC); }
    if (SUCCEEDED(hr)) { *stage = 6; hr = property(store.Get(), MFPKEY_WMAAECMA_FEATURE_MODE, 1, true); }
    if (SUCCEEDED(hr)) { *stage = 7; hr = property(store.Get(), MFPKEY_WMAAECMA_FEATR_FRAME_SIZE, 160); }
    // Isolate AEC. Do not let automatic gain/noise gating masquerade as separation.
    if (SUCCEEDED(hr)) { *stage = 8; hr = property(store.Get(), MFPKEY_WMAAECMA_FEATR_AGC, 0, true); }
    if (SUCCEEDED(hr)) { *stage = 9; hr = property(store.Get(), MFPKEY_WMAAECMA_FEATR_NS, 0); }
    if (SUCCEEDED(hr)) { *stage = 10; hr = property(store.Get(), MFPKEY_WMAAECMA_FEATR_CENTER_CLIP, 0, true); }
    if (SUCCEEDED(hr)) { *stage = 18; hr = property(store.Get(), MFPKEY_WMAAECMA_FEATR_AES, suppression); }
    if (SUCCEEDED(hr)) { *stage = 19; hr = property(store.Get(), MFPKEY_WMAAECMA_FEATR_NOISE_FILL, 0, true); }
    if (SUCCEEDED(hr)) { *stage = 11; hr = media_type(processor->dmo.Get(), 0, false); }
    if (SUCCEEDED(hr)) { *stage = 12; hr = media_type(processor->dmo.Get(), 1, false); }
    if (SUCCEEDED(hr)) { *stage = 13; hr = media_type(processor->dmo.Get(), 0, true); }
    if (SUCCEEDED(hr)) { *stage = 14; hr = processor->dmo->AllocateStreamingResources(); }
    if (FAILED(hr)) { delete processor; return hr; }
    *stage = 0; *result = processor; return S_OK;
}

extern "C" __declspec(dllexport) void sam_aec_close(void* handle) noexcept {
    delete static_cast<Processor*>(handle);
}

extern "C" __declspec(dllexport) HRESULT sam_aec_process(
    void* handle, const BYTE* capture, const BYTE* render,
    BYTE* output, DWORD capacity, DWORD* length, DWORD* stage) noexcept {
    if (!handle || !capture || !render || !output || !length || !stage || capacity < kFrameBytes)
        return E_INVALIDARG;
    *length = 0;
    auto* p = static_cast<Processor*>(handle);
    try {
        ComPtr<Buffer> captureBuffer, renderBuffer, processed;
        captureBuffer.Attach(new Buffer(kFrameBytes)); renderBuffer.Attach(new Buffer(kFrameBytes));
        processed.Attach(new Buffer(capacity));
        captureBuffer->assign(capture); renderBuffer->assign(render);
        DWORD flags = DMO_INPUT_DATA_BUFFERF_TIME | DMO_INPUT_DATA_BUFFERF_TIMELENGTH | DMO_INPUT_DATA_BUFFERF_SYNCPOINT;
        *stage = 15;
        HRESULT hr = p->dmo->ProcessInput(1, renderBuffer.Get(), flags, p->time, kFrameTime);
        if (FAILED(hr)) return hr;
        *stage = 16;
        hr = p->dmo->ProcessInput(0, captureBuffer.Get(), flags, p->time, kFrameTime);
        if (FAILED(hr)) return hr;
        p->time += kFrameTime;
        DMO_OUTPUT_DATA_BUFFER buffer{}; buffer.pBuffer = processed.Get();
        DWORD status = 0;
        *stage = 17;
        hr = p->dmo->ProcessOutput(0, 1, &buffer, &status);
        if (FAILED(hr)) return hr;
        BYTE* data = nullptr;
        processed->GetBufferAndLength(&data, length);
        if (*length > capacity || (buffer.dwStatus & DMO_OUTPUT_DATA_BUFFERF_INCOMPLETE)) return E_UNEXPECTED;
        std::memcpy(output, data, *length); *stage = 0;
        return S_OK;
    } catch (...) { return E_OUTOFMEMORY; }
}
