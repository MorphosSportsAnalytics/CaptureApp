import AVFoundation
import CoreMedia
import React

enum TranscodeError: Error, LocalizedError {
  case cancelled
  case message(String)

  var errorDescription: String? {
    switch self {
    case .cancelled:
      return "cancelled"
    case .message(let message):
      return message
    }
  }
}

@objc(MorphosVideoTranscode)
class MorphosVideoTranscode: RCTEventEmitter {
  private var exportSession: AVAssetExportSession?
  private var progressTimer: Timer?

  override static func moduleName() -> String! {
    "MorphosVideoTranscode"
  }

  override func supportedEvents() -> [String]! {
    ["onProgress"]
  }

  @objc
  func probe(_ uri: String, resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
    do {
      resolver(try self.probe(uri: uri))
    } catch {
      rejecter("ERR_PROBE", error.localizedDescription, error)
    }
  }

  @objc
  func encode(_ options: [String: Any], resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
    Task {
      do {
        let result = try await self.encode(options: options)
        resolver(result)
      } catch let error as TranscodeError {
        if case .cancelled = error {
          rejecter("cancelled", "cancelled", error)
        } else {
          rejecter("ERR_EXPORT", error.localizedDescription, error)
        }
      } catch {
        rejecter("ERR_EXPORT", error.localizedDescription, error)
      }
    }
  }

  @objc
  func cancel() {
    cancelExport()
  }

  private func probe(uri: String) throws -> [String: Any] {
    let url = try fileURL(from: uri)
    let asset = AVURLAsset(url: url)
    guard let track = asset.tracks(withMediaType: .video).first else {
      throw TranscodeError.message("No video track found")
    }
    let displayed = displayedVideoSize(track: track)
    let width = displayed.width
    let height = displayed.height
    let fps = Double(track.nominalFrameRate)
    let bitrateKbps = Double(track.estimatedDataRate) / 1000.0
    return [
      "width": Int(width.rounded()),
      "height": Int(height.rounded()),
      "fps": fps > 0 ? fps : 30,
      "bitrateKbps": bitrateKbps > 0 ? bitrateKbps : 0,
      "codec": fourCC(from: track),
    ]
  }

  private func encode(options: [String: Any]) async throws -> [String: Any] {
    guard
      let inputUri = options["inputUri"] as? String,
      let outputUri = options["outputUri"] as? String
    else {
      throw TranscodeError.message("Missing input or output URI")
    }
    let width = intOption(options["width"], fallback: 1920)
    let height = intOption(options["height"], fallback: 1080)
    let fps = max(1, intOption(options["fps"], fallback: 30))
    let bitrateKbps = max(64, intOption(options["bitrateKbps"], fallback: 5000))

    let inputURL = try fileURL(from: inputUri)
    let outputURL = try fileURL(from: outputUri)
    try? FileManager.default.removeItem(at: outputURL)

    let asset = AVURLAsset(url: inputURL)
    guard let videoTrack = asset.tracks(withMediaType: .video).first else {
      throw TranscodeError.message("No video track found")
    }
    guard let session = AVAssetExportSession(asset: asset, presetName: AVAssetExportPresetHighestQuality) else {
      throw TranscodeError.message("Could not start video export")
    }

    let composition = videoComposition(track: videoTrack, asset: asset, width: width, height: height, fps: fps)
    session.videoComposition = composition
    session.outputURL = outputURL
    session.outputFileType = .mp4
    session.shouldOptimizeForNetworkUse = true
    let duration = CMTimeGetSeconds(asset.duration)
    if duration > 0 {
      session.fileLengthLimit = Int64((Double(bitrateKbps) * 1000 / 8) * duration * 1.15)
    }

    self.exportSession = session
    await MainActor.run { self.startProgressTimer() }
    defer {
      self.stopProgressTimer()
      self.exportSession = nil
    }

    try await withCheckedThrowingContinuation { (cont: CheckedContinuation<Void, Error>) in
      session.exportAsynchronously {
        switch session.status {
        case .completed:
          cont.resume()
        case .cancelled:
          cont.resume(throwing: TranscodeError.cancelled)
        default:
          let message = session.error?.localizedDescription ?? "Couldn't prepare this video for upload."
          cont.resume(throwing: TranscodeError.message(message))
        }
      }
    }
    sendEvent(withName: "onProgress", body: ["progress": 1])
    return ["outputUri": outputURL.absoluteString]
  }

