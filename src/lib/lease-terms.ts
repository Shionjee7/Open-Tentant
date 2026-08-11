import { getSetting } from "./data";
import { DEFAULT_LEASE_TERMS, type LeaseTerms } from "./lease-document";

/** Setting keys backing the lease terms, so Settings and the document agree. */
export const LEASE_TERM_KEYS = [
  "lease_late_fee",
  "lease_late_after_days",
  "lease_eviction_after_days",
  "lease_key_fee",
  "lease_cleaning_fee",
  "lease_notice_days",
  "lease_smoking_fee",
  "lease_detector_fee",
  "lease_winter_surcharge",
  "lease_winter_months",
  "lease_pets_allowed",
  "lease_house_rules",
  "lease_state",
] as const;

function num(value: string, fallback: number): number {
  const parsed = Number(value);
  return value !== "" && Number.isFinite(parsed) ? parsed : fallback;
}

/** Reads the landlord's lease terms, falling back to sensible defaults. */
export async function loadLeaseTerms(): Promise<LeaseTerms> {
  const [
    lateFee, lateAfter, evictAfter, keyFee, cleaning, notice,
    smoking, detector, winter, winterMonths, pets, rules, state,
  ] = await Promise.all(LEASE_TERM_KEYS.map((key) => getSetting(key)));

  return {
    lateFeeAmount: num(lateFee, DEFAULT_LEASE_TERMS.lateFeeAmount),
    lateFeeAfterDays: num(lateAfter, DEFAULT_LEASE_TERMS.lateFeeAfterDays),
    evictionAfterDays: num(evictAfter, DEFAULT_LEASE_TERMS.evictionAfterDays),
    keyReplacementFee: num(keyFee, DEFAULT_LEASE_TERMS.keyReplacementFee),
    cleaningFee: num(cleaning, DEFAULT_LEASE_TERMS.cleaningFee),
    noticeDays: num(notice, DEFAULT_LEASE_TERMS.noticeDays),
    smokingInsideFee: num(smoking, DEFAULT_LEASE_TERMS.smokingInsideFee),
    detectorTamperFee: num(detector, DEFAULT_LEASE_TERMS.detectorTamperFee),
    winterSurcharge: num(winter, DEFAULT_LEASE_TERMS.winterSurcharge),
    winterMonths: winterMonths || DEFAULT_LEASE_TERMS.winterMonths,
    petsAllowed: pets === "true",
    houseRules: rules,
    governingState: state,
  };
}
