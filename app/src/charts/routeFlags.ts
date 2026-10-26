// Route availability flags for the "Timing and documents" card (design-review M3; plan B04). A row is rendered ONLY
// when the screen it opens exists in this build - never a placeholder, never "coming soon". B05 flips `muhuratFinder`
// when app/app/charts/muhurat/index.tsx lands; B07 flips `janamPatriPdf` (app/app/charts/pdf/[kind].tsx) and
// `shareChartCard` (the share-preview sheet reachable from the Charts ⋮ menu). TimingDocumentsCard renders nothing at
// all while every flag is false.
export interface TimingRouteFlags {
  /** B05: /charts/muhurat */
  muhuratFinder: boolean;
  /** B07: /charts/pdf/janam_patri */
  janamPatriPdf: boolean;
  /** B07: share-card preview of this chart */
  shareChartCard: boolean;
}

export const ROUTE_FLAGS: Readonly<TimingRouteFlags> = {
  muhuratFinder: false,
  janamPatriPdf: false,
  shareChartCard: false,
};

/** Route paths the rows open once their flag is true (kept here so B05/B07 change one file). */
export const TIMING_ROUTES = {
  muhuratFinder: '/charts/muhurat',
  janamPatriPdf: '/charts/pdf/janam_patri',
} as const;
