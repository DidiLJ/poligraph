export interface HemicycleGroupInput {
  code: string;
  color: string;
  seats: number;
}

export interface HemicycleSeat {
  x: number;
  y: number;
  groupCode: string;
  groupColor: string;
  seatIndex: number; // global index (0-based) for mapping to deputy data
}

interface LayoutOptions {
  width?: number;
  height?: number;
  rows?: number;
  innerRadiusRatio?: number; // 0-1, how far in the first row starts
}

/**
 * Compute seat positions for a hemicycle (semicircle) layout.
 *
 * Groups are placed left (pi) to right (0) in the order they appear.
 * Seats fill concentric rows from inside out, with each row being a 180-degree arc.
 *
 * Coordinate system: (0,0) is top-left, hemicycle opens downward.
 * Center of arcs is at (width/2, height).
 */
export function computeHemicycleLayout(
  groups: HemicycleGroupInput[],
  options: LayoutOptions = {}
): HemicycleSeat[] {
  const { width = 800, height = 400, rows = 12, innerRadiusRatio = 0.35 } = options;

  const totalSeats = groups.reduce((sum, g) => sum + g.seats, 0);
  if (totalSeats === 0) return [];

  const cx = width / 2;
  const cy = height; // center at bottom
  const maxRadius = Math.min(width / 2, height) * 0.95;
  const minRadius = maxRadius * innerRadiusRatio;

  // Distribute seats across rows. Outer rows get more seats (proportional to radius).
  const rowRadii: number[] = [];
  for (let r = 0; r < rows; r++) {
    rowRadii.push(minRadius + (maxRadius - minRadius) * (r / (rows - 1)));
  }

  // Weight each row by its circumference (radius)
  const totalWeight = rowRadii.reduce((sum, r) => sum + r, 0);
  const seatsPerRow = rowRadii.map((r) => Math.round((r / totalWeight) * totalSeats));

  // Adjust rounding errors: add/remove from largest row
  const diff = totalSeats - seatsPerRow.reduce((sum, n) => sum + n, 0);
  const largestRowIdx = seatsPerRow.indexOf(Math.max(...seatsPerRow));
  seatsPerRow[largestRowIdx] += diff;

  // Per-group per-row seat count
  const groupRowSeats: number[][] = groups.map((group) =>
    seatsPerRow.map((rowTotal) => Math.round((group.seats / totalSeats) * rowTotal))
  );

  // Fix rounding errors per row (ensure each row sums to seatsPerRow[r])
  for (let r = 0; r < rows; r++) {
    const rowSum = groupRowSeats.reduce((sum, g) => sum + g[r], 0);
    let rowDiff = seatsPerRow[r] - rowSum;
    while (rowDiff !== 0) {
      const adjust = rowDiff > 0 ? 1 : -1;
      let bestIdx = 0;
      let bestCount = -1;
      for (let g = 0; g < groups.length; g++) {
        if (groupRowSeats[g][r] + adjust >= 0 && groups[g].seats > bestCount) {
          bestCount = groups[g].seats;
          bestIdx = g;
        }
      }
      groupRowSeats[bestIdx][r] += adjust;
      rowDiff -= adjust;
    }
  }

  // Fix per-group totals: ensure sum across rows matches requested group.seats
  for (let g = 0; g < groups.length; g++) {
    const groupTotal = groupRowSeats[g].reduce((sum, n) => sum + n, 0);
    let groupDiff = groups[g].seats - groupTotal;
    // Pick a partner group to swap seats with (largest other group)
    const partnerIdx = groups
      .map((gr, i) => ({ i, seats: gr.seats }))
      .filter(({ i }) => i !== g)
      .sort((a, b) => b.seats - a.seats)[0]?.i;
    while (groupDiff !== 0 && partnerIdx !== undefined) {
      const adjust = groupDiff > 0 ? 1 : -1;
      // Find best row to adjust (prefer rows where partner has surplus)
      let bestRow = -1;
      let bestRowSize = -1;
      for (let r = 0; r < rows; r++) {
        if (adjust > 0 && groupRowSeats[partnerIdx][r] > 0 && seatsPerRow[r] > bestRowSize) {
          bestRow = r;
          bestRowSize = seatsPerRow[r];
        } else if (adjust < 0 && groupRowSeats[g][r] > 0 && seatsPerRow[r] > bestRowSize) {
          bestRow = r;
          bestRowSize = seatsPerRow[r];
        }
      }
      if (bestRow === -1) break;
      groupRowSeats[g][bestRow] += adjust;
      groupRowSeats[partnerIdx][bestRow] -= adjust;
      groupDiff -= adjust;
    }
  }

  // Place seats
  const seats: HemicycleSeat[] = [];
  let globalIndex = 0;

  for (let r = 0; r < rows; r++) {
    const radius = rowRadii[r];
    const padding = 0.03;
    const arcStart = Math.PI - padding;
    const arcEnd = padding;

    let seatCursor = 0;
    const rowTotal = seatsPerRow[r];

    for (let g = 0; g < groups.length; g++) {
      const count = groupRowSeats[g][r];
      for (let s = 0; s < count; s++) {
        const seatPosition = seatCursor + 0.5;
        const angle = arcStart - (seatPosition / rowTotal) * (arcStart - arcEnd);
        seats.push({
          x: cx + radius * Math.cos(angle),
          y: cy - radius * Math.sin(angle),
          groupCode: groups[g].code,
          groupColor: groups[g].color,
          seatIndex: globalIndex++,
        });
        seatCursor++;
      }
    }
  }

  return seats;
}
