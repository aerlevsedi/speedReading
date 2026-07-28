import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from "recharts";
import type { ProgressPoint } from "@/types";

interface Props {
  points: ProgressPoint[];
  goalWpm?: number | null;
  variant?: "full" | "compact";
}

interface ChartDatum {
  index: number;
  label: string;
  wpm: number;
}

const LINE_COLOR = "#60a5fa"; // blue-400
const GOAL_COLOR = "#f59e0b"; // amber-500
const AXIS_COLOR = "rgba(191, 219, 254, 0.6)"; // blue-100/60

function formatLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Focus Sprint WPM progress chart (S-05, FR-014). Assumes >= 2 points — parents
 * gate cold-start and render a placeholder for fewer. Renders client-only.
 */
export default function ProgressChart({ points, goalWpm, variant = "full" }: Props) {
  const compact = variant === "compact";
  const hasGoal = typeof goalWpm === "number" && Number.isFinite(goalWpm) && goalWpm > 0;

  const data: ChartDatum[] = points.map((point, index) => ({
    index,
    label: formatLabel(point.completedAt),
    wpm: point.wpm,
  }));

  const lastIndex = data.length - 1;

  return (
    <div style={{ width: "100%", height: compact ? 96 : 240 }} data-testid="progress-chart">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: compact ? 0 : 8, left: compact ? 0 : 4 }}>
          {!compact && <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />}
          <XAxis
            dataKey="label"
            hide={compact}
            stroke={AXIS_COLOR}
            tick={{ fill: AXIS_COLOR, fontSize: 12 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            hide={compact}
            stroke={AXIS_COLOR}
            tick={{ fill: AXIS_COLOR, fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={36}
            domain={["dataMin - 20", "dataMax + 20"]}
            allowDecimals={false}
          />
          {!compact && (
            <Tooltip
              contentStyle={{
                background: "rgba(15, 23, 42, 0.95)",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: 12,
                color: "#fff",
              }}
              labelStyle={{ color: AXIS_COLOR }}
              formatter={(value: number) => [`${value} WPM`, "Reading speed"]}
            />
          )}
          {hasGoal && (
            <ReferenceLine
              y={goalWpm}
              stroke={GOAL_COLOR}
              strokeDasharray="6 4"
              label={
                compact
                  ? undefined
                  : { value: `Goal ${goalWpm}`, position: "insideTopRight", fill: GOAL_COLOR, fontSize: 12 }
              }
            />
          )}
          <Line
            type="monotone"
            dataKey="wpm"
            stroke={LINE_COLOR}
            strokeWidth={2}
            dot={compact ? false : { r: 3, fill: LINE_COLOR, strokeWidth: 0 }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
          {/* Emphasize the most recent (current) session */}
          {!compact && lastIndex >= 0 && (
            <ReferenceLine x={data[lastIndex].label} stroke="rgba(255,255,255,0.15)" strokeDasharray="2 4" />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
