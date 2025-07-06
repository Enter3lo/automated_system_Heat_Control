let lastTemperature = null;
let lastDamperPosition = null;
let lastAutoRegulation = null;
let lastSaveTime = null;

// Функция сохранения с обновлением времени и последних значений
function saveTemperatureData(dateTime, temperature, damperPosition, autoRegul) {
    fetch('/save_temperature_data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            date: dateTime,
            value: temperature,
            damper_position: damperPosition,
            autoRegulation: autoRegul
        })
    })
        .then(response => {
            if (!response.ok) throw new Error('Network response was not ok ' + response.statusText);
            return response.text();
        })
        .then(data => {
            console.log('Данные успешно сохранены:', data);
            lastSaveTime = new Date();
            lastTemperature = temperature;
            lastDamperPosition = damperPosition;
            lastAutoRegulation = autoRegul;
        })
        .catch(error => console.error('Ошибка при сохранении данных:', error));
}

// Проверяем, нужно ли сохранять (изменения или прошло 30 минут)
function checkAndSaveData(currentDateTime, temperature, damperPosition, autoRegulation) {
    const now = new Date();
    const tempChanged = temperature !== lastTemperature;
    const damperChanged = damperPosition !== lastDamperPosition;
    const autoRegChanged = autoRegulation !== lastAutoRegulation;
    const timeExceeded = !lastSaveTime || (now - lastSaveTime) >= 30 * 60 * 1000; // 30 минут

    if (tempChanged || damperChanged || autoRegChanged || timeExceeded) {
        saveTemperatureData(currentDateTime, temperature, damperPosition, autoRegulation);
    }
}

// Обновляет значение температуры с учётом контрольного сохранения
function checkTemperature() {
    fetch('/get_temperature')
        .then(response => response.json())
        .then(data => {
            document.getElementById('temperature').innerText = `${data.temperature} °C`;

            const damperPosition = document.getElementById('persentOpen').value;
            const autoRegulation = document.getElementById('autoRegulation').checked;
            const currentDateTime = new Date().toISOString();

            checkAndSaveData(currentDateTime, data.temperature, damperPosition, autoRegulation);
        });
}

setInterval(() => {
    checkTemperature();
    syncDamperFromESP(); // добавлено
}, 5000);


function updateValuePersent() {
    const rangeInput = document.getElementById('persentOpen');
    const valueDisplay = document.getElementById('valueRange');
    const value = rangeInput.value;
    valueDisplay.value = value + '%';
}

function setPersentToServerESP() {
    const rangeInput = document.getElementById('persentOpen');
    const value = rangeInput.value;

    fetch(`http://192.168.50.214:80/persentOpen?persent=${value}`)
        .then(response => {
            if (!response.ok) throw new Error('Network response was not ok ' + response.statusText);
            return response.text();
        })
        .then(data => {
            console.log(data);

            const tempElement = document.getElementById('temperature');
            const temp = tempElement.textContent.replace(' °C', '');
            const autoRegulation = document.getElementById('autoRegulation').checked;
            const damperPosition = value;
            const currentDateTime = new Date().toISOString();

            checkAndSaveData(currentDateTime, temp, damperPosition, autoRegulation);
        })
        .catch(error => console.error('Ошибка:', error));
}

function updateSlider() {
    const slider = document.getElementById('persentOpen');
    const val = slider.value;
    slider.style.setProperty('--value', val + '%');
}

// Обновляем значение при вводе в текстовое поле
document.getElementById('valueRange').addEventListener('input', function (event) {
    const value = event.target.value;

    if (value.match(/^\d*$/)) {
        event.target.value = value;
    } else if (value.match(/^\d+%?$/)) {
        event.target.value = value.replace(/[^0-9%]/g, '');
    } else {
        event.target.value = value.replace(/[^0-9]/g, '');
    }

    const percentCount = (event.target.value.match(/%/g) || []).length;
    if (percentCount > 1) {
        event.target.value = event.target.value.replace(/%/g, '');
        event.target.value += '%';
    }

    if (parseInt(event.target.value) > 100) {
        event.target.value = '100%';
    }

    const rangeInput = document.getElementById('persentOpen');
    rangeInput.value = parseInt(event.target.value) || 0;
    updateSlider();

    const tempElement = document.getElementById('temperature');
    const temp = tempElement.textContent.replace(' °C', '');
    const autoRegulation = document.getElementById('autoRegulation').checked;
    const damperPosition = rangeInput.value;
    const currentDateTime = new Date().toISOString();

    checkAndSaveData(currentDateTime, temp, damperPosition, autoRegulation);
    setPersentToServerESP();
});

