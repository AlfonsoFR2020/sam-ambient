param([Parameter(Mandatory = $true)][string]$OutputPath)
$ErrorActionPreference = "Stop"
$text = [Console]::In.ReadToEnd()
Add-Type -AssemblyName System.Speech
$synthesizer = [System.Speech.Synthesis.SpeechSynthesizer]::new()
$format = [System.Speech.AudioFormat.SpeechAudioFormatInfo]::new(16000, 16, 1)
try {
    $synthesizer.SetOutputToWaveFile($OutputPath, $format)
    $synthesizer.Speak($text)
} finally {
    $synthesizer.Dispose()
}
