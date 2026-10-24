import React, { useEffect, useRef, useState } from "react";
import { Alert, PermissionsAndroid, Platform } from "react-native";
import { BleManager, Device, State, Subscription } from "react-native-ble-plx";
import { decode, encode } from "base-64";
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

  // BLE UUIDs must match the Arduino sketch.
  const SERVICE_UUID = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
  const TX_UUID = "6e400003-b5a3-f393-e0a9-e50e24dcca9e"; // Arduino -> phone
  const RX_UUID = "6e400002-b5a3-f393-e0a9-e50e24dcca9e"; // Phone -> Arduino
  const bleManager = useRef<BleManager | null>(null);
  const deviceRef = useRef<Device | null>(null);
  const notifyRef = useRef<Subscription | null>(null);
  const disconnectRef = useRef<Subscription | null>(null);
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [busy, setBusy] = useState(false);
  const [bleStatus, setBleStatus] = useState("Ready to scan");
  const [receivedData, setReceivedData] = useState("No data received");

  useEffect(() => {
    const manager = new BleManager();
    bleManager.current = manager;
    return () => {
      manager.stopDeviceScan();
      if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
      notifyRef.current?.remove();
      disconnectRef.current?.remove();
      if (deviceRef.current) manager.cancelDeviceConnection(deviceRef.current.id).catch(() => {});
      manager.destroy();
      bleManager.current = null;
    };
  }, []);

  const requestPermissions = async () => {
    if (Platform.OS !== "android") return true;
    const api = Number(Platform.Version);
    if (api >= 31) {
      const result = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      ]);
      return Object.values(result).every((value) => value === PermissionsAndroid.RESULTS.GRANTED);
    }
    return (await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION)) ===
      PermissionsAndroid.RESULTS.GRANTED;
  };

  const stopScan = () => {
    bleManager.current?.stopDeviceScan();
    if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
    scanTimeoutRef.current = null;
  };

  const processData = (message: string) => {
    setReceivedData(message);
    setLastUpdate(new Date().toLocaleTimeString());
    // Expected test format: BATTERY:85;ACTIVITY:Walking
    const batteryMatch = message.match(/BATTERY:(\d+)/i);
    const activityMatch = message.match(/ACTIVITY:([A-Za-z]+)/i);
    if (batteryMatch) setBattery(Math.min(100, Math.max(0, Number(batteryMatch[1]))));
    if (activityMatch) setActivity(activityMatch[1]);
  };

  const connectToDevice = async (device: Device) => {
    const manager = bleManager.current;
    if (!manager) return;
    try {
      setBleStatus("Connecting...");
      const connectedDevice = await manager.connectToDevice(device.id, { timeout: 10000 });
      deviceRef.current = connectedDevice;
      await connectedDevice.discoverAllServicesAndCharacteristics();
      notifyRef.current?.remove();
      notifyRef.current = connectedDevice.monitorCharacteristicForService(
        SERVICE_UUID, TX_UUID, (error, characteristic) => {
          if (error) {
            setBleStatus(`Data error: ${error.message}`);
            return;
          }
          if (characteristic?.value) processData(decode(characteristic.value));
        }
      );
      disconnectRef.current?.remove();
      disconnectRef.current = manager.onDeviceDisconnected(device.id, () => {
        setConnected(false);
        deviceRef.current = null;
        notifyRef.current?.remove();
        notifyRef.current = null;
        setBleStatus("Collar disconnected");
      });
      setConnected(true);
      setBleStatus(`Connected to ${device.name || "SmartDogCollar"}`);
    } catch (error) {
      setConnected(false);
      deviceRef.current = null;
      setBleStatus(`Connection failed: ${String(error)}`);
      Alert.alert("Connection failed", "Check that the collar is powered on and uses the matching BLE service.");
    } finally {
      setBusy(false);
    }
  };

  const scanAndConnect = async () => {
    const manager = bleManager.current;
    if (!manager || busy) return;
    setBusy(true);
    try {
      if (!(await requestPermissions())) {
        setBleStatus("Bluetooth permissions denied");
        setBusy(false);
        return;
      }
      const state = await manager.state();
      if (state !== State.PoweredOn) {
        setBleStatus("Turn on Bluetooth and try again");
        setBusy(false);
        return;
      }
      setBleStatus("Scanning for SmartDogCollar...");
      manager.startDeviceScan([SERVICE_UUID], null, (error, device) => {
        if (error) {
          stopScan();
          setBleStatus(`Scan failed: ${error.message}`);
          setBusy(false);
          return;
        }
        if (device && (device.name === "SmartDogCollar" || device.localName === "SmartDogCollar")) {
          stopScan();
          void connectToDevice(device);
        }
      });
      scanTimeoutRef.current = setTimeout(() => {
        stopScan();
        setBleStatus("Collar not found. Check power and BLE advertising.");
        setBusy(false);
      }, 12000);
    } catch (error) {
      stopScan();
      setBleStatus(`Scan error: ${String(error)}`);
      setBusy(false);
    }
  };

  const disconnectCollar = async () => {
    stopScan();
    const device = deviceRef.current;
    notifyRef.current?.remove();
    notifyRef.current = null;
    disconnectRef.current?.remove();
    disconnectRef.current = null;
    deviceRef.current = null;
    setConnected(false);
    setBleStatus("Disconnected");
    if (device) {
      try { await bleManager.current?.cancelDeviceConnection(device.id); }
      catch (error) { setBleStatus(`Disconnect error: ${String(error)}`); }
    }
  };

  const sendTestCommand = async () => {
    const device = deviceRef.current;
    if (!device || !connected) return;
    try {
      await device.writeCharacteristicWithResponseForService(
        SERVICE_UUID, RX_UUID, encode("PING")
      );
      setBleStatus("PING sent. Waiting for collar reply...");
    } catch (error) {
      setBleStatus(`Send failed: ${String(error)}`);
    }
  };

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
                ? "Activity data received from collar"
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
                  ? "Real BLE connection is active"
                  : "Collar is not connected"}
              </Text>

              <Text style={styles.description}>{bleStatus}</Text>
              <Text style={styles.smallText}>Received: {receivedData}</Text>
              <Pressable
                style={styles.connectButton}
                disabled={busy}
                onPress={connected ? () => { void disconnectCollar(); } : () => { void scanAndConnect(); }}
              >
                <Text style={styles.connectButtonText}>
                  {busy ? "Connecting..." : connected ? "Disconnect Collar" : "Connect Collar"}
                </Text>
              </Pressable>
              {connected && (
                <Pressable style={styles.connectButton} onPress={() => { void sendTestCommand(); }}>
                  <Text style={styles.connectButtonText}>Send Test Data (PING)</Text>
                </Pressable>
              )}
            </View>

            {/* LIVE LOCATION */}

            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                📍 Live Location
              </Text>

              <Text style={styles.cardValue}>
                {connected
                  ? "🟢 GPS Not Configured"
                  : "🔴 GPS Unavailable"}
              </Text>

              {connected ? (
                <>
                  <Text style={styles.smallText}>
                    Latitude (placeholder): {latitude.toFixed(6)}
                  </Text>

                  <Text style={styles.smallText}>
                    Longitude (placeholder): {longitude.toFixed(6)}
                  </Text>

                  <Text style={styles.smallText}>
                    Last update: {lastUpdate}
                  </Text>
                </>
              ) : (
                <Text style={styles.description}>
                  GPS data will be available after the GPS sensor is integrated.
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
                {connected ? "GPS TEST VIEW" : "GPS OFFLINE"}
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
                  ? "🟢 GPS Not Configured"
                  : "🔴 GPS Unavailable"}
              </Text>

              {connected ? (
                <>
                  <Text style={styles.smallText}>
                    Latitude (placeholder): {latitude.toFixed(6)}
                  </Text>

                  <Text style={styles.smallText}>
                    Longitude (placeholder): {longitude.toFixed(6)}
                  </Text>

                  <Text style={styles.smallText}>
                    Last update: {lastUpdate}
                  </Text>

                  <Text style={styles.smallText}>
                    Status: GPS sensor not connected yet
                  </Text>
                </>
              ) : (
                <Text style={styles.smallText}>
                  GPS data will be available after the GPS sensor is integrated.
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
                {connected ? "BLE connected" : "Waiting"}
              </Text>

              <Text style={styles.smallText}>
                Activity State:{" "}
                {connected ? "BLE connected" : "Waiting"}
              </Text>

              <Text style={styles.smallText}>
                Timestamp:{" "}
                {connected ? "BLE connected" : "Waiting"}
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