// Shortest-path route finder over the station adjacency graph (graph.json).
//
// The graph is keyed by station *name*; we resolve to Station records (which
// carry line membership + coordinates) to weight edges by real geographic
// distance and to penalise line changes, so the result prefers few transfers.
import { haversineKm } from "@/utils/geo";
import type { MetroData, RoutePlan, RouteSegment, Station } from "@/types/metro";

/** Extra distance (km) charged for changing lines, to discourage transfers. */
const TRANSFER_PENALTY_KM = 4;

interface HeapItem {
  key: string; // `${stationName}\u0000${lineId}`
  cost: number;
}

/** Minimal binary min-heap keyed by cost. */
class MinHeap {
  private items: HeapItem[] = [];

  get size(): number {
    return this.items.length;
  }

  push(item: HeapItem): void {
    const a = this.items;
    a.push(item);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].cost <= a[i].cost) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }

  pop(): HeapItem | undefined {
    const a = this.items;
    if (a.length === 0) return undefined;
    const top = a[0];
    const last = a.pop()!;
    if (a.length > 0) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let s = i;
        if (l < a.length && a[l].cost < a[s].cost) s = l;
        if (r < a.length && a[r].cost < a[s].cost) s = r;
        if (s === i) break;
        [a[s], a[i]] = [a[i], a[s]];
        i = s;
      }
    }
    return top;
  }
}

function sharedLines(a: Station, b: Station): string[] {
  return a.lines.filter((l) => b.lines.includes(l));
}

const NONE = "\u0000none";
const stateKey = (name: string, lineId: string) => `${name}\u0000${lineId}`;

/**
 * Finds the lowest-cost journey between two stations, minimising travel distance
 * plus transfer penalties. Returns null if no path exists.
 */
export function findRoute(
  fromId: string,
  toId: string,
  data: MetroData
): RoutePlan | null {
  const { graph, stationsById, stationsByName } = data;
  const from = stationsById[fromId];
  const to = stationsById[toId];
  if (!from || !to || from.id === to.id) return null;

  const dist = new Map<string, number>();
  const prev = new Map<string, { key: string; name: string; lineId: string }>();
  const heap = new MinHeap();

  const startKey = stateKey(from.name, NONE);
  dist.set(startKey, 0);
  heap.push({ key: startKey, cost: 0 });

  // Parse a state key back into (name, lineId).
  const parse = (key: string): [string, string] => {
    const idx = key.indexOf("\u0000");
    return [key.slice(0, idx), key.slice(idx + 1)];
  };

  let endKey: string | null = null;

  while (heap.size > 0) {
    const cur = heap.pop()!;
    if (cur.cost > (dist.get(cur.key) ?? Infinity)) continue;
    const [name, lineId] = parse(cur.key);
    if (name === to.name) {
      endKey = cur.key;
      break;
    }
    const station = stationsByName[name];
    if (!station) continue;

    for (const neighborName of graph[name] ?? []) {
      const neighbor = stationsByName[neighborName];
      if (!neighbor) continue;
      const edgeKm = haversineKm(
        [station.lng, station.lat],
        [neighbor.lng, neighbor.lat]
      );
      for (const nextLine of sharedLines(station, neighbor)) {
        const transfer = lineId !== NONE && nextLine !== lineId;
        const cost =
          cur.cost + edgeKm + (transfer ? TRANSFER_PENALTY_KM : 0);
        const nk = stateKey(neighborName, nextLine);
        if (cost < (dist.get(nk) ?? Infinity)) {
          dist.set(nk, cost);
          prev.set(nk, { key: cur.key, name, lineId });
          heap.push({ key: nk, cost });
        }
      }
    }
  }

  if (!endKey) return null;

  // Reconstruct the (name, lineId) chain from end to start.
  const chain: { name: string; lineId: string }[] = [];
  let k: string | null = endKey;
  while (k) {
    const [name, lineId] = parse(k);
    chain.push({ name, lineId });
    const p = prev.get(k);
    k = p ? p.key : null;
  }
  chain.reverse();

  const stationIds = chain
    .map((c) => stationsByName[c.name]?.id)
    .filter((id): id is string => Boolean(id));

  // Build single-line segments. Each hop i uses chain[i+1].lineId (the line
  // boarded to travel from station i to i+1).
  const segments: RouteSegment[] = [];
  const interchangeIds: string[] = [];
  let distanceKm = 0;

  for (let i = 1; i < chain.length; i++) {
    const lineId = chain[i].lineId;
    const prevStation = stationsByName[chain[i - 1].name];
    const curStation = stationsByName[chain[i].name];
    if (prevStation && curStation) {
      distanceKm += haversineKm(
        [prevStation.lng, prevStation.lat],
        [curStation.lng, curStation.lat]
      );
    }
    const last = segments[segments.length - 1];
    if (last && last.lineId === lineId) {
      last.stationIds.push(curStation!.id);
    } else {
      if (last) interchangeIds.push(prevStation!.id);
      segments.push({ lineId, stationIds: [prevStation!.id, curStation!.id] });
    }
  }

  return {
    fromId: from.id,
    toId: to.id,
    stationIds,
    segments,
    interchangeIds,
    transfers: Math.max(0, segments.length - 1),
    numStops: Math.max(0, stationIds.length - 1),
    distanceKm,
  };
}
