"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import {
  calculateReconstitution,
  isReconstitutionError,
  type ReconstitutionResult,
} from "@/lib/calculator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import SyringeVisual from "@/components/SyringeVisual";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PEPTIDE_PRESETS = [2, 5, 10, 15, 20, 30, 50];
const DOSE_PRESETS = [100, 250, 500, 1000];

const SYRINGE_OPTIONS = [
  { label: "0.3 mL (U-100 Insulin)", value: "0.3" },
  { label: "0.5 mL (U-100 Insulin)", value: "0.5" },
  { label: "1.0 mL (U-100 Insulin)", value: "1" },
] as const;

const WATER_MIN = 0.5;
const WATER_MAX = 10;
const WATER_STEP = 0.5;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseNum(val: string | null, fallback: number): number {
  if (!val) return fallback;
  const n = Number(val);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PeptideCalculator() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // --- Initialise state from URL params or defaults -----------------------
  const [peptideMg, setPeptideMg] = useState(() =>
    parseNum(searchParams.get("peptide"), 5),
  );
  const [waterMl, setWaterMl] = useState(() =>
    parseNum(searchParams.get("water"), 2),
  );
  const [doseMcg, setDoseMcg] = useState(() =>
    parseNum(searchParams.get("dose"), 250),
  );
  const [syringeMl, setSyringeMl] = useState(() => {
    const v = searchParams.get("syringe");
    if (v === "0.3" || v === "0.5" || v === "1") return v;
    return "0.5";
  });

  // --- Sync state to URL params -------------------------------------------
  const updateUrl = useCallback(
    (p: number, w: number, d: number, s: string) => {
      const params = new URLSearchParams();
      params.set("peptide", String(p));
      params.set("water", String(w));
      params.set("dose", String(d));
      params.set("syringe", s);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname],
  );

  useEffect(() => {
    updateUrl(peptideMg, waterMl, doseMcg, syringeMl);
  }, [peptideMg, waterMl, doseMcg, syringeMl, updateUrl]);

  // --- Calculate result ---------------------------------------------------
  const result = useMemo(
    () =>
      calculateReconstitution(peptideMg, waterMl, doseMcg, Number(syringeMl)),
    [peptideMg, waterMl, doseMcg, syringeMl],
  );

  const hasError = isReconstitutionError(result);
  const data = hasError ? null : (result as ReconstitutionResult);

  // --- Event handlers -----------------------------------------------------
  function handlePeptideChange(value: string) {
    const n = Number(value);
    if (Number.isFinite(n) && n >= 0) setPeptideMg(n);
  }

  function handleWaterChange(value: string) {
    const n = Number(value);
    if (Number.isFinite(n) && n >= 0) setWaterMl(n);
  }

  function handleDoseChange(value: string) {
    const n = Number(value);
    if (Number.isFinite(n) && n >= 0) setDoseMcg(n);
  }

  function handleWaterSlider(e: React.ChangeEvent<HTMLInputElement>) {
    setWaterMl(Number(e.target.value));
  }

  // --- Render -------------------------------------------------------------
  return (
    <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
      {/* ---- INPUT COLUMN ---- */}
      <div className="space-y-6">
        {/* Peptide amount */}
        <fieldset className="space-y-2">
          <Label htmlFor="peptide-amount">Peptide vial amount (mg)</Label>
          <Input
            id="peptide-amount"
            type="number"
            min={0}
            step="any"
            value={peptideMg || ""}
            onChange={(e) => handlePeptideChange(e.target.value)}
            className="font-mono"
            placeholder="e.g. 5"
          />
          <div className="flex flex-wrap gap-1.5">
            {PEPTIDE_PRESETS.map((mg) => (
              <Button
                key={mg}
                type="button"
                variant={peptideMg === mg ? "default" : "outline"}
                size="sm"
                className="h-7 min-w-[3rem] text-xs"
                onClick={() => setPeptideMg(mg)}
              >
                {mg} mg
              </Button>
            ))}
          </div>
        </fieldset>

        {/* Water volume */}
        <fieldset className="space-y-2">
          <Label htmlFor="water-volume">
            Bacteriostatic water volume (mL)
          </Label>
          <div className="flex items-center gap-3">
            <Input
              id="water-volume"
              type="number"
              min={WATER_MIN}
              max={WATER_MAX}
              step={WATER_STEP}
              value={waterMl || ""}
              onChange={(e) => handleWaterChange(e.target.value)}
              className="w-24 font-mono"
            />
            <span className="shrink-0 text-sm text-muted-foreground">
              {waterMl} mL
            </span>
          </div>
          <input
            type="range"
            min={WATER_MIN}
            max={WATER_MAX}
            step={WATER_STEP}
            value={waterMl}
            onChange={handleWaterSlider}
            className="w-full accent-[#2563EB]"
            aria-label="Water volume slider"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>{WATER_MIN} mL</span>
            <span>{WATER_MAX} mL</span>
          </div>
        </fieldset>

        {/* Desired dose */}
        <fieldset className="space-y-2">
          <Label htmlFor="desired-dose">
            Desired research sample size (mcg)
          </Label>
          <Input
            id="desired-dose"
            type="number"
            min={0}
            step="any"
            value={doseMcg || ""}
            onChange={(e) => handleDoseChange(e.target.value)}
            className="font-mono"
            placeholder="e.g. 250"
          />
          <div className="flex flex-wrap gap-1.5">
            {DOSE_PRESETS.map((mcg) => (
              <Button
                key={mcg}
                type="button"
                variant={doseMcg === mcg ? "default" : "outline"}
                size="sm"
                className="h-7 min-w-[3.5rem] text-xs"
                onClick={() => setDoseMcg(mcg)}
              >
                {mcg} mcg
              </Button>
            ))}
          </div>
        </fieldset>

        {/* Syringe type */}
        <fieldset className="space-y-2">
          <Label>Syringe type</Label>
          <Select value={syringeMl} onValueChange={(v) => { if (v) setSyringeMl(v); }}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SYRINGE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </fieldset>
      </div>

      {/* ---- OUTPUT COLUMN ---- */}
      <div className="space-y-6">
        {hasError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm text-red-800">
            <p className="font-semibold">Calculation Error</p>
            <p className="mt-1">{(result as { error: string }).error}</p>
          </div>
        ) : (
          <>
            {/* Concentration */}
            <div className="rounded-lg border bg-[#1A2439] p-5">
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Solution Concentration
              </p>
              <p className="font-mono text-2xl font-bold text-[#2563EB]">
                {data!.concentrationMcgPerMl.toLocaleString()}{" "}
                <span className="text-base font-normal">mcg/mL</span>
              </p>
              <p className="mt-0.5 font-mono text-sm text-muted-foreground">
                {data!.concentrationMgPerMl} mg/mL
              </p>
            </div>

            {/* Draw details */}
            <div className="grid grid-cols-2 gap-4">
              <ResultCard
                label="Volume to Draw"
                value={`${data!.drawVolumeMl.toFixed(3)} mL`}
              />
              <ResultCard
                label="Insulin Units"
                value={`${data!.insulinUnits.toFixed(1)} IU`}
              />
              <ResultCard
                label="Graduation Mark"
                value={`${data!.graduationMark} IU`}
              />
              <ResultCard
                label="Syringe Usage"
                value={`${data!.syringePercentage.toFixed(1)}%`}
                accent={data!.syringePercentage > 90}
              />
            </div>

            {/* Syringe visual */}
            <div className="flex justify-center rounded-lg border bg-[#121A2B] p-4">
              <SyringeVisual
                fillPercentage={data!.syringePercentage}
                drawVolumeMl={data!.drawVolumeMl}
                syringeCapacityMl={Number(syringeMl)}
                insulinUnits={data!.insulinUnits}
              />
            </div>
          </>
        )}

        {/* Print button */}
        <div className="flex justify-end print:hidden">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="gap-2"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="shrink-0"
            >
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <rect width="12" height="8" x="6" y="14" />
            </svg>
            Print Results
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Result card sub-component
// ---------------------------------------------------------------------------

function ResultCard({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-lg border bg-[#121A2B] p-4">
      <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={`font-mono text-lg font-semibold ${accent ? "text-amber-600" : "text-[#F5F7FB]"}`}
      >
        {value}
      </p>
    </div>
  );
}
