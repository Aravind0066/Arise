import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import Svg, { Polygon, Line, Circle, G } from 'react-native-svg';
import { HunterStats } from '../lib/hunterTypes';

interface PentagonChartProps {
  stats: HunterStats;
  size?: number;
}

const STAT_CONFIG = [
  { key: 'strength', label: 'STR', full: 'STRENGTH', color: '#ff5376', icon: '⚔️' },
  { key: 'knowledge', label: 'KNW', full: 'KNOWLEDGE', color: '#6de7ff', icon: '📜' },
  { key: 'discipline', label: 'DIS', full: 'DISCIPLINE', color: '#fbb03b', icon: '🛡️' },
  { key: 'health', label: 'HLT', full: 'HEALTH', color: '#38ef7d', icon: '💧' },
  { key: 'mindfulness', label: 'MND', full: 'MINDFUL', color: '#c084fc', icon: '🧘' },
] as const;

export function PentagonChart({ stats, size = 300 }: PentagonChartProps) {
  const center = size / 2;
  const radius = size * 0.36; // Keep room for labels

  // Angles for regular pentagon: top (-90°), top-right, bottom-right, bottom-left, top-left
  const angles = [-Math.PI / 2, -Math.PI / 2 + (2 * Math.PI) / 5, -Math.PI / 2 + (4 * Math.PI) / 5, -Math.PI / 2 + (6 * Math.PI) / 5, -Math.PI / 2 + (8 * Math.PI) / 5];

  // Helper to get coordinates
  const getCoords = (r: number, angle: number) => {
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
    };
  };

  // Grid levels (25%, 50%, 75%, 100%)
  const gridRings = [0.25, 0.5, 0.75, 1.0].map((fraction) => {
    const points = angles.map((a) => {
      const { x, y } = getCoords(radius * fraction, a);
      return `${x},${y}`;
    }).join(' ');
    return { points, fraction };
  });

  // User stat coordinates
  const statValues = [
    stats.strength || 30,
    stats.knowledge || 30,
    stats.discipline || 30,
    stats.health || 30,
    stats.mindfulness || 30,
  ];

  const dataPoints = statValues.map((val, idx) => {
    const clamped = Math.max(12, Math.min(100, val));
    const r = radius * (clamped / 100);
    return getCoords(r, angles[idx]);
  });

  const polygonPointsStr = dataPoints.map((p) => `${p.x},${p.y}`).join(' ');

  // Label coordinates (positioned slightly outside outer ring)
  const labelPositions = angles.map((a, idx) => {
    const labelRadius = radius + 32;
    const { x, y } = getCoords(labelRadius, a);
    return { x, y, conf: STAT_CONFIG[idx], value: statValues[idx] };
  });

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <G>
          {/* Concentric grid rings */}
          {gridRings.map((ring, i) => (
            <Polygon
              key={`grid-${i}`}
              points={ring.points}
              fill={i === 3 ? 'rgba(7, 26, 45, 0.45)' : 'none'}
              stroke="#183652"
              strokeWidth={i === 3 ? 1.5 : 1}
              strokeDasharray={i < 3 ? '3,3' : undefined}
            />
          ))}

          {/* Radial axis lines from center */}
          {angles.map((a, i) => {
            const outer = getCoords(radius, a);
            return (
              <Line
                key={`axis-${i}`}
                x1={center}
                y1={center}
                x2={outer.x}
                y2={outer.y}
                stroke="#1c4164"
                strokeWidth={1}
              />
            );
          })}

          {/* Central core node */}
          <Circle cx={center} cy={center} r={3} fill="#4887b0" />

          {/* User Stats Filled Polygon */}
          <Polygon
            points={polygonPointsStr}
            fill="rgba(0, 243, 255, 0.22)"
            stroke="#00f3ff"
            strokeWidth={2.5}
            strokeLinejoin="round"
          />

          {/* Neon Purple Inner Echo Polygon for HUD depth */}
          <Polygon
            points={polygonPointsStr}
            fill="none"
            stroke="rgba(192, 132, 252, 0.6)"
            strokeWidth={1.2}
            strokeDasharray="4,4"
          />

          {/* Vertices indicator dots */}
          {dataPoints.map((p, idx) => (
            <G key={`vertex-${idx}`}>
              <Circle cx={p.x} cy={p.y} r={6} fill="rgba(0, 243, 255, 0.3)" />
              <Circle cx={p.x} cy={p.y} r={3.5} fill="#ffffff" stroke="#00f3ff" strokeWidth={1.5} />
            </G>
          ))}
        </G>
      </Svg>

      {/* Floating Labels placed absolute over SVG */}
      {labelPositions.map((item, idx) => {
        // Adjust offset for centering text around coordinates
        const isTop = idx === 0;
        const isRight = idx === 1 || idx === 2;
        const isLeft = idx === 3 || idx === 4;

        let leftPos = item.x - 42;
        let topPos = item.y - 18;
        if (isTop) topPos -= 6;
        if (isRight) leftPos += 6;
        if (isLeft) leftPos -= 6;

        return (
          <View
            key={`lbl-${idx}`}
            style={[
              styles.statLabelWrapper,
              {
                left: Math.max(0, Math.min(size - 84, leftPos)),
                top: Math.max(0, Math.min(size - 36, topPos)),
              },
            ]}
          >
            <Text style={[styles.statName, { color: item.conf.color }]}>
              {item.conf.icon} {item.conf.label}
            </Text>
            <Text style={styles.statScore}>{item.value}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'center',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 10,
  },
  statLabelWrapper: {
    position: 'absolute',
    width: 84,
    alignItems: 'center',
    backgroundColor: 'rgba(5, 14, 26, 0.85)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#193955',
  },
  statName: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  statScore: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
    marginTop: 1,
  },
});
