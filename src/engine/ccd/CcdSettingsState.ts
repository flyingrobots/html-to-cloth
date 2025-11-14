/** CCD settings shared via an engine system; controls CCD thresholds. */
export class CcdSettingsState {
  speedThreshold = 5 // m/s above which CCD is considered
  maxIterations = 3 // future use when integrating multiple TOI resolves
  epsilon = 1e-4
}
