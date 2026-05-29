import UIKit

class KeyboardViewController: UIInputViewController {

    // MARK: - State

    private let recorder = AudioRecorder()
    private let transcriptionService = TranscriptionService()
    private var isCurrentlyRecording = false
    private var recordingStartTime: Date?
    private var pulseTimer: Timer?

    // MARK: - Colors (Freestyle palette)

    private var primaryColor: UIColor {
        traitCollection.userInterfaceStyle == .dark
            ? UIColor(red: 0.541, green: 0.714, blue: 0.165, alpha: 1)   // #8AB62A
            : UIColor(red: 0.420, green: 0.561, blue: 0.071, alpha: 1)   // #6B8F12
    }

    private var backgroundColor: UIColor {
        traitCollection.userInterfaceStyle == .dark
            ? UIColor(red: 0.086, green: 0.078, blue: 0.059, alpha: 1)   // #16140F
            : UIColor(red: 0.957, green: 0.941, blue: 0.894, alpha: 1)   // #F4F0E4
    }

    private var cardColor: UIColor {
        traitCollection.userInterfaceStyle == .dark
            ? UIColor(red: 0.118, green: 0.110, blue: 0.086, alpha: 1)   // #1E1C16
            : UIColor(red: 0.984, green: 0.973, blue: 0.933, alpha: 1)   // #FBF8EE
    }

    private var borderColor: UIColor {
        traitCollection.userInterfaceStyle == .dark
            ? UIColor(red: 0.227, green: 0.212, blue: 0.176, alpha: 1)   // #3A362D
            : UIColor(red: 0.839, green: 0.804, blue: 0.722, alpha: 1)   // #D6CDB8
    }

    private var textColor: UIColor {
        traitCollection.userInterfaceStyle == .dark
            ? UIColor(red: 0.925, green: 0.906, blue: 0.839, alpha: 1)   // #ECE7D6
            : UIColor(red: 0.086, green: 0.078, blue: 0.059, alpha: 1)   // #16140F
    }

    private var mutedColor: UIColor {
        traitCollection.userInterfaceStyle == .dark
            ? UIColor(red: 0.620, green: 0.592, blue: 0.498, alpha: 1)   // #9E977F
            : UIColor(red: 0.482, green: 0.455, blue: 0.380, alpha: 1)   // #7B7461
    }

    private let dangerColor = UIColor(red: 0.867, green: 0.431, blue: 0.306, alpha: 1) // #DD6E4E

    // MARK: - UI Elements

    private let micButton = UIButton(type: .custom)
    private let micPulseView = UIView()
    private let statusLabel = UILabel()
    private let transcriptLabel = UILabel()
    private let nextKeyboardButton = UIButton(type: .system)
    private let deleteButton = UIButton(type: .system)
    private let returnButton = UIButton(type: .system)
    private let spaceButton = UIButton(type: .system)

    // MARK: - Lifecycle

