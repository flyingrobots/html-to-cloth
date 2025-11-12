/** CCD settings shared via an engine system; used as a feature flag and for thresholds. */
export class CcdSettingsState {
  enabled = false
  speedThreshold = 5 // m/s above which CCD is considered
  maxIterations = 3 // future use when integrating multiple TOI resolves
  epsilon = 1e-4
}

