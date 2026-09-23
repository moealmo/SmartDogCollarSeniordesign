import React, { useEffect, useState } from "react";
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
  TextInput,
} from "react-native";

type Screen = "Dashboard" | "Location" | "Activity" | "Settings";

type DataPoint = {
  time: string;
  activity: string;
  latitude: number;
  longitude: number;
};

export default function App() {
  const [screen, setScreen] = useState<Screen>("Dashboard");
  const [dogName, setDogName] = useState("Buddy");
  const [breed, setBreed] = useState("Golden Retriever");

  const [connected, setConnected] = useState(false);

  const [latitude, setLatitude] = useState(42.3223);
  const [longitude, setLongitude] = useState(-83.1763);

  const [activity, setActivity] = useState("Stationary");

  const [battery, setBattery] = useState(85);

  const [lastUpdate, setLastUpdate] = useState("--:--:--");

  const [dataHistory, setDataHistory] = useState<DataPoint[]>([]);

  // Simulated GPS + activity + timestamp + data recording
  useEffect(() => {
    if (!connected) {
      setActivity("Stationary");
      return;
    }

    const activities = [
      "Walking",
      "Walking",
      "Running",
      "Stationary",
    ];

    let activityIndex = 0;

    const interval = setInterval(() => {
      const newLatitude =
        latitude + (Math.random() - 0.5) * 0.0002;

      const newLongitude =
        longitude + (Math.random() - 0.5) * 0.0002;

      setLatitude(newLatitude);
      setLongitude(newLongitude);

      const newActivity = activities[activityIndex];

      setActivity(newActivity);

      activityIndex =
        (activityIndex + 1) % activities.length;

      const now = new Date();

      const time = now.toLocaleTimeString();

      setLastUpdate(time);

      // Record GPS + activity + timestamp
      setDataHistory((previous) => [
        {
          time,
          activity: newActivity,
          latitude: newLatitude,
          longitude: newLongitude,
        },
        ...previous,
      ].slice(0, 5));

      // Simulate small battery usage
      setBattery((previous) =>
        previous > 20 ? previous - 1 : previous
      );
    }, 4000);

    return () => clearInterval(interval);
  }, [connected]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Smart Dog Collar</Text>

        <Text style={styles.subtitle}>
          Keep track of {dogName}
        </Text>

        {/* DASHBOARD */}

        {screen === "Dashboard" && (
          <>
            <InfoCard
              title="🐶 Dog Profile"
              value={dogName}
            >
              {breed}
            </InfoCard>

            <InfoCard
              title="🔋 Battery"
              value={`${battery}%`}
            >
              {battery > 50
                ? "Battery level is good"
                : "Battery level is getting low"}
            </InfoCard>

            <InfoCard
              title="🏃 Activity"
              value={connected ? activity : "Stationary"}
            >
              {connected
                ? "Activity data is being received"
                : "Connect the collar to receive activity data"}
            </InfoCard>

            {/* BLE CONNECTION */}

            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                📡 Collar Connection
              </Text>

              <Text style={styles.value}>
                {connected
                  ? "🟢 Connected"
                  : "🔴 Disconnected"}
              </Text>

              <Text style={styles.description}>
                {connected
                  ? "Bluetooth connection is active"
                  : "Collar is not connected"}
              </Text>

              <Pressable
                style={styles.connectButton}
                onPress={() =>
                  setConnected(!connected)
                }
              >
                <Text style={styles.connectButtonText}>
                  {connected
                    ? "Disconnect Collar"
                    : "Connect Collar"}
                </Text>
              </Pressable>
            </View>

            {/* LIVE LOCATION */}

            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                📍 Live Location
              </Text>

              <Text style={styles.cardValue}>
                {connected
                  ? "🟢 GPS Active"
                  : "🔴 GPS Unavailable"}
              </Text>

              {connected ? (
                <>
                  <Text style={styles.smallText}>
                    Latitude: {latitude.toFixed(6)}
                  </Text>

                  <Text style={styles.smallText}>
                    Longitude: {longitude.toFixed(6)}
                  </Text>

                  <Text style={styles.smallText}>
                    Last update: {lastUpdate}
                  </Text>
                </>
              ) : (
                <Text style={styles.description}>
                  Connect the collar to receive GPS data.
                </Text>
              )}
            </View>
          </>
        )}

        {/* LOCATION */}

        {screen === "Location" && (
          <View>
            <Text style={styles.title}>Dog Location</Text>

            <View style={styles.mapBox}>
              <Text style={styles.mapText}>
                {connected ? "LIVE GPS" : "GPS OFFLINE"}
              </Text>

              <View style={styles.mapRoad1} />
              <View style={styles.mapRoad2} />

              {connected && (
                <View style={styles.locationMarker}>
                  <Text style={styles.markerText}>
                    🐕
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                GPS Status
              </Text>

              <Text style={styles.cardValue}>
                {connected
                  ? "🟢 GPS Connected"
                  : "🔴 GPS Unavailable"}
              </Text>

              {connected ? (
                <>
                  <Text style={styles.smallText}>
                    Latitude: {latitude.toFixed(6)}
                  </Text>

                  <Text style={styles.smallText}>
                    Longitude: {longitude.toFixed(6)}
                  </Text>

                  <Text style={styles.smallText}>
                    Last update: {lastUpdate}
                  </Text>

                  <Text style={styles.smallText}>
                    Status: Receiving location data
                  </Text>
                </>
              ) : (
                <Text style={styles.smallText}>
                  Connect the collar to receive GPS data.
                </Text>
              )}
            </View>

            {/* DATA HISTORY */}

            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                📋 Recent Collar Data
              </Text>

              {dataHistory.length === 0 ? (
                <Text style={styles.description}>
                  No data recorded yet. Connect the collar
                  to begin collecting data.
                </Text>
              ) : (
                dataHistory.map((data, index) => (
                  <View
                    key={index}
                    style={styles.historyItem}
                  >
                    <Text style={styles.historyTime}>
                      {data.time}
                    </Text>

                    <Text style={styles.historyActivity}>
                      {data.activity}
                    </Text>

                    <Text style={styles.smallText}>
                      {data.latitude.toFixed(6)},{" "}
                      {data.longitude.toFixed(6)}
                    </Text>
                  </View>
                ))
              )}
            </View>
          </View>
        )}

        {/* ACTIVITY */}

        {screen === "Activity" && (
          <View>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                🏃 Activity Tracking
              </Text>

              <Text style={styles.value}>
                {connected ? activity : "Stationary"}
              </Text>

              <View style={styles.activityRow}>
                <Text>Stationary</Text>

                <Text style={styles.activityStatus}>
                  {activity === "Stationary"
                    ? "YES"
                    : "NO"}
                </Text>
              </View>

              <View style={styles.activityRow}>
                <Text>Walking</Text>

                <Text style={styles.activityStatus}>
                  {activity === "Walking"
                    ? "YES"
                    : "NO"}
                </Text>
              </View>

              <View style={styles.activityRow}>
                <Text>Running</Text>

                <Text style={styles.activityStatus}>
                  {activity === "Running"
                    ? "YES"
                    : "NO"}
                </Text>
              </View>

              <Text style={styles.description}>
                Activity data will come from the collar's
                motion sensor.
              </Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                📊 Data Recording
              </Text>

              <Text style={styles.smallText}>
                GPS Position:{" "}
                {connected ? "Recording" : "Waiting"}
              </Text>

              <Text style={styles.smallText}>
                Activity State:{" "}
                {connected ? "Recording" : "Waiting"}
              </Text>

              <Text style={styles.smallText}>
                Timestamp:{" "}
                {connected ? "Recording" : "Waiting"}
              </Text>

              <Text style={styles.smallText}>
                Records Stored: {dataHistory.length}
              </Text>
            </View>
          </View>
        )}

        {/* SETTINGS */}

        {screen === "Settings" && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              ⚙️ Dog Settings
            </Text>

            <Text style={styles.inputLabel}>
              Dog Name
            </Text>

            <TextInput
              style={styles.input}
              value={dogName}
              onChangeText={setDogName}
              placeholder="Enter dog name"
            />

            <Text style={styles.inputLabel}>
              Breed
            </Text>

            <TextInput
              style={styles.input}
              value={breed}
              onChangeText={setBreed}
              placeholder="Enter breed"
            />

            <Text style={styles.description}>
              Your profile updates automatically.
            </Text>
          </View>
        )}

        {/* NAVIGATION */}

        <View style={styles.navigation}>
          <NavButton
            label="🏠 Home"
            active={screen === "Dashboard"}
            onPress={() => setScreen("Dashboard")}
          />

          <NavButton
            label="📍 GPS"
            active={screen === "Location"}
            onPress={() => setScreen("Location")}
          />

          <NavButton
            label="🏃 Activity"
            active={screen === "Activity"}
            onPress={() => setScreen("Activity")}
          />

          <NavButton
            label="⚙️ Settings"
            active={screen === "Settings"}
            onPress={() => setScreen("Settings")}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* INFO CARD */

function InfoCard({
  title,
  value,
  children,
}: {
  title: string;
  value: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>

      <Text style={styles.value}>{value}</Text>

      <Text style={styles.description}>
        {children}
      </Text>
    </View>
  );
}

/* NAVIGATION BUTTON */

function NavButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[
        styles.navButton,
        active && styles.activeButton,
      ]}
      onPress={onPress}
    >
      <Text style={styles.navText}>{label}</Text>
    </Pressable>
  );
}

