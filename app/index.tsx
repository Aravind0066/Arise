import { View, Text, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Polygon, Line, Circle } from "react-native-svg";

export default function HomeScreen() {
  return (
  <SafeAreaView style={styles.container}>
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
    >
      {/* LEVEL HEADER */}

      <View style={styles.header}>
        <View style={styles.levelBox}>
          <Text style={styles.levelText}>Lv.</Text>
          <Text style={styles.levelNumber}>12</Text>
        </View>

        <View style={styles.centerSection}>
          <Text style={styles.title}>HUNTER</Text>

          <Text style={styles.expText}>
            EXP 2450 / 4000
          </Text>

          <View style={styles.progressBackground}>
            <View style={styles.progressFill} />
          </View>

          <Text style={styles.percent}>61%</Text>
        </View>

        <View style={styles.levelBox}>
          <Text style={styles.levelText}>Lv.</Text>
          <Text style={styles.levelNumber}>13</Text>
        </View>
      </View>

      {/* STATUS SECTION */}

      <View style={styles.statusCard}>
        <Text style={styles.sectionTitle}>
          STATUS OVERVIEW
        </Text>

        <View style={styles.graphContainer}>
          <Text style={[styles.graphLabel, styles.strengthLabel]}>
            STRENGTH{"\n"}
            <Text style={styles.statNumber}>68</Text>
          </Text>

          <Text style={[styles.graphLabel, styles.agilityLabel]}>
            AGILITY{"\n"}
            <Text style={styles.statNumber}>72</Text>
          </Text>

          <Text style={[styles.graphLabel, styles.intelligenceLabel]}>
            INTELLIGENCE{"\n"}
            <Text style={styles.statNumber}>64</Text>
          </Text>

          <Text style={[styles.graphLabel, styles.enduranceLabel]}>
            ENDURANCE{"\n"}
            <Text style={styles.statNumber}>75</Text>
          </Text>

          <Text style={[styles.graphLabel, styles.luckLabel]}>
            LUCK{"\n"}
            <Text style={styles.statNumber}>55</Text>
          </Text>

          <Svg
            width="260"
            height="260"
            viewBox="0 0 300 300"
          >
            {/* OUTER PENTAGON */}

            <Polygon
              points="150,30 264,113 220,247 80,247 36,113"
              fill="none"
              stroke="#164A86"
              strokeWidth="2"
            />

            {/* INNER GRID */}

            <Polygon
              points="150,65 231,124 200,220 100,220 69,124"
              fill="none"
              stroke="#123765"
              strokeWidth="1"
            />

            <Polygon
              points="150,100 198,135 180,193 120,193 102,135"
              fill="none"
              stroke="#123765"
              strokeWidth="1"
            />

            {/* CENTER LINES */}

            <Line
              x1="150"
              y1="150"
              x2="150"
              y2="30"
              stroke="#123765"
            />

            <Line
              x1="150"
              y1="150"
              x2="264"
              y2="113"
              stroke="#123765"
            />

            <Line
              x1="150"
              y1="150"
              x2="220"
              y2="247"
              stroke="#123765"
            />

            <Line
              x1="150"
              y1="150"
              x2="80"
              y2="247"
              stroke="#123765"
            />

            <Line
              x1="150"
              y1="150"
              x2="36"
              y2="113"
              stroke="#123765"
            />

            {/* PLAYER STATS */}

            <Polygon
              points="150,60 232,123 195,213 98,220 70,124"
              fill="rgba(30, 111, 255, 0.25)"
              stroke="#38BDF8"
              strokeWidth="4"
            />

            {/* GLOWING POINTS */}

            <Circle cx="150" cy="60" r="5" fill="#FFFFFF" />

            <Circle cx="232" cy="123" r="5" fill="#FFFFFF" />

            <Circle cx="195" cy="213" r="5" fill="#FFFFFF" />

            <Circle cx="98" cy="220" r="5" fill="#FFFFFF" />

            <Circle cx="70" cy="124" r="5" fill="#FFFFFF" />
          </Svg>
        </View>
      </View>
    </ScrollView>
  </SafeAreaView>
);
}

const styles = StyleSheet.create({

  container: {
    flex: 1,
    backgroundColor: "#050B18",
    paddingTop: 50,
    paddingHorizontal: 20,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },

  levelBox: {
    width: 70,
    height: 90,
    borderWidth: 1,
    borderColor: "#2E7CF6",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },

  levelText: {
    color: "#7CB6FF",
    fontSize: 16,
  },

  levelNumber: {
    color: "white",
    fontSize: 30,
    fontWeight: "bold",
  },

  centerSection: {
    flex: 1,
    alignItems: "center",
    marginHorizontal: 20,
  },

  title: {
    color: "#53A6FF",
    fontSize: 28,
    fontWeight: "bold",
    letterSpacing: 4,
  },

  expText: {
    color: "#9DBBFF",
    marginTop: 10,
    marginBottom: 12,
    fontSize: 15,
  },

  progressBackground: {
    width: "100%",
    height: 10,
    backgroundColor: "#122542",
    borderRadius: 10,
  },

  progressFill: {
    width: "61%",
    height: "100%",
    backgroundColor: "#2E7CF6",
    borderRadius: 10,
  },

  percent: {
    marginTop: 8,
    color: "#53A6FF",
    fontSize: 16,
    fontWeight: "600",
  },
  scrollContent: {
  paddingTop: 40,
  paddingHorizontal: 20,
  paddingBottom: 50,
},

statusCard: {
  marginTop: 35,
  padding: 18,
  backgroundColor: "#071222",
  borderWidth: 1,
  borderColor: "#1D65B7",
  borderRadius: 16,
},

sectionTitle: {
  color: "#2E90FF",
  fontSize: 19,
  fontWeight: "700",
  letterSpacing: 1,
},

graphContainer: {
  height: 400,
  marginTop: 15,
  justifyContent: "center",
  alignItems: "center",
  position: "relative",
},

graphLabel: {
  position: "absolute",
  color: "#DCEAFF",
  fontSize: 11,
  fontWeight: "600",
  textAlign: "center",
  zIndex: 1,
},

statNumber: {
  color: "#FFFFFF",
  fontSize: 18,
  fontWeight: "bold",
},

strengthLabel: {
  top: 5,
},

agilityLabel: {
  right: -4,
  top: 115,
},

intelligenceLabel: {
  right: -8,
  bottom: 25,
},

enduranceLabel: {
  left: -4,
  bottom: 25,
},

luckLabel: {
  left: 5,
  top: 115,
},

});