    override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
    }

    override func viewWillLayoutSubviews() {
        super.viewWillLayoutSubviews()
        applyTheme()
    }

    override func traitCollectionDidChange(_ previousTraitCollection: UITraitCollection?) {
        super.traitCollectionDidChange(previousTraitCollection)
        if traitCollection.hasDifferentColorAppearance(comparedTo: previousTraitCollection) {
            applyTheme()
        }
    }

    override func textWillChange(_ textInput: UITextInput?) {}
    override func textDidChange(_ textInput: UITextInput?) {}

    // MARK: - UI Setup

    private func setupUI() {
        guard let inputView = inputView else { return }
        inputView.translatesAutoresizingMaskIntoConstraints = false

        let heightConstraint = inputView.heightAnchor.constraint(equalToConstant: 280)
        heightConstraint.priority = .init(999)
        heightConstraint.isActive = true

        // Main container
        let container = UIView()
        container.translatesAutoresizingMaskIntoConstraints = false
        inputView.addSubview(container)
        NSLayoutConstraint.activate([
            container.topAnchor.constraint(equalTo: inputView.topAnchor),
            container.leadingAnchor.constraint(equalTo: inputView.leadingAnchor),
            container.trailingAnchor.constraint(equalTo: inputView.trailingAnchor),
            container.bottomAnchor.constraint(equalTo: inputView.bottomAnchor),
        ])

        // --- Top area: transcript + status ---
        let topArea = UIView()
        topArea.translatesAutoresizingMaskIntoConstraints = false
        container.addSubview(topArea)

        transcriptLabel.translatesAutoresizingMaskIntoConstraints = false
        transcriptLabel.numberOfLines = 2
        transcriptLabel.font = .systemFont(ofSize: 15, weight: .regular)
        transcriptLabel.textAlignment = .center
        transcriptLabel.text = ""
        topArea.addSubview(transcriptLabel)

        statusLabel.translatesAutoresizingMaskIntoConstraints = false
        statusLabel.font = .monospacedSystemFont(ofSize: 10, weight: .semibold)
        statusLabel.textAlignment = .center
        statusLabel.text = "TAP MIC TO DICTATE"
        topArea.addSubview(statusLabel)

        NSLayoutConstraint.activate([
            topArea.topAnchor.constraint(equalTo: container.topAnchor, constant: 12),
            topArea.leadingAnchor.constraint(equalTo: container.leadingAnchor, constant: 20),
            topArea.trailingAnchor.constraint(equalTo: container.trailingAnchor, constant: -20),
            topArea.heightAnchor.constraint(equalToConstant: 56),

            transcriptLabel.topAnchor.constraint(equalTo: topArea.topAnchor),
            transcriptLabel.leadingAnchor.constraint(equalTo: topArea.leadingAnchor),
            transcriptLabel.trailingAnchor.constraint(equalTo: topArea.trailingAnchor),

            statusLabel.bottomAnchor.constraint(equalTo: topArea.bottomAnchor),
            statusLabel.centerXAnchor.constraint(equalTo: topArea.centerXAnchor),
        ])

        // --- Center: Mic button with pulse ring ---
        let micContainer = UIView()
        micContainer.translatesAutoresizingMaskIntoConstraints = false
        container.addSubview(micContainer)

        micPulseView.translatesAutoresizingMaskIntoConstraints = false
        micPulseView.layer.cornerRadius = 36
        micPulseView.alpha = 0
        micContainer.addSubview(micPulseView)

        micButton.translatesAutoresizingMaskIntoConstraints = false
        micButton.layer.cornerRadius = 30
        micButton.clipsToBounds = true

        let micConfig = UIImage.SymbolConfiguration(pointSize: 22, weight: .medium)
        let micImage = UIImage(systemName: "mic.fill", withConfiguration: micConfig)
        micButton.setImage(micImage, for: .normal)
        micButton.tintColor = .white
        micButton.addTarget(self, action: #selector(micButtonTapped), for: .touchUpInside)
        micContainer.addSubview(micButton)

        NSLayoutConstraint.activate([
            micContainer.centerXAnchor.constraint(equalTo: container.centerXAnchor),
            micContainer.topAnchor.constraint(equalTo: topArea.bottomAnchor, constant: 8),
            micContainer.widthAnchor.constraint(equalToConstant: 72),
            micContainer.heightAnchor.constraint(equalToConstant: 72),

            micPulseView.centerXAnchor.constraint(equalTo: micContainer.centerXAnchor),
            micPulseView.centerYAnchor.constraint(equalTo: micContainer.centerYAnchor),
            micPulseView.widthAnchor.constraint(equalToConstant: 72),
            micPulseView.heightAnchor.constraint(equalToConstant: 72),

            micButton.centerXAnchor.constraint(equalTo: micContainer.centerXAnchor),
            micButton.centerYAnchor.constraint(equalTo: micContainer.centerYAnchor),
            micButton.widthAnchor.constraint(equalToConstant: 60),
            micButton.heightAnchor.constraint(equalToConstant: 60),
        ])

        // --- Bottom row: key buttons ---
        let bottomRow = UIStackView()
        bottomRow.translatesAutoresizingMaskIntoConstraints = false
        bottomRow.axis = .horizontal
        bottomRow.spacing = 5
        bottomRow.distribution = .fill
        bottomRow.alignment = .fill
        container.addSubview(bottomRow)

        // Globe
        configureKeyButton(nextKeyboardButton, symbolName: "globe", fontSize: 16)
        nextKeyboardButton.addTarget(self, action: #selector(handleInputModeList(from:with:)), for: .allTouchEvents)
        nextKeyboardButton.widthAnchor.constraint(equalToConstant: 44).isActive = true
        bottomRow.addArrangedSubview(nextKeyboardButton)

        // Space
        spaceButton.setTitle("space", for: .normal)
        spaceButton.titleLabel?.font = .systemFont(ofSize: 14, weight: .regular)
        spaceButton.layer.cornerRadius = 10
        spaceButton.layer.borderWidth = 0.5
        spaceButton.addTarget(self, action: #selector(spacePressed), for: .touchUpInside)
        bottomRow.addArrangedSubview(spaceButton)

        // Delete
        configureKeyButton(deleteButton, symbolName: "delete.left", fontSize: 16)
        deleteButton.addTarget(self, action: #selector(deletePressed), for: .touchUpInside)
        deleteButton.widthAnchor.constraint(equalToConstant: 44).isActive = true
        bottomRow.addArrangedSubview(deleteButton)

        // Return
        returnButton.setTitle("return", for: .normal)
        returnButton.titleLabel?.font = .systemFont(ofSize: 14, weight: .regular)
        returnButton.layer.cornerRadius = 10
        returnButton.layer.borderWidth = 0.5
        returnButton.addTarget(self, action: #selector(returnPressed), for: .touchUpInside)
        returnButton.widthAnchor.constraint(equalToConstant: 76).isActive = true
        bottomRow.addArrangedSubview(returnButton)

        NSLayoutConstraint.activate([
            bottomRow.leadingAnchor.constraint(equalTo: container.leadingAnchor, constant: 4),
            bottomRow.trailingAnchor.constraint(equalTo: container.trailingAnchor, constant: -4),
            bottomRow.bottomAnchor.constraint(equalTo: container.bottomAnchor, constant: -6),
            bottomRow.heightAnchor.constraint(equalToConstant: 44),
        ])

        applyTheme()
    }

    private func configureKeyButton(_ button: UIButton, symbolName: String, fontSize: CGFloat) {
        let config = UIImage.SymbolConfiguration(pointSize: fontSize, weight: .regular)
        let image = UIImage(systemName: symbolName, withConfiguration: config)
        button.setImage(image, for: .normal)
        button.layer.cornerRadius = 10
        button.layer.borderWidth = 0.5
    }

    private func applyTheme() {
        inputView?.backgroundColor = backgroundColor

        statusLabel.textColor = mutedColor
        transcriptLabel.textColor = textColor

        micButton.backgroundColor = isCurrentlyRecording ? dangerColor : primaryColor
        micPulseView.backgroundColor = isCurrentlyRecording
            ? dangerColor.withAlphaComponent(0.15)
            : primaryColor.withAlphaComponent(0.15)

        let keyBg = cardColor
        let keyBorder = borderColor.cgColor
        let keyText = textColor

        for btn in [nextKeyboardButton, deleteButton] {
            btn.backgroundColor = keyBg
            btn.tintColor = keyText
            btn.layer.borderColor = keyBorder
        }

        for btn in [spaceButton, returnButton] {
            btn.backgroundColor = keyBg
            btn.setTitleColor(keyText, for: .normal)
            btn.layer.borderColor = keyBorder
        }
    }

    // MARK: - Pulse Animation

    private func startPulse() {
        micPulseView.alpha = 1
        pulseTimer = Timer.scheduledTimer(withTimeInterval: 1.2, repeats: true) { [weak self] _ in
            guard let self else { return }
            self.micPulseView.transform = .identity
            self.micPulseView.alpha = 0.6
            UIView.animate(withDuration: 1.0, delay: 0, options: [.curveEaseOut]) {
                self.micPulseView.transform = CGAffineTransform(scaleX: 1.35, y: 1.35)
                self.micPulseView.alpha = 0
            }
        }
        pulseTimer?.fire()
    }

    private func stopPulse() {
        pulseTimer?.invalidate()
        pulseTimer = nil
        UIView.animate(withDuration: 0.2) {
            self.micPulseView.alpha = 0
            self.micPulseView.transform = .identity
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
            statusLabel.text = "ENABLE FULL ACCESS IN SETTINGS"
            transcriptLabel.text = "Settings → Keyboard → Freestyle → Allow Full Access"
            return
        }

        guard SharedConfig.isOnboardingComplete else {
            statusLabel.text = "SETUP REQUIRED"
            transcriptLabel.text = "Open the Freestyle app to configure your API key."
            return
        }

        do {
            try recorder.startRecording()
            isCurrentlyRecording = true
            recordingStartTime = Date()

            UIView.animate(withDuration: 0.2) {
                self.micButton.backgroundColor = self.dangerColor
                self.micButton.transform = CGAffineTransform(scaleX: 0.92, y: 0.92)
            } completion: { _ in
                UIView.animate(withDuration: 0.1) {
                    self.micButton.transform = .identity
                }
            }

            startPulse()
            statusLabel.text = "RECORDING — TAP TO STOP"
            transcriptLabel.text = ""
        } catch {
            statusLabel.text = "MIC ACCESS DENIED"
            transcriptLabel.text = error.localizedDescription
        }
    }

    private func stopAndTranscribe() {
        guard let audioURL = recorder.stopRecording() else {
            isCurrentlyRecording = false
            stopPulse()
            applyTheme()
            statusLabel.text = "NO AUDIO RECORDED"
            return
        }

        isCurrentlyRecording = false
        stopPulse()

        UIView.animate(withDuration: 0.2) {
            self.micButton.backgroundColor = self.primaryColor
        }

        statusLabel.text = "TRANSCRIBING..."
        micButton.isEnabled = false
        micButton.alpha = 0.6

        Task {
            do {
                let result = try await transcriptionService.transcribe(audioURL: audioURL)

                await MainActor.run {
                    let text = result.text.trimmingCharacters(in: .whitespacesAndNewlines)
                    if !text.isEmpty {
                        self.textDocumentProxy.insertText(text)
                        self.transcriptLabel.text = text
                        self.statusLabel.text = "INSERTED ✓"
                    } else {
                        self.statusLabel.text = "NO SPEECH DETECTED"
                    }
                    self.micButton.isEnabled = true
                    self.micButton.alpha = 1
                }

                try? FileManager.default.removeItem(at: audioURL)
            } catch {
                await MainActor.run {
                    self.statusLabel.text = "ERROR"
                    self.transcriptLabel.text = error.localizedDescription
                    self.micButton.isEnabled = true
                    self.micButton.alpha = 1
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

    private var isFullAccessGranted: Bool {
        return super.hasFullAccess
    }

    deinit {
        pulseTimer?.invalidate()
    }
}
