// Tote stacking model — answers the brief's requirement to "model how
// totes stack in the cabin and state how much dimensional space remains
// once your load is placed."
//
// Aircraft: Wilderness North Air operates the Cessna 208B (TSB aviation
// investigation A23O0028: C-GMVB, based in Nakina).
// Freighter cabin per DHL Aviation's C208B dimension sheet:
//   178 in long x 62 in wide x 51 in high, cargo door 50 x 49 in.
//   https://aviationcargo.dhl.com/sites/default/files/aircraft_dimension_sheets/cessna-caravan-c208B.pdf
//
// Tote rim (widest point): 25 x 15.5 in, 11 in tall.
// Arrangement:
//   - 2 totes long-side across the 62 in width (50 in used, 12 in spare
//     for wall curvature and handling),
//   - stacked 4 high (44 of 51 in),
//   - rows 15.5 in deep along the 178 in cabin -> 11 rows.
//   => 2 x 4 x 11 = 88 totes by pure dimensions, which agrees with the
//      brief's operational estimate of "up to 90 stacked totes".
//   The optional belly pannier (83 cu ft) is NOT counted.

export const STACKING = {
  totesAcross: 2,
  layersHigh: 4,
  rowDepthIn: 15.5,
  cabinLengthIn: 178,
  cabinWidthIn: 62,
  cabinHeightIn: 51,
  totesPerRow: 2 * 4,
  maxRows: Math.floor(178 / 15.5), // 11
  maxTotesByDimensions: 2 * 4 * Math.floor(178 / 15.5), // 88
};

export interface StackingReport {
  rowsUsed: number;
  lengthUsedIn: number;
  lengthLeftIn: number; // dimensional space left along the cabin
  slotsLeftInLastRow: number;
  moreTotesFit: number; // by dimensions alone
  overCapacity: boolean; // more totes than the cabin can physically hold
}

export function computeStacking(toteCount: number): StackingReport {
  const rowsUsed = Math.ceil(toteCount / STACKING.totesPerRow);
  const lengthUsedIn = rowsUsed * STACKING.rowDepthIn;
  return {
    rowsUsed,
    lengthUsedIn,
    lengthLeftIn: Math.max(0, STACKING.cabinLengthIn - lengthUsedIn),
    slotsLeftInLastRow: rowsUsed * STACKING.totesPerRow - toteCount,
    moreTotesFit: Math.max(0, STACKING.maxTotesByDimensions - toteCount),
    overCapacity: toteCount > STACKING.maxTotesByDimensions,
  };
}
