document.getElementById('save').addEventListener('click', function () {
    const minValueInput = document.getElementById('min_value').value;
    const preMinValueInput = document.getElementById('premin_value').value;
    const preMaxValueInput = document.getElementById('premax_value').value;
    const maxValueInput = document.getElementById('max_value').value;

    // Проверка, что все поля заполнены
    if (minValueInput === '' || preMinValueInput === '' || preMaxValueInput === '' || maxValueInput === '') {
        alert('Пожалуйста, заполните все поля.');
        return;
    }

    const minValue = parseFloat(minValueInput);
    const preMinValue = parseFloat(preMinValueInput);
    const preMaxValue = parseFloat(preMaxValueInput);
    const maxValue = parseFloat(maxValueInput);

    // Проверка условий
    if (minValue >= preMinValue) {
        alert('Минимальное значение должно быть меньше предминимального значения.');
        return;
    }
    if (preMinValue >= preMaxValue) {
        alert('Предминимальное значение должно быть меньше предмаксимального значения.');
        return;
    }
    if (preMaxValue >= maxValue) {
        alert('Предмаксимальное значение должно быть меньше максимального значения.');
        return;
    }

    const url = `http://192.168.50.214/set_value?min=${minValue}&premin=${preMinValue}&premax=${preMaxValue}&max=${maxValue}`;
    fetch(url)
        .then(response => {
            if (response.ok) {
                alert('Настройки успешно сохранены!');
            } else {
                alert('Ошибка при сохранении настроек.');
            }
        })
        .catch(error => {
            alert('Настройки успешно сохранены!');
        });

});

function setupNumberInput(input, maxValue) {
    input.addEventListener('keydown', function (e) {
        const allowedKeys = [
            'Backspace', 'Delete', 'Tab', 'Enter', 'ArrowLeft', 'ArrowRight', 'Home', 'End'
        ];

        // Разрешаем цифры, точку и управляющие клавиши
        if (
            !allowedKeys.includes(e.key) &&
            !(e.key >= '0' && e.key <= '9') &&
            e.key !== '.'
        ) {
            e.preventDefault();
        }

        // Запретить ввод второй точки
        if (e.key === '.' && this.value.includes('.')) {
            e.preventDefault();
        }
    });

    input.addEventListener('input', function () {
        let val = this.value;

        // Удаляем все символы кроме цифр и точек
        val = val.replace(/[^0-9.]/g, '');

        // Удаляем все точки, кроме первой
        const parts = val.split('.');
        if (parts.length > 2) {
            val = parts[0] + '.' + parts.slice(1).join('');
        }

        // Ограничиваем количество знаков после точки до 2
        if (parts.length === 2) {
            parts[1] = parts[1].slice(0, 2);
            val = parts[0] + '.' + parts[1];
        }

        // Обновляем значение поля
        this.value = val;

        // Ограничиваем максимальное значение, только если введено число, а не пустая строка или точка в конце
        if (val !== '' && val !== '.' && val !== undefined) {
            let numVal = parseFloat(val);
            if (!isNaN(numVal) && numVal > maxValue) {
                this.value = maxValue.toFixed(2); // показываем с двумя знаками после запятой
            }
        }
    });
}

document.getElementById('reset').addEventListener('click', () => {
    const confirmed = confirm('Вы уверены, что хотите сбросить настройки?');
    if (confirmed) {
        const defaultValues = {
            min_value: '21.25',
            premin_value: '42.50',
            premax_value: '63.75',
            max_value: '85.00'
        };

        // Обновляем поля и localStorage
        for (const id in defaultValues) {
            const input = document.getElementById(id);
            if (input) {
                input.value = defaultValues[id];
                localStorage.setItem(id, defaultValues[id]);
            }
        }

        // Формируем URL для отправки на ESP8266 (как в вашем save)
        const url = `http://192.168.50.214/set_value?min=${defaultValues.min_value}&premin=${defaultValues.premin_value}&premax=${defaultValues.premax_value}&max=${defaultValues.max_value}`;

        fetch(url)
            .then(response => {
                if (response.ok) {
                    alert('Настройки сброшены и сохранены на сервере!');
                } else {
                    alert('Ошибка при сохранении настроек на сервере.');
                }
            })
            .catch(error => {
                alert('Настройки сброшены и сохранены на сервере!');
            });
    }
});


let initialValues = {};

// После загрузки страницы и заполнения полей (например, после запроса на сервер)
function saveInitialValues() {
    initialValues.min_value = document.getElementById('min_value').value;
    initialValues.premin_value = document.getElementById('premin_value').value;
    initialValues.premax_value = document.getElementById('premax_value').value;
    initialValues.max_value = document.getElementById('max_value').value;
}

