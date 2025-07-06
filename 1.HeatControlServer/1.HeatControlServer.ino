#include <DHT.h>
#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <ESP8266WebServer.h>
#include <Servo.h>
#include <EEPROM.h>  // Добавлено для работы с EEPROM

// Подключение к WiFi и создание локального сервера
const char* ssid = "your_wifi";
const char* password = "your_password";
ESP8266WebServer server(80); // Создаем сервер на порту 80

// Настройте статический IP
IPAddress local_IP(your_IP); // статический IP
IPAddress gateway(your_IP); // IP маршрутизатора
IPAddress subnet(your_mask); // маска

// Порт ввода и тип датчика температуры
#define DHTPIN D5
#define DHTTYPE DHT22

// Объект термодатчик
DHT dht(DHTPIN, DHTTYPE);

// Инициализация объекта и порта сервопривода
Servo damper;
int damperPin = D0;

// Адреса в EEPROM для сохранения переменных
#define ADDR_MIN_T       0   // float - 4 байта
#define ADDR_PREMIN_T    4   // float - 4 байта
#define ADDR_PREMAX_T    8   // float - 4 байта
#define ADDR_MAX_T       12  // float - 4 байта
#define ADDR_AUTO_ADJUST 16  // bool  - 1 байт

// Глобальные переменные для хранения настроек
float minT;
float preminT;
float premaxT;
float maxT;
bool autoAdjust;

// Функции для чтения из EEPROM
float readFloatFromEEPROM(int address) {
  float value = 0.0;
  EEPROM.get(address, value);
  return value;
}

bool readBoolFromEEPROM(int address) {
  byte value = EEPROM.read(address);
  return (value != 0);
}

// Функции для записи в EEPROM (на будущее)
void writeFloatToEEPROM(int address, float value) {
  EEPROM.put(address, value);
  EEPROM.commit();
}

void writeBoolToEEPROM(int address, bool value) {
  EEPROM.write(address, value ? 1 : 0);
  EEPROM.commit();
}

// Обработчик для /set_value
void handleSetValue() {
  if (server.hasArg("min") && server.hasArg("premin") && server.hasArg("premax") && server.hasArg("max")) {
    minT = server.arg("min").toFloat();
    preminT = server.arg("premin").toFloat();
    premaxT = server.arg("premax").toFloat();
    maxT = server.arg("max").toFloat();

    Serial.println("Получены новые настройки:");
    Serial.print("minT = "); Serial.println(minT);
    Serial.print("preminT = "); Serial.println(preminT);
    Serial.print("premaxT = "); Serial.println(premaxT);
    Serial.print("maxT = "); Serial.println(maxT);

    // Сохраняем в EEPROM
    writeFloatToEEPROM(ADDR_MIN_T, minT);
    writeFloatToEEPROM(ADDR_PREMIN_T, preminT);
    writeFloatToEEPROM(ADDR_PREMAX_T, premaxT);
    writeFloatToEEPROM(ADDR_MAX_T, maxT);

    server.send(200, "text/plain", "Данные успешно сохранены");
  } else {
    server.send(400, "text/plain", "Missing parameters");
  }
}

