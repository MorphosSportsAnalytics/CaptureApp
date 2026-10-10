package com.morphos.videotranscode

import android.media.MediaMetadataRetriever
import android.net.Uri
import android.os.Handler
import android.os.Looper
import androidx.annotation.OptIn
import androidx.media3.common.Effect
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.util.UnstableApi
import androidx.media3.effect.FrameDropEffect
import androidx.media3.effect.Presentation
import androidx.media3.transformer.Composition
import androidx.media3.transformer.DefaultEncoderFactory
import androidx.media3.transformer.EditedMediaItem
import androidx.media3.transformer.Effects
import androidx.media3.transformer.ExportException
import androidx.media3.transformer.ExportResult
import androidx.media3.transformer.ProgressHolder
import androidx.media3.transformer.Transformer
import androidx.media3.transformer.VideoEncoderSettings
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableType
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.io.File

@OptIn(UnstableApi::class)
class MorphosVideoTranscodeModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {
  private var transformer: Transformer? = null
  private var cancelled = false
  private val mainHandler = Handler(Looper.getMainLooper())
  private var progressRunnable: Runnable? = null

  override fun getName(): String = NAME

  @ReactMethod
  fun probe(uri: String, promise: Promise) {
    try {
      promise.resolve(Arguments.makeNativeMap(probe(uri)))
    } catch (err: Exception) {
      promise.reject("ERR_PROBE", err.message ?: "Couldn't inspect this video.", err)
    }
  }

  @ReactMethod
  fun encode(options: ReadableMap, promise: Promise) {
    encodeOptions(options, promise)
  }

  @ReactMethod
  fun cancel() {
    cancelEncode()
  }

  @ReactMethod
  fun addListener(eventName: String) {
    // NativeEventEmitter requires this method on Android.
  }

  @ReactMethod
  fun removeListeners(count: Int) {
    // NativeEventEmitter requires this method on Android.
  }

