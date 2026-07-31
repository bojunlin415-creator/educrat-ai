export type DashboardChartKind = "bar" | "line" | "ranking";

export interface DashboardChartPoint {
  readonly label: string;
  readonly value: number;
}

export interface DashboardChartModel {
  readonly kind: DashboardChartKind;
  readonly points: readonly DashboardChartPoint[];
  readonly title: string;
}

export interface DashboardChartAdapter<Output> {
  readonly adapterName: string;
  render(model: DashboardChartModel): Output;
}

export function createChartModel(input: {
  readonly kind: DashboardChartKind;
  readonly points: readonly DashboardChartPoint[];
  readonly title: string;
}): DashboardChartModel {
  return Object.freeze({
    kind: input.kind,
    points: Object.freeze(
      input.points.map((point) =>
        Object.freeze({
          label: point.label,
          value: Number(point.value.toFixed(4)),
        }),
      ),
    ),
    title: input.title,
  });
}
