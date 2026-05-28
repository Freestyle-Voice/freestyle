import UIKit

/// Custom keyboard extension for Freestyle.
/// Provides a mic button that records audio, transcribes it, and inserts
/// the text into the active text field via `textDocumentProxy`.
///
/// Requirements:
/// - User must enable "Allow Full Access" in Settings > General > Keyboard > Freestyle
///   for microphone and network access.
class KeyboardViewController: UIInputViewController {

    // MARK: - UI Elements

    private let micButton = UIButton(type: .system)
    private let statusLabel = UILabel()
    private let transcriptLabel = UILabel()
    private let nextKeyboardButton = UIButton(type: .system)
    private let deleteButton = UIButton(type: .system)
    private let returnButton = UIButton(type: .system)
    private let spaceButton = UIButton(type: .system)

    // MARK: - State

    private let recorder = AudioRecorder()
    private let transcriptionService = TranscriptionService()
    private var isCurrentlyRecording = false
    private var recordingStartTime: Date?

    // MARK: - Colors

    private let primaryColor = UIColor(red: 0.125, green: 0.541, blue: 0.937, alpha: 1) // #208AEF
    private let dangerColor = UIColor.systemRed

    // MARK: - Lifecycle

    override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
    }

    override func viewWillLayoutSubviews() {
        super.viewWillLayoutSubviews()
        updateAppearance()
    }

    override func textWillChange(_ textInput: UITextInput?) {
        // Called when the text is about to change
    }

    override func textDidChange(_ textInput: UITextInput?) {
        // Called when the text has changed
    }

    // MARK: - UI Setup

    private func setupUI() {
        guard let inputView = inputView else { return }

        // Set a fixed keyboard height
        let heightConstraint = inputView.heightAnchor.constraint(equalToConstant: 260)
        heightConstraint.priority = .required
        heightConstraint.isActive = true

        // Container
        let container = UIView()
        container.translatesAutoresizingMaskIntoConstraints = false
        inputView.addSubview(container)
        NSLayoutConstraint.activate([
            container.topAnchor.constraint(equalTo: inputView.topAnchor, constant: 8),
            container.leadingAnchor.constraint(equalTo: inputView.leadingAnchor, constant: 8),
            container.trailingAnchor.constraint(equalTo: inputView.trailingAnchor, constant: -8),
            container.bottomAnchor.constraint(equalTo: inputView.bottomAnchor, constant: -8),
        ])

        // Transcript area
        transcriptLabel.translatesAutoresizingMaskIntoConstraints = false
        transcriptLabel.numberOfLines = 3
        transcriptLabel.font = .systemFont(ofSize: 14)
        transcriptLabel.textAlignment = .center
        transcriptLabel.text = ""
        container.addSubview(transcriptLabel)

        // Status label
        statusLabel.translatesAutoresizingMaskIntoConstraints = false
        statusLabel.font = .systemFont(ofSize: 12)
        statusLabel.textAlignment = .center
        statusLabel.text = "Tap mic to dictate"
        container.addSubview(statusLabel)

        // Mic button (center, large)
        micButton.translatesAutoresizingMaskIntoConstraints = false
        micButton.setTitle("🎙", for: .normal)
        micButton.titleLabel?.font = .systemFont(ofSize: 32)
        micButton.layer.cornerRadius = 32
        micButton.clipsToBounds = true
        micButton.backgroundColor = primaryColor
        micButton.addTarget(self, action: #selector(micButtonTapped), for: .touchUpInside)
        container.addSubview(micButton)

        // Bottom row: globe / space / delete / return
        let bottomRow = UIStackView()
        bottomRow.translatesAutoresizingMaskIntoConstraints = false
        bottomRow.axis = .horizontal
        bottomRow.spacing = 6
        bottomRow.distribution = .fill
        container.addSubview(bottomRow)

        // Next keyboard (globe) button
        nextKeyboardButton.setTitle("🌐", for: .normal)
        nextKeyboardButton.titleLabel?.font = .systemFont(ofSize: 18)
        nextKeyboardButton.layer.cornerRadius = 8
        nextKeyboardButton.addTarget(self, action: #selector(handleInputModeList(from:with:)), for: .allTouchEvents)
        nextKeyboardButton.widthAnchor.constraint(equalToConstant: 44).isActive = true
        bottomRow.addArrangedSubview(nextKeyboardButton)

        // Space bar
        spaceButton.setTitle("space", for: .normal)
        spaceButton.titleLabel?.font = .systemFont(ofSize: 15)
        spaceButton.layer.cornerRadius = 8
        spaceButton.addTarget(self, action: #selector(spacePressed), for: .touchUpInside)
        bottomRow.addArrangedSubview(spaceButton)

        // Delete
        deleteButton.setTitle("⌫", for: .normal)
        deleteButton.titleLabel?.font = .systemFont(ofSize: 18)
        deleteButton.layer.cornerRadius = 8
        deleteButton.addTarget(self, action: #selector(deletePressed), for: .touchUpInside)
        deleteButton.widthAnchor.constraint(equalToConstant: 44).isActive = true
        bottomRow.addArrangedSubview(deleteButton)

        // Return
        returnButton.setTitle("↵", for: .normal)
        returnButton.titleLabel?.font = .systemFont(ofSize: 18)
        returnButton.layer.cornerRadius = 8
        returnButton.addTarget(self, action: #selector(returnPressed), for: .touchUpInside)
        returnButton.widthAnchor.constraint(equalToConstant: 50).isActive = true
        bottomRow.addArrangedSubview(returnButton)

        // Layout constraints
        NSLayoutConstraint.activate([
            transcriptLabel.topAnchor.constraint(equalTo: container.topAnchor, constant: 4),
            transcriptLabel.leadingAnchor.constraint(equalTo: container.leadingAnchor, constant: 8),
            transcriptLabel.trailingAnchor.constraint(equalTo: container.trailingAnchor, constant: -8),
            transcriptLabel.heightAnchor.constraint(greaterThanOrEqualToConstant: 44),

            statusLabel.topAnchor.constraint(equalTo: transcriptLabel.bottomAnchor, constant: 4),
            statusLabel.centerXAnchor.constraint(equalTo: container.centerXAnchor),

            micButton.centerXAnchor.constraint(equalTo: container.centerXAnchor),
            micButton.topAnchor.constraint(equalTo: statusLabel.bottomAnchor, constant: 12),
            micButton.widthAnchor.constraint(equalToConstant: 64),
            micButton.heightAnchor.constraint(equalToConstant: 64),

            bottomRow.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            bottomRow.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            bottomRow.bottomAnchor.constraint(equalTo: container.bottomAnchor),
            bottomRow.heightAnchor.constraint(equalToConstant: 42),
        ])

        updateAppearance()
    }

    private func updateAppearance() {
        let isDark = traitCollection.userInterfaceStyle == .dark
        let bgColor: UIColor = isDark ? UIColor(white: 0.1, alpha: 1) : UIColor(white: 0.95, alpha: 1)
        let textColor: UIColor = isDark ? .white : .black
        let secondaryText: UIColor = isDark ? .lightGray : .darkGray
        let buttonBg: UIColor = isDark ? UIColor(white: 0.2, alpha: 1) : .white

        inputView?.backgroundColor = bgColor
        statusLabel.textColor = secondaryText
        transcriptLabel.textColor = textColor

        for btn in [nextKeyboardButton, spaceButton, deleteButton, returnButton] {
            btn.backgroundColor = buttonBg
            btn.setTitleColor(textColor, for: .normal)
        }
    }

    // MARK: - Actions

    @objc private func micButtonTapped() {
        if isCurrentlyRecording {
            stopAndTranscribe()
        } else {
            startRecording()
        }
    }

    private func startRecording() {
        guard isFullAccessGranted else {
            statusLabel.text = "Enable Full Access in Settings"
            transcriptLabel.text = "Settings → General → Keyboard → Freestyle → Allow Full Access"
            return
        }

        guard SharedConfig.isOnboardingComplete else {
            statusLabel.text = "Setup required"
            transcriptLabel.text = "Open the Freestyle app to configure your API key."
            return
        }

        do {
            try recorder.startRecording()
            isCurrentlyRecording = true
            recordingStartTime = Date()

            micButton.backgroundColor = dangerColor
            statusLabel.text = "Recording... tap to stop"
            transcriptLabel.text = ""

            recorder.onMeteringUpdate = { [weak self] _ in
                // Could animate a waveform here in the future
            }
        } catch {
            statusLabel.text = "Mic access denied"
            transcriptLabel.text = error.localizedDescription
        }
    }

    private func stopAndTranscribe() {
        guard let audioURL = recorder.stopRecording() else {
            isCurrentlyRecording = false
            micButton.backgroundColor = primaryColor
            statusLabel.text = "No audio recorded"
            return
        }

        isCurrentlyRecording = false
        micButton.backgroundColor = primaryColor
        statusLabel.text = "Transcribing..."
        micButton.isEnabled = false

        Task {
            do {
                let result = try await transcriptionService.transcribe(audioURL: audioURL)

                await MainActor.run {
                    let text = result.text.trimmingCharacters(in: .whitespacesAndNewlines)
                    if !text.isEmpty {
                        textDocumentProxy.insertText(text)
                        transcriptLabel.text = text
                        statusLabel.text = "Inserted ✓"
                    } else {
                        statusLabel.text = "No speech detected"
                    }
                    micButton.isEnabled = true
                }

                // Clean up the temp audio file
                try? FileManager.default.removeItem(at: audioURL)
            } catch {
                await MainActor.run {
                    statusLabel.text = "Error"
                    transcriptLabel.text = error.localizedDescription
                    micButton.isEnabled = true
                }
            }
        }
    }

    @objc private func spacePressed() {
        textDocumentProxy.insertText(" ")
    }

    @objc private func deletePressed() {
        textDocumentProxy.deleteBackward()
    }

    @objc private func returnPressed() {
        textDocumentProxy.insertText("\n")
    }

    // MARK: - Helpers

    /// Check if the user has granted Full Access to this keyboard.
    /// Full Access is required for network requests (transcription API)
    /// and microphone access.
    private var isFullAccessGranted: Bool {
        // UIInputViewController.hasFullAccess is available on iOS 11+
        return super.hasFullAccess
    }
}