float mapFloat(float x, float in_min, float in_max, float out_min, float out_max) {
  if (in_max - in_min == 0) return out_min; // защита от деления на 0
  return (x - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
}

void setup() {
    Serial.begin(115200);

    EEPROM.begin(512); // Инициализация EEPROM

    // Читает значения из EEPROM
    minT = readFloatFromEEPROM(ADDR_MIN_T);
    preminT = readFloatFromEEPROM(ADDR_PREMIN_T);
    premaxT = readFloatFromEEPROM(ADDR_PREMAX_T);
    maxT = readFloatFromEEPROM(ADDR_MAX_T);
    autoAdjust = readBoolFromEEPROM(ADDR_AUTO_ADJUST);

    // Проверяет и задаёт дефолтные значения, если EEPROM пустой или некорректный
    if (isnan(minT) || minT == 0) minT = 21.25;
    if (isnan(preminT) || preminT == 0) preminT = 42.50;
    if (isnan(premaxT) || premaxT == 0) premaxT = 63.75;
    if (isnan(maxT) || maxT == 0) maxT = 85.0;

    byte valAuto = EEPROM.read(ADDR_AUTO_ADJUST);
    if (valAuto != 0 && valAuto != 1) {
      autoAdjust = true; // дефолтное значение
    }

    Serial.println("Значения из EEPROM:");
    Serial.print("minT = "); Serial.println(minT);
    Serial.print("preminT = "); Serial.println(preminT);
    Serial.print("premaxT = "); Serial.println(premaxT);
    Serial.print("maxT = "); Serial.println(maxT);
    Serial.print("autoAdjust = "); Serial.println(autoAdjust);

    // Устанавливает статический IP-адрес
    if (!WiFi.config(local_IP, gateway, subnet)) {
        Serial.println("Ошибка установки статического IP!");
    }
    damper.attach(damperPin);
    dht.begin();
    connectedWifi();
}

// Подключение к WiFi и настройки маршрутов сервера
void connectedWifi() {
    Serial.println("Connecting to ");
    Serial.println(ssid);

    // Подключение к локальной Wi-Fi сети
    WiFi.begin(ssid, password);

    // Проверяет, подключился ли Wi-Fi модуль к Wi-Fi сети
    while (WiFi.status() != WL_CONNECTED) {
        delay(1000);
        Serial.print(".");
    }

    Serial.println("");
    Serial.println("WiFi connected..!");
    Serial.print("Got IP: "); 
    Serial.println(WiFi.localIP());

    // Получает процент открытия заслонки и поворачивает серво привод
    server.on("/persentOpen", HTTP_GET, []() {
      if (!autoAdjust){
        String persentGet = server.arg("persent");
        damper.write(0);
        delay(3500);
        float writing = 1.8 * persentGet.toFloat();
        damper.write(writing);
      }
    });

    //Получает значение температуры и устанавливает положение серво привода согласно условиям
    server.on("/test_system", HTTP_GET, []() {
  if (!server.hasArg("temperature")) {
    server.send(400, "text/plain", "Missing temperature parameter");
    return;
  }

  float t = server.arg("temperature").toFloat();
  float percentage = 0;
        if (t < minT && t >= 0) {
            percentage = mapFloat(t, 0, minT, 100, 75);
        } else if (t < preminT) {
            percentage = mapFloat(t, minT, preminT, 75, 50);
        } else if (t < premaxT) {
            percentage = mapFloat(t, preminT, premaxT, 50, 25);
        } else if (t <= maxT) {
            percentage = mapFloat(t, premaxT, maxT, 25, 0);
        } else if(t < 0){
          percentage = 100;
        }

  // Преобразуем процент в угол
  int damperPercent = (int)percentage;
  int angle = map(damperPercent, 0, 100, 0, 180);

  // Поворачиваем сервопривод
  damper.write(0);       // сброс в 0
  delay(3500);           // пауза для возврата
  damper.write(angle);   // установка нужного угла

  // Формируем JSON-ответ
  String json = "{";
  json += "\"damper_position\": " + String(damperPercent) + ",";
  json += "\"damper_angle\": " + String(angle);
  json += "}";

  // Заголовки CORS
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");

  server.send(200, "application/json", json);

  // Отладка
  Serial.println("Получена температура: " + String(t));
  Serial.println("Процент открытия: " + String(damperPercent));
  Serial.println("Угол поворота: " + String(angle));
});

    // Отправляет степень открытия заслонки, температуру и автоматическое регулирование(true или false)
    server.on("/get_data", HTTP_GET, []() {
      float t = dht.readTemperature();

      float percentage = damper.read();
      percentage = map(percentage, 0, 180, 0, 100);

      int damperPercent = (int)percentage;

      String json = "{";
      json += "\"damper_position\": " + String(damperPercent) + ",";
      json += "\"temperature\": " + String(t, 1) + ",";
      json += "\"auto_regulation\": " + String(autoAdjust ? "true" : "false");
      json += "}";

      server.sendHeader("Access-Control-Allow-Origin", "*");
      server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      server.sendHeader("Access-Control-Allow-Headers", "Content-Type");

      server.send(200, "application/json", json);

      Serial.println(json);
    });

    //Устанавливает значение autoAdjust
    server.on("/set_auto_adjust", HTTP_GET, []() {
        String val = server.arg("value");
        if (val == "1") {
            autoAdjust = true;
        } else if (val == "0") {
            autoAdjust = false;
        }
        Serial.print("AutoAdjust set to: ");
        Serial.println(autoAdjust);

        // Сохраняем в EEPROM
        writeBoolToEEPROM(ADDR_AUTO_ADJUST, autoAdjust);
        server.send(200, "text/plain", autoAdjust ? "true" : "false");
    });

    // Устанавливает параметры автоматического регулирования
    server.on("/set_value", HTTP_GET, handleSetValue);

    server.on("/get_parameters", HTTP_GET, []() {
  String json = "{";
  json += "\"min\": " + String(minT, 2) + ",";
  json += "\"premin\": " + String(preminT, 2) + ",";
  json += "\"premax\": " + String(premaxT, 2) + ",";
  json += "\"max\": " + String(maxT, 2);
  json += "}";

  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");

  server.send(200, "application/json; charset=utf-8", json);

  Serial.println("Отправлены параметры: " + json);
});

    //Отправляет положение заслонки в процентах
    server.on("/get_status", HTTP_GET, []() {
      float t = dht.readTemperature();
      float percentage = 0;
        if (t < minT && t >= 0) {
            percentage = mapFloat(t, 0, minT, 100, 75);
        } else if (t < preminT) {
            percentage = mapFloat(t, minT, preminT, 75, 50);
        } else if (t < premaxT) {
            percentage = mapFloat(t, preminT, premaxT, 50, 25);
        } else if (t <= maxT) {
            percentage = mapFloat(t, premaxT, maxT, 25, 0);
        } else if(t < 0){
          percentage = 100;
        }

      int damperPercent = (int)percentage;

      String json = "{";
      json += "\"damper_position\": " + String(damperPercent);
      json += "}";

      // Добавляем CORS-заголовки
      server.sendHeader("Access-Control-Allow-Origin", "*");
      server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      server.sendHeader("Access-Control-Allow-Headers", "Content-Type");

      // Отправляем ответ
      server.send(200, "application/json", json);

      // Для отладки
      Serial.println(json);
    });

    server.begin(); // Запускаем сервер
}

//Автоматически регулирует степень открытия заслонки
void adjustDamper(float temperature, bool autoAdjust) {
    if (autoAdjust) {
        float percentage = 0;
       if (temperature < minT && temperature >= 0) {
            percentage = mapFloat(temperature, 0, minT, 100, 75);
        } else if (temperature < preminT) {
            percentage = mapFloat(temperature, minT, preminT, 75, 50);
        } else if (temperature < premaxT) {
            percentage = mapFloat(temperature, preminT, premaxT, 50, 25);
        } else if (temperature <= maxT) {
            percentage = mapFloat(temperature, premaxT, maxT, 25, 0);
        } else if(temperature < 0){
          percentage = 100;
        }
        // Преобразование процента в угол для сервопривода
        int angle = map(percentage, 0, 100, 0, 180);
        damper.write(angle);
    }
}

void loop() {
    HTTPClient http;
    WiFiClient client;
    String url = "http://your_IP:5000/main";

    http.begin(client, url);
    http.addHeader("Content-Type", "application/json"); 

    delay(2000);
    float t = dht.readTemperature();

    String jsonData = "{\"temperature\": " + String(t, 2) + "}"; 

    int httpResponseCode = http.POST(jsonData); 

    if (httpResponseCode > 0) {
        String response = http.getString(); 
        Serial.println(httpResponseCode); 
        Serial.println(response); 
    } else {
        Serial.print("Error on sending POST: ");
        Serial.println(httpResponseCode);
    }

    http.end();

    adjustDamper(t, autoAdjust);

    server.handleClient();
}
