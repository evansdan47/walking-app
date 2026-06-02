/**
 * Converts WGS84 lat/lng to an OS National Grid Reference string.
 *
 * Uses an approximate Helmert transform (WGS84 → OSGB36) then Transverse
 * Mercator projection. Typical accuracy is ±5 m — sufficient for display.
 *
 * Reference: "A Guide to Coordinate Systems in Great Britain" (OS, 2015).
 */

// ── OSGB36 / Airy 1830 ellipsoid constants ────────────────────────────────
const a_O = 6_377_563.396;
const b_O = 6_356_256.91;
const e2_O = 1 - (b_O * b_O) / (a_O * a_O);
const n_O = (a_O - b_O) / (a_O + b_O);

// ── Transverse Mercator projection parameters ──────────────────────────────
const F0 = 0.9996012717;
const phi0 = (49 * Math.PI) / 180;
const lam0 = (-2 * Math.PI) / 180;
const E0 = 400_000;
const N0 = -100_000;

// ── OS grid letters (no 'I') ───────────────────────────────────────────────
const GRID_LETTERS = 'ABCDEFGHJKLMNOPQRSTUVWXYZ';

// ---------------------------------------------------------------------------
// Step 1: WGS84 → OSGB36 (Helmert transform)
// ---------------------------------------------------------------------------

function wgs84ToOsgb36(lat: number, lon: number): { phi: number; lam: number } {
  const phi = (lat * Math.PI) / 180;
  const lam = (lon * Math.PI) / 180;

  // WGS84 ellipsoid (GRS80)
  const a_W = 6_378_137.0;
  const e2_W = 0.006_694_379_990_14;

  const sinPhi = Math.sin(phi);
  const cosPhi = Math.cos(phi);
  const nu_W = a_W / Math.sqrt(1 - e2_W * sinPhi * sinPhi);

  // WGS84 geocentric Cartesian
  const X1 = nu_W * cosPhi * Math.cos(lam);
  const Y1 = nu_W * cosPhi * Math.sin(lam);
  const Z1 = nu_W * (1 - e2_W) * sinPhi;

  // Helmert parameters: WGS84 → OSGB36
  const s = 1 + 20.4894e-6;
  const rX = (-0.1502 / 3600) * (Math.PI / 180);
  const rY = (-0.247 / 3600) * (Math.PI / 180);
  const rZ = (-0.8421 / 3600) * (Math.PI / 180);

  const X2 = -446.448 + s * (X1 - rZ * Y1 + rY * Z1);
  const Y2 = 125.157 + s * (rZ * X1 + Y1 - rX * Z1);
  const Z2 = -542.06 + s * (-rY * X1 + rX * Y1 + Z1);

  // Cartesian → geodetic on Airy 1830 ellipsoid (iterative)
  const p = Math.sqrt(X2 * X2 + Y2 * Y2);
  let phiO = Math.atan2(Z2, p * (1 - e2_O));
  for (let i = 0; i < 6; i++) {
    const nu = a_O / Math.sqrt(1 - e2_O * Math.sin(phiO) ** 2);
    phiO = Math.atan2(Z2 + e2_O * nu * Math.sin(phiO), p);
  }
  const lamO = Math.atan2(Y2, X2);

  return { phi: phiO, lam: lamO };
}

// ---------------------------------------------------------------------------
// Step 2: OSGB36 → National Grid Easting/Northing (Transverse Mercator)
// ---------------------------------------------------------------------------

function meridionalArc(phi: number): number {
  const n2 = n_O * n_O;
  const n3 = n2 * n_O;
  return (
    b_O *
    F0 *
    ((1 + n_O + (5 / 4) * n2 + (5 / 4) * n3) * (phi - phi0) -
      (3 * n_O + 3 * n2 + (21 / 8) * n3) *
        Math.sin(phi - phi0) *
        Math.cos(phi + phi0) +
      ((15 / 8) * n2 + (15 / 8) * n3) *
        Math.sin(2 * (phi - phi0)) *
        Math.cos(2 * (phi + phi0)) -
      (35 / 24) *
        n3 *
        Math.sin(3 * (phi - phi0)) *
        Math.cos(3 * (phi + phi0)))
  );
}

// ---------------------------------------------------------------------------
// Step 3: Easting/Northing → grid reference string
// ---------------------------------------------------------------------------

function enToGridRef(E: number, N: number): string {
  const eR = Math.round(E);
  const nR = Math.round(N);

  // Shift by false origin so all coordinates are positive
  const e = eR + 1_000_000;
  const n = nR + 500_000;

  if (e < 0 || n < 0 || e > 2_500_000 || n > 2_500_000) {
    return '(outside GB)';
  }

  // Major 500 km square letter
  const e5 = Math.floor(e / 500_000);
  const n5 = Math.floor(n / 500_000);
  const L1 = GRID_LETTERS[(4 - n5) * 5 + e5];

  // Minor 100 km square letter (within the major square)
  const e1 = Math.floor((e % 500_000) / 100_000);
  const n1 = Math.floor((n % 500_000) / 100_000);
  const L2 = GRID_LETTERS[(4 - n1) * 5 + e1];

  // 3-digit easting/northing (100 m resolution → 6-figure grid ref)
  const eDigits = String(Math.floor((e % 100_000) / 100)).padStart(3, '0');
  const nDigits = String(Math.floor((n % 100_000) / 100)).padStart(3, '0');

  return `${L1}${L2} ${eDigits} ${nDigits}`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Converts WGS84 latitude/longitude to an OS National Grid Reference string
 * (6-figure, 100 m resolution).
 *
 * Returns `"(outside GB)"` if the coordinates fall outside the National Grid.
 *
 * @example
 *   latLonToOSGridRef(51.5, -0.1276)  // "TQ 304 797" (central London)
 *   latLonToOSGridRef(50.064, -5.713)  // "SW 381 252" (Lands End)
 */
export function latLonToOSGridRef(lat: number, lon: number): string {
  const { phi, lam } = wgs84ToOsgb36(lat, lon);

  const sinPhi = Math.sin(phi);
  const cosPhi = Math.cos(phi);
  const tanPhi = Math.tan(phi);
  const dLam = lam - lam0;

  const nu = (a_O * F0) / Math.sqrt(1 - e2_O * sinPhi * sinPhi);
  const rho = (a_O * F0 * (1 - e2_O)) / (1 - e2_O * sinPhi * sinPhi) ** 1.5;
  const eta2 = nu / rho - 1;
  const M = meridionalArc(phi);

  const E =
    E0 +
    nu * cosPhi * dLam +
    (nu / 6) * cosPhi ** 3 * (nu / rho - tanPhi ** 2) * dLam ** 3 +
    (nu / 120) *
      cosPhi ** 5 *
      (5 - 18 * tanPhi ** 2 + tanPhi ** 4 + 14 * eta2 - 58 * tanPhi ** 2 * eta2) *
      dLam ** 5;

  const N =
    N0 +
    M +
    (nu / 2) * sinPhi * cosPhi * dLam ** 2 +
    (nu / 24) * sinPhi * cosPhi ** 3 * (5 - tanPhi ** 2 + 9 * eta2) * dLam ** 4 +
    (nu / 720) *
      sinPhi *
      cosPhi ** 5 *
      (61 - 58 * tanPhi ** 2 + tanPhi ** 4) *
      dLam ** 6;

  return enToGridRef(E, N);
}
