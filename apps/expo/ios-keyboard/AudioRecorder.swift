import AVFoundation
import Foundation

/// Records audio from the microphone and produces a temporary audio file
/// suitable for sending to transcription APIs.
///
/// Keyboard extensions require "Full Access" to use the microphone.
/// The user must enable this in Settings > General > Keyboard > Freestyle.
class AudioRecorder: NSObject {
    private var audioRecorder: AVAudioRecorder?
    private var recordingURL: URL?
    private var meteringTimer: Timer?
    var onMeteringUpdate: ((Float) -> Void)?

    var isRecording: Bool {
        audioRecorder?.isRecording ?? false
    }

    func startRecording() throws {
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.record, mode: .default, options: [])
        try session.setActive(true)

        let tempDir = FileManager.default.temporaryDirectory
        let fileURL = tempDir.appendingPathComponent("freestyle_keyboard_\(UUID().uuidString).m4a")
        recordingURL = fileURL

        let settings: [String: Any] = [
            AVFormatIDKey: Int(kAudioFormatMPEG4AAC),
            AVSampleRateKey: 44100,
            AVNumberOfChannelsKey: 1,
            AVEncoderAudioQualityKey: AVAudioQuality.high.rawValue,
            AVEncoderBitRateKey: 128000,
        ]

        audioRecorder = try AVAudioRecorder(url: fileURL, settings: settings)
        audioRecorder?.isMeteringEnabled = true
        audioRecorder?.record()

        meteringTimer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { [weak self] _ in
            guard let self, let recorder = self.audioRecorder, recorder.isRecording else { return }
            recorder.updateMeters()
            let level = recorder.averagePower(forChannel: 0)
            self.onMeteringUpdate?(level)
        }
    }

    func stopRecording() -> URL? {
        meteringTimer?.invalidate()
        meteringTimer = nil
        audioRecorder?.stop()

        let session = AVAudioSession.sharedInstance()
        try? session.setActive(false)

        let url = recordingURL
        audioRecorder = nil
        recordingURL = nil
        return url
    }

    func cancelRecording() {
        meteringTimer?.invalidate()
        meteringTimer = nil
        audioRecorder?.stop()
        audioRecorder?.deleteRecording()
        audioRecorder = nil

        if let url = recordingURL {
            try? FileManager.default.removeItem(at: url)
        }
        recordingURL = nil

        let session = AVAudioSession.sharedInstance()
        try? session.setActive(false)
    }

    deinit {
        cancelRecording()
    }
}
