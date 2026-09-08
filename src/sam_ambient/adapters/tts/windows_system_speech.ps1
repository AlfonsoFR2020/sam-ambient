param([string]$OutputPath, [switch]$ListVoices)
$ErrorActionPreference = "Stop"
[Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
Add-Type -AssemblyName System.Speech
$synthesizer = [System.Speech.Synthesis.SpeechSynthesizer]::new()
$format = [System.Speech.AudioFormat.SpeechAudioFormatInfo]::new(16000, 16, 1)
try {
    if ($ListVoices) {
        $voices = @($synthesizer.GetInstalledVoices() | Where-Object Enabled | ForEach-Object {
            @{voice_id = $_.VoiceInfo.Name; locale = $_.VoiceInfo.Culture.Name}
        })
        @{voices = $voices; default = @{voice_id = $synthesizer.Voice.Name; locale = $synthesizer.Voice.Culture.Name}} | ConvertTo-Json -Depth 4 -Compress
        return
    }
    $request = [Console]::In.ReadToEnd() | ConvertFrom-Json
    $synthesizer.SelectVoice($request.voice)
    $synthesizer.SetOutputToWaveFile($OutputPath, $format)
    $synthesizer.Speak($request.text)
} finally {
    $synthesizer.Dispose()
}
