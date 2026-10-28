import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { ExerciseIllustrationType } from '../lib/hunterTypes';
import { useAppearance } from '../lib/AppearanceContext';

interface ExerciseIllustrationProps {
  type: ExerciseIllustrationType;
  size?: number;
  isActive?: boolean;
}

export function ExerciseIllustration({
  type,
  size = 220,
  isActive = true,
}: ExerciseIllustrationProps) {
  const { theme } = useAppearance();
  const primaryColor = isActive ? theme.accent : theme.textSecondary;
  const secondaryColor = isActive ? theme.purple : theme.border;
  const accentColor = isActive ? theme.error : theme.border;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox="0 0 200 200">
        <Defs>
          <LinearGradient id="cyanPurple" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={theme.accent} stopOpacity={0.8} />
            <Stop offset="100%" stopColor={theme.purple} stopOpacity={0.8} />
          </LinearGradient>
          <LinearGradient id="glowBack" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor={theme.surfaceAlt} stopOpacity={0.4} />
            <Stop offset="100%" stopColor={theme.background} stopOpacity={0.8} />
          </LinearGradient>
        </Defs>

        {/* Ambient background grid circle */}
        <Circle cx="100" cy="100" r="90" fill="url(#glowBack)" stroke={theme.border} strokeWidth="1.5" />
        <Circle cx="100" cy="100" r="75" stroke={theme.border} strokeWidth="1" strokeDasharray="4 4" />
        <Line x1="10" y1="100" x2="190" y2="100" stroke={theme.border} strokeWidth="0.8" opacity={0.4} />
        <Line x1="100" y1="10" x2="100" y2="190" stroke={theme.border} strokeWidth="0.8" opacity={0.4} />

        {/* Outer tech brackets */}
        <Path d="M 25 45 L 25 25 L 45 25" stroke={primaryColor} strokeWidth="2" fill="none" opacity={0.7} />
        <Path d="M 175 45 L 175 25 L 155 25" stroke={primaryColor} strokeWidth="2" fill="none" opacity={0.7} />
        <Path d="M 25 155 L 25 175 L 45 175" stroke={primaryColor} strokeWidth="2" fill="none" opacity={0.7} />
        <Path d="M 175 155 L 175 175 L 155 175" stroke={primaryColor} strokeWidth="2" fill="none" opacity={0.7} />

        {/* Dynamic Movement Illustrations */}
        {type === 'pushup' && (
          <G>
            {/* Ground line */}
            <Line x1="30" y1="150" x2="170" y2="150" stroke={theme.border} strokeWidth="2" />
            {/* Feet contact */}
            <Circle cx="45" cy="146" r="4" fill={accentColor} />
            {/* Hands contact */}
            <Circle cx="145" cy="146" r="4" fill={primaryColor} />
            {/* Arm straight */}
            <Line x1="145" y1="146" x2="140" y2="110" stroke={primaryColor} strokeWidth="5" strokeLinecap="round" />
            {/* Torso & Legs line */}
            <Line x1="45" y1="146" x2="140" y2="105" stroke="url(#cyanPurple)" strokeWidth="6" strokeLinecap="round" />
            {/* Head */}
            <Circle cx="155" cy="98" r="9" fill={primaryColor} />
            {/* Chest tension node */}
            <Circle cx="130" cy="115" r="5" fill={theme.error} />
          </G>
        )}

        {type === 'squat' && (
          <G>
            {/* Ground */}
            <Line x1="40" y1="165" x2="160" y2="165" stroke={theme.border} strokeWidth="2" />
            {/* Feet */}
            <Circle cx="75" cy="163" r="4" fill={primaryColor} />
            <Circle cx="125" cy="163" r="4" fill={primaryColor} />
            {/* Shin */}
            <Line x1="75" y1="163" x2="80" y2="128" stroke={primaryColor} strokeWidth="5" strokeLinecap="round" />
            <Line x1="125" y1="163" x2="120" y2="128" stroke={primaryColor} strokeWidth="5" strokeLinecap="round" />
            {/* Thigh (horizontal squat angle) */}
            <Line x1="80" y1="128" x2="95" y2="126" stroke="url(#cyanPurple)" strokeWidth="6" strokeLinecap="round" />
            <Line x1="120" y1="128" x2="105" y2="126" stroke="url(#cyanPurple)" strokeWidth="6" strokeLinecap="round" />
            {/* Pelvis & Spine (Torso upright) */}
            <Line x1="100" y1="126" x2="100" y2="78" stroke="url(#cyanPurple)" strokeWidth="6" strokeLinecap="round" />
            {/* Arms extended front */}
            <Line x1="100" y1="88" x2="65" y2="88" stroke={secondaryColor} strokeWidth="4" strokeLinecap="round" />
            {/* Head */}
            <Circle cx="100" cy="65" r="10" fill={primaryColor} />
            {/* Quad power nodes */}
            <Circle cx="88" cy="127" r="4" fill={theme.error} />
            <Circle cx="112" cy="127" r="4" fill={theme.error} />
          </G>
        )}

        {type === 'plank' && (
          <G>
            {/* Ground line */}
            <Line x1="25" y1="150" x2="175" y2="150" stroke={theme.border} strokeWidth="2" />
            {/* Elbow & Forearm flat on floor */}
            <Line x1="130" y1="150" x2="155" y2="150" stroke={primaryColor} strokeWidth="5" strokeLinecap="round" />
            {/* Upper arm vertical */}
            <Line x1="130" y1="150" x2="130" y2="115" stroke={primaryColor} strokeWidth="5" strokeLinecap="round" />
            {/* Straight rigid body line */}
            <Line x1="45" y1="145" x2="130" y2="115" stroke="url(#cyanPurple)" strokeWidth="6" strokeLinecap="round" />
            {/* Feet */}
            <Circle cx="45" cy="146" r="4" fill={accentColor} />
            {/* Head */}
            <Circle cx="146" cy="108" r="9" fill={primaryColor} />
            {/* Core activation matrix pulse */}
            <Circle cx="90" cy="128" r="6" fill={theme.accent} opacity={0.9} />
            <Circle cx="90" cy="128" r="12" stroke={theme.accent} strokeWidth="1" strokeDasharray="3 3" />
          </G>
        )}

        {type === 'jumping_jack' && (
          <G>
            {/* Dynamic Star Stance */}
            <Line x1="100" y1="105" x2="65" y2="160" stroke={primaryColor} strokeWidth="5" strokeLinecap="round" />
            <Line x1="100" y1="105" x2="135" y2="160" stroke={primaryColor} strokeWidth="5" strokeLinecap="round" />
            {/* Spine */}
            <Line x1="100" y1="105" x2="100" y2="70" stroke="url(#cyanPurple)" strokeWidth="6" strokeLinecap="round" />
            {/* Raised arms diagonal overhead */}
            <Line x1="100" y1="75" x2="60" y2="40" stroke={secondaryColor} strokeWidth="5" strokeLinecap="round" />
            <Line x1="100" y1="75" x2="140" y2="40" stroke={secondaryColor} strokeWidth="5" strokeLinecap="round" />
            {/* Head */}
            <Circle cx="100" cy="55" r="9" fill={primaryColor} />
            {/* Kinetic aura arcs */}
            <Path d="M 50 35 Q 40 50 45 70" stroke={theme.error} strokeWidth="2" fill="none" />
            <Path d="M 150 35 Q 160 50 155 70" stroke={theme.error} strokeWidth="2" fill="none" />
          </G>
        )}

        {type === 'lunge' && (
          <G>
            <Line x1="30" y1="165" x2="170" y2="165" stroke={theme.border} strokeWidth="2" />
            {/* Front Leg (bent 90 deg) */}
            <Line x1="135" y1="165" x2="135" y2="125" stroke={primaryColor} strokeWidth="5" strokeLinecap="round" />
            <Line x1="135" y1="125" x2="100" y2="120" stroke="url(#cyanPurple)" strokeWidth="5" strokeLinecap="round" />
            {/* Back Leg (knee down) */}
            <Line x1="60" y1="162" x2="65" y2="140" stroke={secondaryColor} strokeWidth="5" strokeLinecap="round" />
            <Line x1="65" y1="140" x2="100" y2="120" stroke={secondaryColor} strokeWidth="5" strokeLinecap="round" />
            {/* Torso straight upright */}
            <Line x1="100" y1="120" x2="100" y2="72" stroke="url(#cyanPurple)" strokeWidth="6" strokeLinecap="round" />
            {/* Head */}
            <Circle cx="100" cy="58" r="9" fill={primaryColor} />
            {/* Balance power node */}
            <Circle cx="135" cy="125" r="5" fill={theme.success} />
          </G>
        )}

        {type === 'mountain_climber' && (
          <G>
            <Line x1="30" y1="155" x2="170" y2="155" stroke={theme.border} strokeWidth="2" />
            {/* Arms supporting */}
            <Line x1="140" y1="155" x2="135" y2="105" stroke={primaryColor} strokeWidth="5" strokeLinecap="round" />
            {/* Torso */}
            <Line x1="60" y1="130" x2="135" y2="105" stroke="url(#cyanPurple)" strokeWidth="6" strokeLinecap="round" />
            {/* Back leg extended */}
            <Line x1="60" y1="130" x2="45" y2="153" stroke={secondaryColor} strokeWidth="5" strokeLinecap="round" />
            {/* Drive knee tucked under chest */}
            <Line x1="60" y1="130" x2="105" y2="120" stroke={theme.accent} strokeWidth="5" strokeLinecap="round" />
            <Line x1="105" y1="120" x2="100" y2="140" stroke={theme.accent} strokeWidth="5" strokeLinecap="round" />
            {/* Head */}
            <Circle cx="150" cy="98" r="9" fill={primaryColor} />
            {/* Agility velocity arrow */}
            <Line x1="85" y1="110" x2="115" y2="102" stroke={theme.error} strokeWidth="2.5" strokeLinecap="round" />
          </G>
        )}

        {(type === 'burpee' || type === 'pullup') && (
          <G>
            {/* Explosive vertical leap */}
            <Line x1="50" y1="175" x2="150" y2="175" stroke={theme.border} strokeWidth="2" strokeDasharray="4 4" />
            <Line x1="100" y1="140" x2="85" y2="100" stroke={primaryColor} strokeWidth="5" strokeLinecap="round" />
            <Line x1="100" y1="140" x2="115" y2="100" stroke={primaryColor} strokeWidth="5" strokeLinecap="round" />
            <Line x1="100" y1="100" x2="100" y2="60" stroke="url(#cyanPurple)" strokeWidth="6" strokeLinecap="round" />
            <Line x1="100" y1="65" x2="70" y2="35" stroke={secondaryColor} strokeWidth="5" strokeLinecap="round" />
            <Line x1="100" y1="65" x2="130" y2="35" stroke={secondaryColor} strokeWidth="5" strokeLinecap="round" />
            <Circle cx="100" cy="48" r="9" fill={primaryColor} />
            {/* Propulsion arrows */}
            <Line x1="90" y1="155" x2="90" y2="168" stroke={theme.accent} strokeWidth="2" />
            <Line x1="110" y1="155" x2="110" y2="168" stroke={theme.accent} strokeWidth="2" />
          </G>
        )}

        {type === 'crunch' && (
          <G>
            <Line x1="30" y1="155" x2="170" y2="155" stroke={theme.border} strokeWidth="2" />
            {/* Lower back flat */}
            <Line x1="60" y1="153" x2="100" y2="153" stroke="url(#cyanPurple)" strokeWidth="6" strokeLinecap="round" />
            {/* Knees bent */}
            <Line x1="100" y1="153" x2="130" y2="115" stroke={secondaryColor} strokeWidth="5" strokeLinecap="round" />
            <Line x1="130" y1="115" x2="145" y2="153" stroke={secondaryColor} strokeWidth="5" strokeLinecap="round" />
            {/* Torso curled up */}
            <Line x1="60" y1="153" x2="40" y2="125" stroke="url(#cyanPurple)" strokeWidth="6" strokeLinecap="round" />
            {/* Head curled */}
            <Circle cx="35" cy="112" r="9" fill={primaryColor} />
            {/* Abdominal contraction marker */}
            <Circle cx="75" cy="145" r="5" fill={theme.error} />
          </G>
        )}

        {type === 'gym_equipment' && (
          <G>
            {/* Generic equipment station for machine and free-weight movements. */}
            <Line x1="48" y1="42" x2="152" y2="42" stroke={primaryColor} strokeWidth="6" strokeLinecap="round" />
            <Line x1="62" y1="44" x2="62" y2="160" stroke={secondaryColor} strokeWidth="6" strokeLinecap="round" />
            <Line x1="138" y1="44" x2="138" y2="160" stroke={secondaryColor} strokeWidth="6" strokeLinecap="round" />
            <Line x1="62" y1="158" x2="138" y2="158" stroke={primaryColor} strokeWidth="5" strokeLinecap="round" />
            <Rect x="75" y="68" width="50" height="52" rx="4" fill={theme.surfaceAlt} stroke={theme.accent} strokeWidth="2" />
            <Line x1="100" y1="42" x2="100" y2="66" stroke={theme.error} strokeWidth="3" />
            <Line x1="87" y1="123" x2="113" y2="123" stroke={primaryColor} strokeWidth="5" strokeLinecap="round" />
            <Circle cx="87" cy="123" r="5" fill={theme.purple} />
            <Circle cx="113" cy="123" r="5" fill={theme.purple} />
          </G>
        )}

        {type === 'rest' && (
          <G>
            {/* Rest & Recovery Pulsing Core */}
            <Circle cx="100" cy="100" r="30" fill="url(#cyanPurple)" opacity={0.4} />
            <Circle cx="100" cy="100" r="20" fill={theme.accent} opacity={0.8} />
            <Circle cx="100" cy="100" r="10" fill={theme.textPrimary} />
            {/* Radiating recovery rings */}
            <Circle cx="100" cy="100" r="45" stroke={theme.accent} strokeWidth="1.5" strokeDasharray="5 5" opacity={0.7} />
            <Circle cx="100" cy="100" r="60" stroke={theme.purple} strokeWidth="1" strokeDasharray="3 3" opacity={0.5} />
          </G>
        )}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