// Вызовите saveInitialValues() после того, как данные заполнились (например, после fetch)

// Обработчик кнопки Отмена
document.getElementById('cancle').addEventListener('click', () => {
    document.getElementById('min_value').value = initialValues.min_value || '';
    document.getElementById('premin_value').value = initialValues.premin_value || '';
    document.getElementById('premax_value').value = initialValues.premax_value || '';
    document.getElementById('max_value').value = initialValues.max_value || '';
});

document.addEventListener('DOMContentLoaded', () => {
    // Сначала инициализируем инпуты через ваш setupNumberInput
    setupNumberInput(document.getElementById('min_value'), 85);
    setupNumberInput(document.getElementById('premin_value'), 85);
    setupNumberInput(document.getElementById('premax_value'), 85);
    setupNumberInput(document.getElementById('max_value'), 85);
    // Добавляем защиту для поля температуры
    setupNumberInput(document.getElementById('temp'), 85);


    // Запрос к серверу для получения параметров
    fetch('http://192.168.50.214/get_parameters')
        .then(response => {
            if (!response.ok) throw new Error('Ошибка сети при получении параметров');
            return response.json(); // предполагаем, что сервер возвращает JSON
        })
        .then(data => {
            // Проверяем, что в ответе есть нужные поля
            if (data.min !== undefined) document.getElementById('min_value').value = data.min;
            if (data.premin !== undefined) document.getElementById('premin_value').value = data.premin;
            if (data.premax !== undefined) document.getElementById('premax_value').value = data.premax;
            if (data.max !== undefined) document.getElementById('max_value').value = data.max;

            // Если нужно, можно сохранить эти значения в localStorage тоже
            localStorage.setItem('min_value', data.min);
            localStorage.setItem('premin_value', data.premin);
            localStorage.setItem('premax_value', data.premax);
            localStorage.setItem('max_value', data.max);
            // Сохраняем исходные значения
            saveInitialValues();
        })
        .catch(error => {
            alert('Не удалось загрузить параметры с сервера: ' + error.message);
            // Здесь можно при желании заполнить дефолтными значениями
        });
});


// Функция для настройки защиты ввода с ограничением maxValue и 2 знаками после запятой
function setupNumberInput(input, maxValue) {
    input.addEventListener('keydown', function (e) {
        const allowedKeys = [
            'Backspace', 'Delete', 'Tab', 'Enter', 'ArrowLeft', 'ArrowRight', 'Home', 'End'
        ];

        if (
            !allowedKeys.includes(e.key) &&
            !(e.key >= '0' && e.key <= '9') &&
            e.key !== '.'
        ) {
            e.preventDefault();
        }

        if (e.key === '.' && this.value.includes('.')) {
            e.preventDefault();
        }
    });

    input.addEventListener('input', function () {
        let val = this.value;

        // Удаляем все символы кроме цифр и точек
        val = val.replace(/[^0-9.]/g, '');

        // Удаляем все точки кроме первой
        const parts = val.split('.');
        if (parts.length > 2) {
            val = parts[0] + '.' + parts.slice(1).join('');
        }

        // Ограничиваем количество знаков после точки до 2
        if (parts.length === 2) {
            parts[1] = parts[1].slice(0, 2);
            val = parts[0] + '.' + parts[1];
        }

        // Обновляем значение поля
        this.value = val;

        // Ограничение максимума
        if (val !== '' && val !== '.' && val !== undefined) {
            let numVal = parseFloat(val);
            if (!isNaN(numVal) && numVal > maxValue) {
                this.value = maxValue.toFixed(2);
            }
        }
    });
}

// Применяем setupNumberInput к полю temp с максимальным значением 85
document.addEventListener('DOMContentLoaded', () => {
    setupNumberInput(document.getElementById('temp'), 85);

    // Ваш существующий код инициализации...
});

document.getElementById('set').addEventListener('click', () => {
    const tempInput = document.getElementById('temp').value.trim();

    if (tempInput === '') {
        alert('Пожалуйста, введите значение температуры.');
        return;
    }

    // Можно добавить проверку, что введено число
    const tempValue = parseFloat(tempInput);
    if (isNaN(tempValue)) {
        alert('Введите корректное числовое значение температуры.');
        return;
    }

    // Отправляем запрос на сервер (замените IP на ваш)
    const url = `http://192.168.50.214/test_system?temperature=${encodeURIComponent(tempValue)}`;

    fetch(url, {
        method: 'GET',
        mode: 'cors'
    })
        .then(response => response.json())
        .then(data => {
            document.getElementById("persent_damfer").value = data.damper_position + " %";
            document.getElementById("degree_damfer").value = data.damper_angle + "°";
        })
        .catch(error => {
            alert('Ошибка сети: ' + error.message);
        });
});

