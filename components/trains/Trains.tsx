"use client";

import { Fragment, useEffect, useMemo } from "react";
import { useMetroStore } from "@/stores/useMetroStore";
import { getLineCurve } from "@/utils/lineCurve";
import { followTarget } from "@/utils/followTarget";
import Train from "./Train";

export default function Trains() {
  const data = useMetroStore((s) => s.data);
  const hiddenLineIds = useMetroStore((s) => s.hiddenLineIds);
  const cameraMode = useMetroStore((s) => s.cameraMode);
  const selectedLineId = useMetroStore((s) => s.selectedLineId);
  const metroVisible = useMetroStore((s) => s.layers.metro);

  // Build curves + arc lengths once per dataset (curves are cached in lineCurve).
  const built = useMemo(() => {
    if (!data) return [];
    return data.lines.map((line, index) => {
      const curve = getLineCurve(line, data, index);
      return { line, curve, length: curve.getLength() };
    });
  }, [data]);

  const visibleLines = built.filter(({ line }) => !hiddenLineIds.has(line.id));

  const followLineId =
    cameraMode === "follow"
      ? selectedLineId && !hiddenLineIds.has(selectedLineId)
        ? selectedLineId
        : visibleLines[0]?.line.id ?? null
      : null;

  // Release the follow target whenever we are not following a valid line.
  useEffect(() => {
    if (!followLineId) followTarget.hasTarget = false;
  }, [followLineId]);

  if (!data || !metroVisible) return null;

  return (
    <group name="trains">
      {visibleLines.map(({ line, curve, length }) => {
        const isFollowLine = line.id === followLineId;
        return (
          <Fragment key={line.id}>
            <Train
              curve={curve}
              length={length}
              color={line.color}
              direction={1}
              phase={0}
              followed={isFollowLine}
            />
            <Train
              curve={curve}
              length={length}
              color={line.color}
              direction={-1}
              phase={1}
              followed={false}
            />
          </Fragment>
        );
      })}
    </group>
  );
}
