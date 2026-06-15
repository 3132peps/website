"use client";

interface SyringeVisualProps {
  fillPercentage: number;
  drawVolumeMl: number;
  syringeCapacityMl: number;
  insulinUnits: number;
}

export default function SyringeVisual({
  fillPercentage,
  drawVolumeMl,
  syringeCapacityMl,
  insulinUnits,
}: SyringeVisualProps) {
  const clampedFill = Math.min(fillPercentage, 100);
  const isOverflow = fillPercentage > 100;
  const fillColor = isOverflow ? "#E74C3C" : "#2563EB";

  // Syringe dimensions
  const barrelWidth = 48;
  const barrelHeight = 200;
  const barrelX = 36;
  const barrelY = 30;
  const barrelRadius = 6;

  // Plunger
  const plungerWidth = 38;
  const plungerHandleWidth = 54;

  // Fill area
  const fillHeight = (clampedFill / 100) * barrelHeight;
  const fillY = barrelY + barrelHeight - fillHeight;

  // Graduation marks
  const totalUnits = syringeCapacityMl * 100;
  const majorStep = syringeCapacityMl <= 0.3 ? 5 : 10;
  const minorStep = syringeCapacityMl <= 0.3 ? 1 : 5;

  const majorMarks: number[] = [];
  const minorMarks: number[] = [];

  for (let u = 0; u <= totalUnits; u += minorStep) {
    if (u % majorStep === 0) {
      majorMarks.push(u);
    } else {
      minorMarks.push(u);
    }
  }

  function unitToY(units: number): number {
    const fraction = units / totalUnits;
    return barrelY + barrelHeight - fraction * barrelHeight;
  }

  // Draw indicator position
  const drawUnits = Math.min(insulinUnits, totalUnits);
  const drawY = unitToY(drawUnits);

  return (
    <div className="flex flex-col items-center">
      <svg
        viewBox="0 0 120 280"
        className="h-[260px] w-auto sm:h-[280px]"
        aria-label={`Syringe showing ${fillPercentage.toFixed(1)}% fill`}
        role="img"
      >
        {/* Barrel outline */}
        <rect
          x={barrelX}
          y={barrelY}
          width={barrelWidth}
          height={barrelHeight}
          rx={barrelRadius}
          ry={barrelRadius}
          fill="#f8fafc"
          stroke="#94a3b8"
          strokeWidth={1.5}
        />

        {/* Fill level */}
        {fillHeight > 0 && (
          <clipPath id="barrel-clip">
            <rect
              x={barrelX}
              y={barrelY}
              width={barrelWidth}
              height={barrelHeight}
              rx={barrelRadius}
              ry={barrelRadius}
            />
          </clipPath>
        )}
        {fillHeight > 0 && (
          <rect
            x={barrelX}
            y={fillY}
            width={barrelWidth}
            height={fillHeight}
            fill={fillColor}
            opacity={0.35}
            clipPath="url(#barrel-clip)"
          />
        )}

        {/* Graduation marks - minor */}
        {minorMarks.map((u) => {
          const y = unitToY(u);
          return (
            <line
              key={`minor-${u}`}
              x1={barrelX}
              y1={y}
              x2={barrelX + 8}
              y2={y}
              stroke="#94a3b8"
              strokeWidth={0.75}
            />
          );
        })}

        {/* Graduation marks - major */}
        {majorMarks.map((u) => {
          const y = unitToY(u);
          return (
            <g key={`major-${u}`}>
              <line
                x1={barrelX}
                y1={y}
                x2={barrelX + 14}
                y2={y}
                stroke="#475569"
                strokeWidth={1}
              />
              {u > 0 && (
                <text
                  x={barrelX + 17}
                  y={y + 3}
                  fontSize="8"
                  fill="#475569"
                  fontFamily="monospace"
                >
                  {u}
                </text>
              )}
            </g>
          );
        })}

        {/* Draw indicator line */}
        {drawVolumeMl > 0 && fillPercentage <= 100 && (
          <>
            <line
              x1={barrelX - 6}
              y1={drawY}
              x2={barrelX + barrelWidth + 6}
              y2={drawY}
              stroke={fillColor}
              strokeWidth={1.5}
              strokeDasharray="3,2"
            />
            <polygon
              points={`${barrelX - 6},${drawY - 4} ${barrelX - 6},${drawY + 4} ${barrelX - 1},${drawY}`}
              fill={fillColor}
            />
          </>
        )}

        {/* Needle hub (bottom) */}
        <rect
          x={barrelX + barrelWidth / 2 - 5}
          y={barrelY + barrelHeight}
          width={10}
          height={12}
          rx={2}
          fill="#94a3b8"
        />
        {/* Needle */}
        <line
          x1={barrelX + barrelWidth / 2}
          y1={barrelY + barrelHeight + 12}
          x2={barrelX + barrelWidth / 2}
          y2={barrelY + barrelHeight + 35}
          stroke="#94a3b8"
          strokeWidth={1.5}
          strokeLinecap="round"
        />

        {/* Plunger handle (top) */}
        <rect
          x={barrelX + (barrelWidth - plungerWidth) / 2}
          y={barrelY - 18}
          width={plungerWidth}
          height={18}
          rx={3}
          fill="#cbd5e1"
          stroke="#94a3b8"
          strokeWidth={1}
        />
        <rect
          x={barrelX + (barrelWidth - plungerHandleWidth) / 2}
          y={barrelY - 24}
          width={plungerHandleWidth}
          height={8}
          rx={3}
          fill="#e2e8f0"
          stroke="#94a3b8"
          strokeWidth={1}
        />

        {/* Draw label on right side */}
        {drawVolumeMl > 0 && fillPercentage <= 100 && (
          <text
            x={barrelX + barrelWidth + 10}
            y={drawY + 3}
            fontSize="9"
            fontWeight="600"
            fill={fillColor}
            fontFamily="monospace"
          >
            {insulinUnits.toFixed(1)} IU
          </text>
        )}

        {/* Overflow warning */}
        {isOverflow && (
          <text
            x={60}
            y={barrelY + barrelHeight + 50}
            fontSize="9"
            fontWeight="700"
            fill="#E74C3C"
            textAnchor="middle"
          >
            EXCEEDS CAPACITY
          </text>
        )}
      </svg>

      <p className="mt-1 text-center font-mono text-xs text-muted-foreground">
        {syringeCapacityMl} mL syringe ({(syringeCapacityMl * 100).toFixed(0)}{" "}
        IU)
      </p>
    </div>
  );
}
