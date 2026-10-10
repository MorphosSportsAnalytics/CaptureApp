require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name           = "MorphosVideoTranscode"
  s.version        = package["version"]
  s.summary        = "On-device H.264 transcode for Morphos Capture"
  s.description    = "Hardware H.264 transcode with a 1080p cap for Morphos Capture"
  s.author         = "Morphos"
  s.homepage       = "https://morphosanalytics.com"
  s.license        = "UNLICENSED"
  s.platforms      = { :ios => "15.1" }
  s.swift_version  = "5.9"
  s.source         = { :git => "" }
  s.source_files   = "ios/*.{h,m,mm,swift}"
  s.module_name    = "MorphosVideoTranscode"
  s.pod_target_xcconfig = { "DEFINES_MODULE" => "YES" }
  s.dependency "React-Core"
end
