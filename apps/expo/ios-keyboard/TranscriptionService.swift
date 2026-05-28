import Foundation

/// Sends recorded audio to a transcription API and returns the text.
/// Reads provider configuration from SharedConfig (App Groups).
class TranscriptionService {
    enum TranscriptionError: LocalizedError {
        case noModelConfigured
        case noApiKey(String)
        case unsupportedProvider(String)
        case networkError(String)
        case apiError(Int, String)

        var errorDescription: String? {
            switch self {
            case .noModelConfigured:
                return "No voice model configured. Open Freestyle to set one up."
            case .noApiKey(let provider):
                return "No API key for \(provider). Open Freestyle to add one."
            case .unsupportedProvider(let provider):
                return "Unsupported provider: \(provider)"
            case .networkError(let msg):
                return "Network error: \(msg)"
            case .apiError(let code, let msg):
                return "API error (\(code)): \(msg)"
            }
        }
    }

    struct Result {
        let text: String
        let provider: String
        let model: String
    }

    func transcribe(audioURL: URL) async throws -> Result {
        guard let voiceModel = SharedConfig.getDefaultVoiceModel() else {
            throw TranscriptionError.noModelConfigured
        }

        guard let apiKey = SharedConfig.getApiKey(for: voiceModel.provider) else {
            throw TranscriptionError.noApiKey(voiceModel.provider)
        }

        let modelId = stripProviderPrefix(voiceModel.modelId)
        let language = SharedConfig.language
        let langParam = language != "auto" ? language : nil

        let text: String
        switch voiceModel.provider {
        case "openai":
            text = try await transcribeOpenAI(audioURL: audioURL, apiKey: apiKey, model: modelId, language: langParam)
        case "groq":
            text = try await transcribeGroq(audioURL: audioURL, apiKey: apiKey, model: modelId, language: langParam)
        case "deepgram":
            text = try await transcribeDeepgram(audioURL: audioURL, apiKey: apiKey, model: modelId, language: langParam)
        case "elevenlabs":
            text = try await transcribeElevenLabs(audioURL: audioURL, apiKey: apiKey, model: modelId, language: langParam)
        default:
            throw TranscriptionError.unsupportedProvider(voiceModel.provider)
        }

        var finalText = text
        let dictionary = SharedConfig.getDictionary()
        if !dictionary.isEmpty {
            finalText = applyDictionaryReplacements(finalText, dictionary: dictionary)
        }

        return Result(text: finalText, provider: voiceModel.provider, model: voiceModel.modelId)
    }

    // MARK: - Provider Implementations

    private func transcribeOpenAI(audioURL: URL, apiKey: String, model: String, language: String?) async throws -> String {
        let url = URL(string: "https://api.openai.com/v1/audio/transcriptions")!
        let (data, response) = try await uploadMultipart(
            url: url,
            audioURL: audioURL,
            headers: ["Authorization": "Bearer \(apiKey)"],
            fields: buildFields(model: model, language: language)
        )
        return try parseOpenAIResponse(data: data, response: response, provider: "OpenAI")
    }

    private func transcribeGroq(audioURL: URL, apiKey: String, model: String, language: String?) async throws -> String {
        let url = URL(string: "https://api.groq.com/openai/v1/audio/transcriptions")!
        let (data, response) = try await uploadMultipart(
            url: url,
            audioURL: audioURL,
            headers: ["Authorization": "Bearer \(apiKey)"],
            fields: buildFields(model: model, language: language)
        )
        return try parseOpenAIResponse(data: data, response: response, provider: "Groq")
    }