document.getElementById('valueRange').addEventListener('keydown', function (event) {
    if (event.key === '%') {
        event.preventDefault();
        const currentValue = this.value;
        if (!currentValue.endsWith('%') && currentValue.length > 0) {
            this.value = currentValue + '%';
        }
    }
});

document.getElementById('persentOpen').addEventListener('change', setPersentToServerESP);
document.getElementById('persentOpen').addEventListener('input', updateValuePersent);
window.onload = updateValuePersent;

const slider = document.getElementById('persentOpen');
slider.addEventListener('input', updateSlider);
updateSlider();

document.addEventListener('DOMContentLoaded', function () {
    const autoRegulationCheckbox = document.getElementById('autoRegulation');
    const persentOpenSlider = document.getElementById('persentOpen');
    const valueRangeInput = document.getElementById('valueRange');

    function updateControlsState() {
        if (autoRegulationCheckbox.checked) {
            persentOpenSlider.disabled = true;
            persentOpenSlider.style.filter = 'grayscale(100%)';
            persentOpenSlider.style.cursor = 'not-allowed';

            valueRangeInput.disabled = true;
            valueRangeInput.style.backgroundColor = '#eee';
            valueRangeInput.style.cursor = 'not-allowed';
        } else {
            persentOpenSlider.disabled = false;
            persentOpenSlider.style.filter = 'none';
            persentOpenSlider.style.cursor = 'pointer';

            valueRangeInput.disabled = false;
            valueRangeInput.style.backgroundColor = '';
            valueRangeInput.style.cursor = 'auto';
        }
    }

    updateControlsState();

    autoRegulationCheckbox.addEventListener('change', () => {
        updateControlsState();

        const isChecked = autoRegulationCheckbox.checked ? '1' : '0';
        fetch(`http://192.168.50.214:80/set_auto_adjust?value=${isChecked}`)
            .then(response => {
                if (!response.ok) throw new Error('Network response was not ok ' + response.statusText);
                return response.text();
            })
            .then(data => console.log('AutoAdjust set to:', data))
            .catch(error => console.error('Ошибка при установке autoAdjust:', error));
    });
});

function syncDamperFromESP() {
    const autoRegulation = document.getElementById('autoRegulation').checked;
    if (!autoRegulation) return;

    fetch('http://192.168.50.214/get_status')
        .then(response => response.json())
        .then(data => {
            const damperPosition = parseInt(data.damper_position);
            const slider = document.getElementById('persentOpen');
            const valueInput = document.getElementById('valueRange');

            slider.value = damperPosition;
            valueInput.value = damperPosition + '%';
            updateSlider();
        })
        .catch(error => console.error('Ошибка при получении статуса от ESP:', error));
}

function initializeFromESP() {
    fetch('http://192.168.50.214/get_data')
        .then(response => response.json())
        .then(data => {
            // Обновляем температуру
            const tempElement = document.getElementById('temperature');
            tempElement.innerText = `${data.temperature} °C`;

            // Обновляем ползунок и текстовое поле
            const slider = document.getElementById('persentOpen');
            const valueInput = document.getElementById('valueRange');
            slider.value = data.damper_position;
            valueInput.value = data.damper_position + '%';
            updateSlider();

            // Обновляем чекбокс автоматического регулирования
            const autoRegulationCheckbox = document.getElementById('autoRegulation');
            autoRegulationCheckbox.checked = data.auto_regulation;

            // Обновляем состояние элементов управления
            const event = new Event('change');
            autoRegulationCheckbox.dispatchEvent(event);
        })
        .catch(error => console.error('Ошибка при инициализации с ESP:', error));
}

// Вызываем при загрузке страницы
document.addEventListener('DOMContentLoaded', function () {
    initializeFromESP();
});