  private func videoComposition(
    track: AVAssetTrack,
    asset: AVAsset,
    width: Int,
    height: Int,
    fps: Int
  ) -> AVMutableVideoComposition {
    let renderSize = CGSize(width: width, height: height)
    let transformed = displayedVideoRect(track: track)
    let srcSize = CGSize(width: abs(transformed.width), height: abs(transformed.height))
    let scale = min(renderSize.width / max(srcSize.width, 1), renderSize.height / max(srcSize.height, 1))
    let draw = CGSize(width: srcSize.width * scale, height: srcSize.height * scale)
    let dx = (renderSize.width - draw.width) / 2
    let dy = (renderSize.height - draw.height) / 2

    var transform = track.preferredTransform
    transform.tx -= transformed.origin.x
    transform.ty -= transformed.origin.y
    transform = transform.concatenating(CGAffineTransform(scaleX: scale, y: scale))
    transform = transform.concatenating(CGAffineTransform(translationX: dx, y: dy))

    let layerInstruction = AVMutableVideoCompositionLayerInstruction(assetTrack: track)
    layerInstruction.setTransform(transform, at: .zero)

    let instruction = AVMutableVideoCompositionInstruction()
    instruction.timeRange = CMTimeRange(start: .zero, duration: asset.duration)
    instruction.layerInstructions = [layerInstruction]

    let composition = AVMutableVideoComposition()
    composition.renderSize = renderSize
    composition.frameDuration = CMTime(value: 1, timescale: CMTimeScale(fps))
    composition.instructions = [instruction]
    return composition
  }

  /// `preferredTransform` can include translation (90°/270°). Apply it to a
  /// `CGRect`, not `CGSize` — `CGSize` has no `origin`.
  private func displayedVideoRect(track: AVAssetTrack) -> CGRect {
    CGRect(origin: .zero, size: track.naturalSize).applying(track.preferredTransform)
  }

  private func displayedVideoSize(track: AVAssetTrack) -> CGSize {
    let rect = displayedVideoRect(track: track)
    return CGSize(width: abs(rect.width), height: abs(rect.height))
  }

  private func startProgressTimer() {
    stopProgressTimer()
    let timer = Timer.scheduledTimer(withTimeInterval: 0.25, repeats: true) { [weak self] _ in
      guard let self, let session = self.exportSession else { return }
      self.sendEvent(withName: "onProgress", body: ["progress": Double(session.progress)])
    }
    progressTimer = timer
    RunLoop.main.add(timer, forMode: .common)
  }

  private func stopProgressTimer() {
    progressTimer?.invalidate()
    progressTimer = nil
  }

  private func cancelExport() {
    exportSession?.cancelExport()
  }

  private func fileURL(from uri: String) throws -> URL {
    if uri.hasPrefix("file://") {
      guard let url = URL(string: uri) else {
        throw TranscodeError.message("Invalid video URI")
      }
      return url
    }
    return URL(fileURLWithPath: uri)
  }

  private func fourCC(from track: AVAssetTrack) -> String {
    guard let desc = track.formatDescriptions.first else { return "h264" }
    let subtype = CMFormatDescriptionGetMediaSubType(desc as! CMFormatDescription)
    let chars: [UInt8] = [
      UInt8((subtype >> 24) & 0xFF),
      UInt8((subtype >> 16) & 0xFF),
      UInt8((subtype >> 8) & 0xFF),
      UInt8(subtype & 0xFF),
    ]
    return String(bytes: chars, encoding: .ascii)?.trimmingCharacters(in: .whitespaces) ?? "h264"
  }

  private func intOption(_ value: Any?, fallback: Int) -> Int {
    if let n = value as? Int { return n }
    if let n = value as? Double { return Int(n.rounded()) }
    if let n = value as? NSNumber { return n.intValue }
    return fallback
  }
}