    private func transcribeDeepgram(audioURL: URL, apiKey: String, model: String, language: String?) async throws -> String {
        var components = URLComponents(string: "https://api.deepgram.com/v1/listen")!
        var queryItems = [URLQueryItem(name: "model", value: model)]
        if let lang = language { queryItems.append(URLQueryItem(name: "language", value: lang)) }
        components.queryItems = queryItems

        let audioData = try Data(contentsOf: audioURL)
        var request = URLRequest(url: components.url!)
        request.httpMethod = "POST"
        request.setValue("Token \(apiKey)", forHTTPHeaderField: "Authorization")
        request.setValue("audio/m4a", forHTTPHeaderField: "Content-Type")
        request.httpBody = audioData

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw TranscriptionError.networkError("Invalid response")
        }
        guard httpResponse.statusCode == 200 else {
            let body = String(data: data, encoding: .utf8) ?? ""
            throw TranscriptionError.apiError(httpResponse.statusCode, body)
        }

        let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        let results = json?["results"] as? [String: Any]
        let channels = results?["channels"] as? [[String: Any]]
        let alternatives = channels?.first?["alternatives"] as? [[String: Any]]
        return alternatives?.first?["transcript"] as? String ?? ""
    }

    private func transcribeElevenLabs(audioURL: URL, apiKey: String, model: String, language: String?) async throws -> String {
        let url = URL(string: "https://api.elevenlabs.io/v1/audio/transcriptions")!
        let (data, response) = try await uploadMultipart(
            url: url,
            audioURL: audioURL,
            headers: ["xi-api-key": apiKey],
            fields: ["model_id": model]
        )
        return try parseOpenAIResponse(data: data, response: response, provider: "ElevenLabs")
    }

    // MARK: - Helpers

    private func stripProviderPrefix(_ modelId: String) -> String {
        guard let slashIndex = modelId.firstIndex(of: "/") else { return modelId }
        return String(modelId[modelId.index(after: slashIndex)...])
    }

    private func buildFields(model: String, language: String?) -> [String: String] {
        var fields = ["model": model]
        if let lang = language { fields["language"] = lang }
        return fields
    }

    private func uploadMultipart(
        url: URL,
        audioURL: URL,
        headers: [String: String],
        fields: [String: String]
    ) async throws -> (Data, URLResponse) {
        let boundary = "Boundary-\(UUID().uuidString)"
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        for (key, value) in headers {
            request.setValue(value, forHTTPHeaderField: key)
        }

        var body = Data()

        for (key, value) in fields {
            body.append("--\(boundary)\r\n".data(using: .utf8)!)
            body.append("Content-Disposition: form-data; name=\"\(key)\"\r\n\r\n".data(using: .utf8)!)
            body.append("\(value)\r\n".data(using: .utf8)!)
        }

        let audioData = try Data(contentsOf: audioURL)
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"file\"; filename=\"recording.m4a\"\r\n".data(using: .utf8)!)
        body.append("Content-Type: audio/m4a\r\n\r\n".data(using: .utf8)!)
        body.append(audioData)
        body.append("\r\n".data(using: .utf8)!)
        body.append("--\(boundary)--\r\n".data(using: .utf8)!)

        request.httpBody = body

        return try await URLSession.shared.data(for: request)
    }

    private func parseOpenAIResponse(data: Data, response: URLResponse, provider: String) throws -> String {
        guard let httpResponse = response as? HTTPURLResponse else {
            throw TranscriptionError.networkError("Invalid response")
        }
        guard httpResponse.statusCode == 200 else {
            let body = String(data: data, encoding: .utf8) ?? ""
            throw TranscriptionError.apiError(httpResponse.statusCode, body)
        }
        let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        return json?["text"] as? String ?? ""
    }

    private func applyDictionaryReplacements(_ text: String, dictionary: [SharedConfig.DictionaryEntry]) -> String {
        var result = text
        // Apply longest matches first (dictionary is pre-sorted by key length in SharedConfig)
        for entry in dictionary {
            let pattern = "\\b\(NSRegularExpression.escapedPattern(for: entry.key))\\b"
            if let regex = try? NSRegularExpression(pattern: pattern, options: .caseInsensitive) {
                result = regex.stringByReplacingMatches(
                    in: result,
                    range: NSRange(result.startIndex..., in: result),
                    withTemplate: entry.value
                )
            }
        }
        return result
    }
}
