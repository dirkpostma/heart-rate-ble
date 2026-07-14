/** @type {import('@bacons/apple-targets').Config} */
module.exports = {
  type: 'widget',
  name: 'HeartRateWidgets',
  displayName: 'Heart Rate',
  // 16.2, not 16.1: the post-16.1 ActivityKit API shapes (ActivityContent,
  // staleDate) let the Swift below skip availability guards (map #45).
  deploymentTarget: '16.2',
  bundleIdentifier: '.widgets',
  frameworks: ['SwiftUI', 'WidgetKit', 'ActivityKit'],
  entitlements: {
    'com.apple.security.application-groups': ['group.dev.dirkpostma.heartrateble'],
  },
};
