// ---------------------------------------------------------------------------
// 31-32 Peptides -- peptide reconstitution calculator (pure logic, no UI)
// ---------------------------------------------------------------------------

export interface ReconstitutionResult {
  /** Concentration after reconstitution in mcg per mL */
  concentrationMcgPerMl: number;
  /** Concentration after reconstitution in mg per mL */
  concentrationMgPerMl: number;
  /** Volume to draw for the desired dose in mL */
  drawVolumeMl: number;
  /** Equivalent insulin units on the U-100 scale (drawVolumeMl * 100) */
  insulinUnits: number;
  /** Percentage of the syringe capacity used */
  syringePercentage: number;
  /** Which tick-mark on the syringe the draw volume corresponds to */
  graduationMark: number;
}

export interface ReconstitutionError {
  error: string;
}

/**
 * Calculate reconstitution values for a peptide.
 *
 * @param peptideAmountMg   - Total peptide in the vial (mg)
 * @param waterVolumeMl     - Bacteriostatic water added (mL)
 * @param desiredDoseMcg    - Target dose per injection (mcg)
 * @param syringeCapacityMl - Total syringe volume (mL), e.g. 1 for a 1 mL / 100 IU syringe
 * @returns Either the calculated values or an error object
 */
export function calculateReconstitution(
  peptideAmountMg: number,
  waterVolumeMl: number,
  desiredDoseMcg: number,
  syringeCapacityMl: number,
): ReconstitutionResult | ReconstitutionError {
  // --- Input validation ---------------------------------------------------

  if (peptideAmountMg <= 0) {
    return { error: "Peptide amount must be greater than zero." };
  }

  if (waterVolumeMl <= 0) {
    return { error: "Water volume must be greater than zero." };
  }

  if (desiredDoseMcg <= 0) {
    return { error: "Desired dose must be greater than zero." };
  }

  if (syringeCapacityMl <= 0) {
    return { error: "Syringe capacity must be greater than zero." };
  }

  // --- Core calculations --------------------------------------------------

  // Convert peptide mg to mcg (1 mg = 1000 mcg)
  const peptideAmountMcg = peptideAmountMg * 1000;

  // Concentration after reconstitution
  const concentrationMcgPerMl = peptideAmountMcg / waterVolumeMl;
  const concentrationMgPerMl = peptideAmountMg / waterVolumeMl;

  // Volume to draw for the desired dose
  const drawVolumeMl = desiredDoseMcg / concentrationMcgPerMl;

  // Check the draw volume fits in the syringe
  if (drawVolumeMl > syringeCapacityMl) {
    return {
      error: `The required draw volume (${drawVolumeMl.toFixed(3)} mL) exceeds the syringe capacity (${syringeCapacityMl} mL). Use more water to dilute the peptide or choose a larger syringe.`,
    };
  }

  // Insulin units on U-100 scale (100 IU = 1 mL)
  const insulinUnits = drawVolumeMl * 100;

  // Percentage of the syringe capacity
  const syringePercentage = (drawVolumeMl / syringeCapacityMl) * 100;

  // Graduation mark -- round to the nearest whole IU tick
  const graduationMark = Math.round(insulinUnits);

  return {
    concentrationMcgPerMl: round(concentrationMcgPerMl, 2),
    concentrationMgPerMl: round(concentrationMgPerMl, 4),
    drawVolumeMl: round(drawVolumeMl, 4),
    insulinUnits: round(insulinUnits, 2),
    syringePercentage: round(syringePercentage, 2),
    graduationMark,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Helper to check whether a result is an error. */
export function isReconstitutionError(
  result: ReconstitutionResult | ReconstitutionError,
): result is ReconstitutionError {
  return "error" in result;
}

/** Round a number to `decimals` decimal places. */
function round(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