  private fun probe(uri: String): Map<String, Any> {
    val retriever = MediaMetadataRetriever()
    try {
      val parsed = uriFrom(uri)
      if (parsed.scheme == "file") {
        retriever.setDataSource(parsed.path)
      } else {
        retriever.setDataSource(androidContext(), parsed)
      }
      val storedWidth = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH)?.toIntOrNull() ?: 0
      val storedHeight = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT)?.toIntOrNull() ?: 0
      val rotation = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_ROTATION)?.toIntOrNull() ?: 0
      val (width, height) =
        if (rotation == 90 || rotation == 270) storedHeight to storedWidth else storedWidth to storedHeight
      val bitrate = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_BITRATE)?.toLongOrNull() ?: 0L
      val mime = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_MIMETYPE).orEmpty()
      val durationMs = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull() ?: 0L
      val frameCount = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_FRAME_COUNT)?.toDoubleOrNull()
      val captureFps = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_CAPTURE_FRAMERATE)?.toDoubleOrNull()
      val fps = when {
        captureFps != null && captureFps > 0 -> captureFps
        frameCount != null && frameCount > 0 && durationMs > 0 -> frameCount * 1000.0 / durationMs
        else -> 30.0
      }
      return mapOf(
        "width" to width,
        "height" to height,
        "fps" to fps,
        "bitrateKbps" to if (bitrate > 0) bitrate / 1000.0 else 0.0,
        "codec" to codecFromMime(mime),
      )
    } finally {
      retriever.release()
    }
  }

  private fun encodeOptions(options: ReadableMap, promise: Promise) {
    val context = androidContext()
    val inputUri = options.getString("inputUri") ?: run {
      promise.reject("ERR_INVALID_OPTIONS", "Missing input URI", null)
      return
    }
    val outputUri = options.getString("outputUri") ?: run {
      promise.reject("ERR_INVALID_OPTIONS", "Missing output URI", null)
      return
    }
    val width = intOf(options, "width", 1920)
    val height = intOf(options, "height", 1080)
    val fps = maxOf(1, intOf(options, "fps", 30))
    val bitrateKbps = maxOf(64, intOf(options, "bitrateKbps", 5000))
    val outputPath = pathFrom(outputUri)
    val outFile = File(outputPath)
    outFile.parentFile?.mkdirs()
    if (outFile.exists()) outFile.delete()

    cancelled = false
    val videoEffects = listOf<Effect>(
      Presentation.createForWidthAndHeight(width, height, Presentation.LAYOUT_SCALE_TO_FIT),
      FrameDropEffect.createDefaultFrameDropEffect(fps.toFloat()),
    )
    val edited = EditedMediaItem.Builder(MediaItem.fromUri(uriFrom(inputUri)))
      .setEffects(Effects(emptyList(), videoEffects))
      .build()
    val encoderFactory = DefaultEncoderFactory.Builder(context)
      .setRequestedVideoEncoderSettings(
        VideoEncoderSettings.Builder().setBitrate(bitrateKbps * 1000).build(),
      )
      .build()

    val next = Transformer.Builder(context)
      .setVideoMimeType(MimeTypes.VIDEO_H264)
      .setEncoderFactory(encoderFactory)
      .addListener(
        object : Transformer.Listener {
          override fun onCompleted(composition: Composition, exportResult: ExportResult) {
            stopProgress()
            transformer = null
            emitProgress(1.0)
            val result = Arguments.createMap()
            result.putString("outputUri", toFileUri(outputPath))
            promise.resolve(result)
          }

          override fun onError(
            composition: Composition,
            exportResult: ExportResult,
            exception: ExportException,
          ) {
            stopProgress()
            transformer = null
            if (cancelled) {
              promise.reject("cancelled", "cancelled", exception)
            } else {
              promise.reject("ERR_EXPORT", exception.message ?: "Couldn't prepare this video for upload.", exception)
            }
          }
        },
      )
      .build()
    transformer = next
    startProgress(next)
    try {
      next.start(edited, outputPath)
    } catch (err: Exception) {
      stopProgress()
      transformer = null
      promise.reject("ERR_EXPORT", err.message ?: "Couldn't prepare this video for upload.", err)
    }
  }

  private fun startProgress(active: Transformer) {
    stopProgress()
    val holder = ProgressHolder()
    val runnable = object : Runnable {
      override fun run() {
        val state = active.getProgress(holder)
        if (state == Transformer.PROGRESS_STATE_AVAILABLE) {
          emitProgress(holder.progress / 100.0)
        }
        mainHandler.postDelayed(this, 250)
      }
    }
    progressRunnable = runnable
    mainHandler.post(runnable)
  }

  private fun stopProgress() {
    progressRunnable?.let { mainHandler.removeCallbacks(it) }
    progressRunnable = null
  }

  private fun cancelEncode() {
    cancelled = true
    transformer?.cancel()
  }

  private fun emitProgress(progress: Double) {
    val params = Arguments.createMap()
    params.putDouble("progress", progress)
    reactApplicationContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit("onProgress", params)
  }

  private fun androidContext(): android.content.Context {
    return reactApplicationContext.applicationContext
  }

  private fun uriFrom(uri: String): Uri {
    return if (uri.contains("://")) Uri.parse(uri) else Uri.fromFile(File(uri))
  }

  private fun pathFrom(uri: String): String {
    return if (uri.startsWith("file://")) Uri.parse(uri).path ?: uri.removePrefix("file://") else uri
  }

  private fun toFileUri(path: String): String {
    return if (path.startsWith("file://")) path else Uri.fromFile(File(path)).toString()
  }

  private fun codecFromMime(mime: String): String {
    val lower = mime.lowercase()
    return when {
      lower.contains("hevc") || lower.contains("h265") -> "hvc1"
      lower.contains("avc") || lower.contains("h264") -> "avc1"
      else -> mime.ifBlank { "h264" }
    }
  }

  private fun intOf(options: ReadableMap, key: String, fallback: Int): Int {
    if (!options.hasKey(key) || options.isNull(key)) return fallback
    return when (options.getType(key)) {
      ReadableType.Number -> options.getInt(key)
      else -> fallback
    }
  }

  companion object {
    const val NAME = "MorphosVideoTranscode"
  }
}