/* STYLES */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f7fa",
    paddingHorizontal: 20,
  },

  title: {
    fontSize: 30,
    fontWeight: "800",
    color: "#172033",
    marginTop: 20,
  },

  subtitle: {
    fontSize: 16,
    color: "#687386",
    marginTop: 4,
    marginBottom: 22,
  },

  card: {
    backgroundColor: "#ffffff",
    padding: 20,
    borderRadius: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#e8ebf0",
  },

  cardTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#263247",
    marginBottom: 9,
  },

  value: {
    fontSize: 24,
    fontWeight: "800",
    color: "#172033",
    marginBottom: 6,
  },

  cardValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#172033",
    marginBottom: 8,
  },

  description: {
    fontSize: 14,
    color: "#718096",
    marginTop: 7,
    lineHeight: 20,
  },

  inputLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: "#344054",
    marginTop: 12,
    marginBottom: 6,
  },

  input: {
    borderWidth: 1,
    borderColor: "#d5dbe5",
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    backgroundColor: "#fafbfc",
  },

  /* BLE */

  connectButton: {
    backgroundColor: "#2563eb",
    paddingVertical: 13,
    borderRadius: 11,
    alignItems: "center",
    marginTop: 14,
  },

  connectButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },

  /* NAVIGATION */

  navigation: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
    marginBottom: 30,
  },

  navButton: {
    backgroundColor: "#e9edf3",
    paddingVertical: 11,
    paddingHorizontal: 13,
    borderRadius: 11,
  },

  activeButton: {
    backgroundColor: "#bfdbfe",
  },

  navText: {
    fontWeight: "700",
    color: "#263247",
  },

  /* MAP */

  mapBox: {
    height: 300,
    backgroundColor: "#dce8d5",
    borderRadius: 18,
    overflow: "hidden",
    position: "relative",
    marginBottom: 16,
    justifyContent: "center",
    alignItems: "center",
  },

  mapText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#71816b",
  },

  mapRoad1: {
    position: "absolute",
    width: "150%",
    height: 35,
    backgroundColor: "#ffffff",
    transform: [{ rotate: "35deg" }],
  },

  mapRoad2: {
    position: "absolute",
    width: "150%",
    height: 28,
    backgroundColor: "#ffffff",
    transform: [{ rotate: "-40deg" }],
  },

  locationMarker: {
    position: "absolute",
    backgroundColor: "#2563eb",
    width: 58,
    height: 58,
    borderRadius: 29,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 4,
    borderColor: "#ffffff",
  },

  markerText: {
    fontSize: 27,
  },

  /* GPS DATA */

  smallText: {
    fontSize: 15,
    color: "#555f70",
    marginTop: 6,
  },

  historyItem: {
    borderTopWidth: 1,
    borderTopColor: "#edf0f4",
    paddingTop: 12,
    marginTop: 12,
  },

  historyTime: {
    fontSize: 13,
    color: "#7a8494",
    marginBottom: 3,
  },

  historyActivity: {
    fontSize: 17,
    fontWeight: "700",
    color: "#172033",
  },

  /* ACTIVITY */

  activityRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#edf0f4",
  },

  activityStatus: {
    fontWeight: "700",
    color: "#2563eb",
  },
});