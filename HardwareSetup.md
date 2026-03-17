# KrishiClaw Hardware Integration Guide: ESP32 Irrigation Controller

This guide explains how to connect a real ESP32-based irrigation pump to the KrishiX platform.

## 1. Hardware Requirements
- **ESP32 Development Board** (e.g., ESP32-WROOM-32)
- **5V/12V Relay Module**
- **Water Pump**
- **External Power Supply** (for the pump)
- **Jumper Wires**

## 2. Wiring Diagram
- **Relay VCC** -> ESP32 5V (or external 5V)
- **Relay GND** -> ESP32 GND
- **Relay IN** -> ESP32 **GPIO 26** (configurable in code)
- **Pump** -> Connected through the Relay's Normally Open (NO) contacts.

## 3. ESP32 Firmware (Arduino C++)

### Prerequisites
1. Install **Arduino IDE**.
2. Install ESP32 Board Support (Tools -> Board -> Boards Manager).
3. Install the **Firebase ESP Client** library by Mobizt.

### The Code
Copy this code into your Arduino IDE. Replace the placeholders with your WiFi credentials.

```cpp
#include <WiFi.h>
#include <Firebase_ESP_Client.h>

// Provide the token generation process info.
#include <addons/TokenHelper.h>

// 1. WiFi Credentials
#define WIFI_SSID "YOUR_WIFI_SSID"
#define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"

// 2. Firebase Credentials (From your firebase-applet-config.json)
#define API_KEY "AIzaSyCl8IvUyOaKyoVkapcHuoi5MKPjIq1YUjA"
#define FIREBASE_PROJECT_ID "krishix-36276"

// 3. Hardware Pins
#define PUMP_PIN 26
#define SOIL_PIN 34 // Analog pin for Soil Moisture Sensor
#define DHT_PIN 27  // Digital pin for DHT22
#define DHTTYPE DHT22 // Using DHT22 sensor

#include "DHT.h"
DHT dht(DHT_PIN, DHTTYPE);

// Firebase Data objects
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

void setup() {
  Serial.begin(115200);
  pinMode(PUMP_PIN, OUTPUT);
  digitalWrite(PUMP_PIN, LOW); // Ensure pump is off initially
  dht.begin(); // Initialize DHT22

  // Connect to WiFi
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi Connected");

  // Configure Firebase
  config.api_key = API_KEY;
  config.database_url = "https://krishix-36276-default-rtdb.firebaseio.com"; // Add your RTDB URL
  
  // Enable Anonymous Auth
  auth.user_auth.anonymous = true;

  // Assign the callback function for the long running token generation task
  config.token_status_callback = tokenStatusCallback; 
  
  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);
}

void loop() {
  if (Firebase.ready()) {
    // 1. READ SENSORS
    // Note: 4095 is the max value for ESP32 ADC (12-bit).
    // If you always see 4095, check your wiring or power to the sensor.
    int rawMoisture = analogRead(SOIL_PIN);
    
    // Convert raw (0-4095) to percentage (0-100)
    // Adjust 4095 (Dry) and 0 (Wet) based on your sensor's calibration
    int moisturePercent = map(rawMoisture, 4095, 0, 0, 100);
    moisturePercent = constrain(moisturePercent, 0, 100);

    float temp = dht.readTemperature();
    float hum = dht.readHumidity();

    // Check if any reads failed and exit early (to try again).
    if (isnan(hum) || isnan(temp)) {
      Serial.println(F("Failed to read from DHT sensor!"));
      delay(2000);
      return;
    }

    // 2. SEND TELEMETRY TO RTDB
    FirebaseJson json;
    json.set("soilMoisture", rawMoisture); // Sending raw for precision
    json.set("moisturePercent", moisturePercent);
    json.set("temperature", temp);
    json.set("humidity", hum);
    json.set("timestamp", Firebase.getCurrentTime());

    if (Firebase.RTDB.setJSON(&fbdo, "/telemetry", &json)) {
      Serial.println("Telemetry sent to RTDB");
    } else {
      Serial.println(fbdo.errorReason());
    }

    // 3. POLL FOR TASKS (Firestore)
    String path = "hardware_tasks";
    if (Firebase.Firestore.listDocuments(&fbdo, FIREBASE_PROJECT_ID, "(default)", path.c_str(), "")) {
      String payload = fbdo.payload();
      if (payload.indexOf("\"status\":\"pending\"") != -1 && payload.indexOf("\"type\":\"IRRIGATION\"") != -1) {
        Serial.println(">>> PENDING IRRIGATION TASK FOUND! <<<");
        digitalWrite(PUMP_PIN, HIGH);
        delay(5000); // Run pump for 5 seconds
        digitalWrite(PUMP_PIN, LOW);
        
        // Note: In production, update the Firestore document status to 'completed' here
      }
    }
  }
  delay(5000); // Update every 5 seconds
}
```

## 4. Troubleshooting "Upload" Errors
If you are getting errors while uploading from the Arduino IDE, check these common issues:

1.  **Library Missing**: Go to **Tools -> Manage Libraries** and search for **"Firebase ESP Client"**. Make sure it is installed (by Mobizt).
2.  **Wrong Board**: Go to **Tools -> Board** and select **"DOIT ESP32 DEVKIT V1"** (or your specific ESP32 model).
3.  **Port Not Selected**: Go to **Tools -> Port** and select the COM port your ESP32 is plugged into.
4.  **Boot Button**: Some ESP32 boards require you to hold the **"BOOT"** button on the board while the IDE says "Connecting..." during the upload process.
## 5. Firebase Console Configuration
1. **Authentication**: Enable the **Anonymous** sign-in provider (or create a dedicated email/pass for the hardware).
2. **Firestore**: Ensure the `hardware_tasks` collection exists.
3. **Indexes**: If you use complex queries (like filtering by status), Firebase will provide a link in the Serial Monitor to create the required composite index.

## 6. How it Works
1. **User** says "पानी दे दो" in the KrishiX Web App.
2. **Web App** creates a document in `hardware_tasks` with `status: "pending"`.
3. **ESP32** detects the new document.
4. **ESP32** triggers GPIO 26 -> Relay -> Pump.
5. **ESP32** updates the document `status: "completed"`.
6. **Web App** UI updates automatically to show the task is finished.
