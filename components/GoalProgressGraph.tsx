import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import { useAppearance } from '../lib/AppearanceContext';
import type { GoalProgressEntry } from '../lib/goalProgress';
import { isGoalProgressEmpty } from '../lib/goalProgress';

const CHART_HEIGHT = 210;
const PADDING = { top: 16, right: 14, bottom: 38, left: 48 };

function shortDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
}

function valueLabel(value: number) {
  return Number.isInteger(value) ? String(value) : Number(value.toFixed(2)).toString();
}

export function GoalProgressGraph({ entries, targetValue, unit }: {
  entries: GoalProgressEntry[];
  targetValue: number | null;
  unit: string;
}) {
  const { theme } = useAppearance();
  const [width, setWidth] = useState(0);
  const sortedEntries = useMemo(
    () => [...entries].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt)),
    [entries],
  );

  if (isGoalProgressEmpty(sortedEntries)) {
    return (
      <View style={styles.empty}>
        <Text style={[styles.emptyTitle, { color: theme.accent }]}>NO MEASUREMENTS YET</Text>
        <Text style={[styles.emptyCopy, { color: theme.textSecondary }]}>Record a progress measurement to start the graph. No progress is estimated.</Text>
      </View>
    );
  }

  const chartWidth = Math.max(width, 240);
  const plotWidth = chartWidth - PADDING.left - PADDING.right;
  const plotHeight = CHART_HEIGHT - PADDING.top - PADDING.bottom;
  const values = sortedEntries.map((entry) => entry.value);
  if (targetValue !== null) values.push(targetValue);
  let minValue = Math.min(...values);
  let maxValue = Math.max(...values);
  if (minValue === maxValue) {
    const pad = Math.max(Math.abs(minValue) * 0.1, 1);
    minValue -= pad;
    maxValue += pad;
  } else {
    const pad = (maxValue - minValue) * 0.1;
    minValue = Math.max(0, minValue - pad);
    maxValue += pad;
  }

  const xFor = (index: number) => PADDING.left + (sortedEntries.length === 1 ? plotWidth / 2 : index * plotWidth / (sortedEntries.length - 1));
  const yFor = (value: number) => PADDING.top + (maxValue - value) / (maxValue - minValue) * plotHeight;
  const points = sortedEntries.map((entry, index) => ({ x: xFor(index), y: yFor(entry.value), entry }));
  const linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const areaPath = points.length > 1
    ? `${linePath} L ${points[points.length - 1].x} ${PADDING.top + plotHeight} L ${points[0].x} ${PADDING.top + plotHeight} Z`
    : '';
  const dateLabelIndexes = [...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])];
  const tickValues = [maxValue, (maxValue + minValue) / 2, minValue];

  return (
    <View style={styles.wrapper} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {width > 0 ? (
        <Svg width="100%" height={CHART_HEIGHT} viewBox={`0 0 ${chartWidth} ${CHART_HEIGHT}`}>
          {tickValues.map((value, index) => {
            const y = PADDING.top + index * plotHeight / (tickValues.length - 1);
            return (
              <React.Fragment key={`tick-${index}`}>
                <Line x1={PADDING.left} y1={y} x2={chartWidth - PADDING.right} y2={y} stroke={theme.border} strokeWidth={1} opacity={0.65} />
                <SvgText x={PADDING.left - 7} y={y + 4} fill={theme.textSecondary} fontSize={10} textAnchor="end">{valueLabel(value)}</SvgText>
              </React.Fragment>
            );
          })}
          {targetValue !== null ? (
            <>
              <Line x1={PADDING.left} y1={yFor(targetValue)} x2={chartWidth - PADDING.right} y2={yFor(targetValue)} stroke={theme.warning} strokeWidth={1.5} strokeDasharray="5 4" />
              <SvgText x={chartWidth - PADDING.right} y={yFor(targetValue) - 5} fill={theme.warning} fontSize={9} textAnchor="end">TARGET {valueLabel(targetValue)}</SvgText>
            </>
          ) : null}
          {areaPath ? <Path d={areaPath} fill={theme.accent} fillOpacity={0.14} /> : null}
          <Path d={linePath} fill="none" stroke={theme.accent} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
          {points.map((point) => <Circle key={point.entry.id} cx={point.x} cy={point.y} r={4} fill={theme.background} stroke={theme.accent} strokeWidth={2} />)}
          {dateLabelIndexes.map((index) => (
            <SvgText key={`date-${index}`} x={points[index].x} y={CHART_HEIGHT - 12} fill={theme.textSecondary} fontSize={10} textAnchor="middle">
              {shortDate(points[index].entry.recordedAt)}
            </SvgText>
          ))}
        </Svg>
      ) : null}
      <View style={styles.axisCaptionRow}>
        <Text style={[styles.axisCaption, { color: theme.textSecondary }]}>RECORDED VALUE{unit ? ` (${unit})` : ''}</Text>
        <Text style={[styles.axisCaption, { color: theme.accent }]}>{points.length} {points.length === 1 ? 'ENTRY' : 'ENTRIES'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { width: '100%', marginTop: 8 },
  empty: { paddingVertical: 22, paddingHorizontal: 14, alignItems: 'center', gap: 7 },
  emptyTitle: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  emptyCopy: { fontSize: 12, lineHeight: 18, textAlign: 'center', maxWidth: 380 },
  axisCaptionRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 },
  axisCaption: { fontSize: 8, fontWeight: '800', letterSpacing: 0.8 },
});
