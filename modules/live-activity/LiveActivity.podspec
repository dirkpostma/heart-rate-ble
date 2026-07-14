Pod::Spec.new do |s|
  s.name           = 'LiveActivity'
  s.version        = '1.0.0'
  s.summary        = 'ActivityKit bridge for the heart-rate Live Activity'
  s.description    = 'Local Expo module: start/update/end the heart-rate Live Activity.'
  s.author         = 'Dirk Postma'
  s.homepage       = 'https://github.com/dirkpostma/heart-rate-ble'
  s.license        = { type: 'MIT' }
  # 16.2 so the ActivityKit calls below need no availability guards
  # (the app's deployment target is raised to 16.2 anyway).
  s.platforms      = { ios: '16.2' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES'
  }

  s.source_files = '**/*.{h,m,mm,swift}'
end
