import sqlite3

from flask import Flask, render_template, request, jsonify
from datetime import datetime, timedelta


app = Flask(__name__)

current_temperature = 25.0
esp_url = 'http://192.168.50.214'


@app.route('/main', methods=['POST', 'GET'])
def main():
    global current_temperature

    if request.method == 'POST':
        data = request.json
        current_temperature = data.get('temperature', current_temperature)
        return {'status': 'success', 'temperature': current_temperature}

    else:
        return render_template('index.html', temperature=current_temperature, persent=20)


@app.route('/get_temperature', methods=['GET'])
def get_temperature():
    return jsonify({'temperature': current_temperature})


@app.route('/save_temperature_data', methods=['POST'])
def save_temperature_data():
    #Получение и обработка актуальных данных при изменении температуры
    data = request.json
    dt = datetime.strptime(data['date'], '%Y-%m-%dT%H:%M:%S.%fZ')
    dt_local = dt + timedelta(hours=5)
    date_str = dt_local.strftime('%d.%m.%Y')
    time_str = dt_local.strftime('%H:%M:%S')
    val = data['value']
    damper_position = data['damper_position']
    auto_regul = data['autoRegulation']
    #Подключение отправка данных в БД
    connection = sqlite3.connect('db/thermoControl.sqlite')
    query = f'INSERT INTO temperature(date, time, value, damper_position, autoRegulation) VALUES(\'{date_str}\', \'{time_str}\',' \
            f' \'{val}\', \'{damper_position}\', \'{auto_regul}\')'
    connection.cursor().execute(query)
    connection.commit()
    try:
        # Код для сохранения данных в базе данных
        return jsonify({'message': 'Данные сохранены успешно'}), 200
    except Exception as e:
        return jsonify({'message': 'Ошибка при сохранении данных'}), 500


@app.route('/temperature_graph')
def temperature_graph():
    return render_template('temperature_graph.html')


@app.route('/generate_graph', methods=['POST'])
def generate_graph():
    data = request.json
    date_for_gener = data['dateForGener']
    date_for_gener_obj = datetime.strptime(date_for_gener, '%Y-%m-%d')

    connection = sqlite3.connect('db/thermoControl.sqlite')
    cursor = connection.cursor()

    # Получаем все записи за выбранный день с температурой, положением заслонки и состоянием автоматического регулирования
    query = '''
            SELECT date, time, value, damper_position, autoRegulation
            FROM temperature
            WHERE date(substr(date, 7, 4) || '-' || substr(date, 4, 2) || '-' || substr(date, 1, 2)) = ?
            ORDER BY time
        '''
    rows = cursor.execute(query, (date_for_gener,)).fetchall()
    connection.close()

    # Инициализируем словари для хранения значений по интервалам
    intervals_temp = {f"{hour:02}:{minute:02}:00": [] for hour in range(24) for minute in (0, 30)}
    intervals_damper = {key: [] for key in intervals_temp.keys()}
    intervals_auto_reg = {key: [] for key in intervals_temp.keys()}

    # Заполняем словари значениями
    for row in rows:
        time_str = row[1]  # формат HH:MM:SS
        temp_value = float(row[2])
        damper_value = row[3]
        auto_reg_value = row[4]  # Значение автоматического регулирования

        try:
            damper_value = float(damper_value)
        except (TypeError, ValueError):
            damper_value = None

        # Преобразуем значение автоматического регулирования
        auto_reg_value = 1 if auto_reg_value else 0

        time_obj = datetime.strptime(time_str, '%H:%M:%S')

        # Определяем начало 30-минутного интервала
        half_hour_start_minute = 0 if time_obj.minute < 30 else 30
        interval_key = time_obj.replace(minute=half_hour_start_minute, second=0).strftime('%H:%M:%S')

        intervals_temp[interval_key].append(temp_value)
        if damper_value is not None:
            intervals_damper[interval_key].append(damper_value)
        intervals_auto_reg[interval_key].append(auto_reg_value)

    # Рассчитываем средние значения для каждого интервала
    points = []
    for interval_time in sorted(intervals_temp.keys()):
        temps = intervals_temp[interval_time]
        dampers = intervals_damper[interval_time]
        auto_regs = intervals_auto_reg[interval_time]

        avg_temp = round(sum(temps) / len(temps), 2) if temps else None
        avg_damper = round(sum(dampers) / len(dampers), 2) if dampers else None
        avg_auto_reg = round(sum(auto_regs) / len(auto_regs), 2) if auto_regs else None

        points.append({
            'дата': date_for_gener_obj.strftime('%d.%m.%Y'),
            'время': interval_time,
            'средняя_температура': avg_temp,
            'среднее_положение_заслонки': avg_damper,
            'среднее_автоматическое_регулирование': avg_auto_reg
        })

    has_data = any(
        (point['средняя_температура'] is not None or point['среднее_положение_заслонки'] is not None or point[
            'среднее_автоматическое_регулирование'] is not None)
        for point in points
    )

    if has_data:
        return jsonify({'points': points})
    else:
        return jsonify({'message': 'Данные не найдены'}), 404


@app.route('/detail_data', methods=['POST'])
def detail_data():
    data = request.json
    date_str = data.get('date')
    time_str = data.get('time')

    if not date_str or not time_str:
        return jsonify({'error': 'Отсутствуют параметры date или time'}), 400

    try:
        start_dt = datetime.strptime(f"{date_str} {time_str}", "%Y-%m-%d %H:%M")
    except ValueError:
        return jsonify({'error': 'Неверный формат даты или времени'}), 400

    end_dt = start_dt + timedelta(minutes=30)

    start_time_str = start_dt.strftime("%H:%M:%S")
    end_time_str = end_dt.strftime("%H:%M:%S")

    connection = sqlite3.connect('db/thermoControl.sqlite')
    cursor = connection.cursor()

    query = '''
            SELECT date, time, value, damper_position, autoRegulation
            FROM temperature
            WHERE date(substr(date, 7, 4) || '-' || substr(date, 4, 2) || '-' || substr(date, 1, 2)) = ?
            AND time >= ? AND time <= ?
            ORDER BY time
        '''
    formatted_date = start_dt.strftime("%Y-%m-%d")

    cursor.execute(query, (formatted_date, start_time_str, end_time_str))
    rows = cursor.fetchall()
    connection.close()

    points = []
    for row in rows:
        auto_reg = 1 if row[4] in (True, 'true', 'True', 1) else 0
        points.append({
            'время': row[1],
            'температура': row[2],
            'положение_заслонки': row[3],
            'авто_регулирование': auto_reg
        })

    return jsonify({'points': points})


@app.route('/gener_calendary', methods=['POST'])
def gener_calendary():
    connection = sqlite3.connect('db/thermoControl.sqlite')
    cursor = connection.cursor()

    query = 'SELECT DISTINCT date FROM temperature'
    cursor.execute(query)
    rows = cursor.fetchall()
    connection.close()

    # Преобразуем даты из формата дд.мм.гггг в YYYY-MM-DD
    dates = []
    for row in rows:
        date_str = row[0]  # дд.мм.гггг
        date_obj = datetime.strptime(date_str, '%d.%m.%Y')  # Преобразуем в объект даты
        dates.append(date_obj.strftime('%Y-%m-%d'))  # Преобразуем обратно в строку в формате YYYY-MM-DD

    return jsonify(dates)


@app.route('/management')
def management():
    return render_template('management.html')


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
