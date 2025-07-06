const ctx = document.getElementById('graph').getContext('2d');
let myChart;

// Функция для преобразования времени из HH:MM:SS в HH:MM
function formatTime(timeStr) {
    const [hours, minutes] = timeStr.split(':');
    return `${hours}:${minutes}`;
}

// Функция для преобразования даты из дд.мм.гггг в гггг-мм-дд
function convertDateToISO(dateStr) {
    const parts = dateStr.split('.');
    if (parts.length !== 3) return null;
    const [day, month, year] = parts;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

document.getElementById('generateButton').addEventListener('click', function () {
    const dateForGenerRaw = document.getElementById('dateForGener').value;
    if (!dateForGenerRaw) {
        alert('Укажите дату, по которой хотите построить график.');
        return;
    }
    const dateForGener = convertDateToISO(dateForGenerRaw);
    if (!dateForGener) {
        alert('Неверный формат даты');
        return;
    }

    fetch('/generate_graph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dateForGener: dateForGener })
    })
        .then(response => response.json())
        .then(data => {
            if (data.points && data.points.length > 0) {
                if (myChart) {
                    myChart.destroy();
                }

                // Инициализация массива времён от 00:00 до 23:30
                const allTimePoints = [];
                for (let hour = 0; hour < 24; hour++) {
                    allTimePoints.push(`${hour.toString().padStart(2, '0')}:00`);
                    allTimePoints.push(`${hour.toString().padStart(2, '0')}:30`);
                }

                // Создаём массивы для данных
                const temperatureData = [];
                const damperPositionData = [];
                const autoRegulationData = []; // Новый массив для автоматического регулирования

                // Заполняем данные
                data.points.forEach(point => {
                    const timeKey = formatTime(point.время);
                    const temperature = point.средняя_температура;
                    const damperPosition = point.среднее_положение_заслонки;
                    const autoRegulation = point.среднее_автоматическое_регулирование; // Значение автоматического регулирования

                    temperatureData.push({
                        x: timeKey,
                        y: temperature !== undefined ? temperature : null
                    });

                    damperPositionData.push({
                        x: timeKey,
                        y: damperPosition !== undefined ? damperPosition : null
                    });

                    autoRegulationData.push({
                        x: timeKey,
                        y: autoRegulation !== undefined ? autoRegulation : null
                    });
                });

                // Создаём datasets для Chart.js
                const datasets = [
                    {
                        label: 'Средняя температура',
                        data: temperatureData,
                        borderColor: 'rgba(75, 192, 192, 1)',
                        backgroundColor: 'rgba(75, 192, 192, 0.2)',
                        fill: false,
                        spanGaps: true,
                        tension: 0.1,
                        pointRadius: 3,
                        pointHoverRadius: 6
                    },
                    {
                        label: 'Среднее значение положения заслонки',
                        data: damperPositionData,
                        borderColor: 'rgba(255, 99, 132, 1)',
                        backgroundColor: 'rgba(255, 99, 132, 0.2)',
                        fill: false,
                        spanGaps: true,
                        tension: 0.1,
                        pointRadius: 3,
                        pointHoverRadius: 6
                    },
                    {
                        label: 'Автоматическое регулирование (Вкл/Выкл)',
                        data: autoRegulationData,
                        borderColor: 'rgba(255, 206, 86, 1)',
                        backgroundColor: 'rgba(255, 206, 86, 0.2)',
                        fill: false,
                        spanGaps: true,
                        tension: 0.1,
                        pointRadius: 3,
                        pointHoverRadius: 6
                    }
                ];

                myChart = new Chart(ctx, {
                    type: 'line',
                    data: {
                        datasets: datasets
                    },
                    options: {
                        scales: {
                            x: {
                                type: 'category',
                                labels: allTimePoints,
                                ticks: {
                                    maxRotation: 0,
                                    minRotation: 0
                                },
                                grid: {
                                    display: true
                                }
                            },
                            y: {
                                beginAtZero: false,
                                title: {
                                    display: true,
                                    text: ''
                                },
                                grid: {
                                    display: true
                                }
                            }
                        },
                        plugins: {
                            tooltip: {
                                callbacks: {
                                    label: ctx => {
                                        const y = ctx.parsed.y;
                                        return y !== null ? `${ctx.dataset.label}: ${y.toFixed(2)}` : 'Нет данных';
                                    }
                                }
                            },
                            legend: {
                                display: true,
                                position: 'top'
                            }
                        },
                        responsive: true,
                        maintainAspectRatio: false
                    }
                });
            } else {
                alert(data.message || 'Данные не найдены');
            }
        })
        .catch(error => {
            console.error('Ошибка:', error);
            alert('Ошибка при загрузке данных');
        });
});

// Предполагается, что myChart уже инициализирован

document.getElementById('graph').onclick = function (evt) {
    const points = myChart.getElementsAtEventForMode(evt, 'nearest', { intersect: true }, true);

    if (points.length) {
        const firstPoint = points[0];
        const timeLabel = myChart.data.datasets[firstPoint.datasetIndex].data[firstPoint.index].x; // например "01:00"
        const date = document.getElementById('dateForGener').value;
        const date_form = convertDateToISO(date);

        fetch('/detail_data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ time: timeLabel, date: date_form })
        })
            .then(response => response.json())
            .then(detailData => {
                if (detailData && detailData.points && detailData.points.length > 0) {
                    // Преобразуем данные для графика
                    const temperatureData = detailData.points.map(p => ({ x: p.время, y: p.температура }));
                    const damperData = detailData.points.map(p => ({ x: p.время, y: p.положение_заслонки }));
                    const autoRegData = detailData.points.map(p => ({ x: p.время, y: p.авто_регулирование }));

                    // Обновляем данные myChart
                    myChart.data.datasets = [
                        {
                            label: 'Температура (детально)',
                            data: temperatureData,
                            borderColor: 'rgba(75, 192, 192, 1)',
                            backgroundColor: 'rgba(75, 192, 192, 0.2)',
                            fill: false,
                            spanGaps: true,
                            tension: 0.1,
                            pointRadius: 3,
                            pointHoverRadius: 6
                        },
                        {
                            label: 'Положение заслонки',
                            data: damperData,
                            borderColor: 'rgba(255, 99, 132, 1)',
                            backgroundColor: 'rgba(255, 99, 132, 0.2)',
                            fill: false,
                            spanGaps: true,
                            tension: 0.1,
                            pointRadius: 3,
                            pointHoverRadius: 6
                        },
                        {
                            label: 'Автоматическое регулирование (Вкл/Выкл)',
                            data: autoRegData,
                            borderColor: 'rgba(255, 206, 86, 1)',
                            backgroundColor: 'rgba(255, 206, 86, 0.2)',
                            fill: false,
                            spanGaps: true,
                            tension: 0.1,
                            pointRadius: 3,
                            pointHoverRadius: 6,
                            stepped: true // Для дискретного отображения
                        }
                    ];

                    // Обновляем подписи по оси X (время с секундами)
                    myChart.options.scales.x = {
                        type: 'category',
                        labels: temperatureData.map(p => p.x),
                        ticks: { maxRotation: 0, minRotation: 0 },
                        grid: { display: true }
                    };

                    // Обновляем график
                    myChart.update();
                } else {
                    alert('Детальные данные не найдены');
                }
            })
            .catch(err => {
                console.error('Ошибка при загрузке детальных данных:', err);
                alert('Ошибка при загрузке детальных данных');
            });
    }
};

document.addEventListener('DOMContentLoaded', () => {
    // Запросим даты с сервера
    fetch('/gener_calendary', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
        // тело не нужно, если сервер не требует
    })
        .then(response => response.json())
        .then(availableDates => {
            // Инициализируем flatpickr с полученными датами
            flatpickr("#dateForGener", {
                dateFormat: "d.m.Y",
                locale: {
                    firstDayOfWeek: 1,
                    weekdays: {
                        shorthand: ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"],
                        longhand: ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"]
                    },
                    months: {
                        shorthand: ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"],
                        longhand: ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"]
                    },
                    rangeSeparator: ' по ',
                    weekAbbreviation: 'Нед',
                    scrollTitle: 'Прокрутите для увеличения',
                    toggleTitle: 'Нажмите для переключения',
                    nextMonth: 'Следующий месяц',
                    previousMonth: 'Предыдущий месяц',
                    today: 'Сегодня',
                    clear: 'Очистить',
                    close: 'Закрыть'
                },
                onDayCreate: function (dObj, dStr, fp, dayElem) {
                    // Получаем компоненты даты
                    const year = dayElem.dateObj.getFullYear();
                    const month = String(dayElem.dateObj.getMonth() + 1).padStart(2, '0'); // месяц с 0
                    const day = String(dayElem.dateObj.getDate()).padStart(2, '0');
                    const date = `${year}-${month}-${day}`; // формируем строку в формате YYYY-MM-DD

                    if (availableDates.includes(date)) {
                        dayElem.classList.add('available');
                    } else {
                        dayElem.classList.add('unavailable');
                        dayElem.style.pointerEvents = 'none';
                    }
                }
            });
        })
        .catch(error => {
            console.error('Ошибка при загрузке дат:', error);
        });
});

// Добавим стили через JS или в CSS-файл
const style = document.createElement('style');
style.textContent = `
    .available {
        background-color: #4caf50 !important;
        color: white !important;
        border-radius: 0 !important;
    }
    .unavailable {
        background-color: #f44336 !important;
        color: white !important;
        border-radius: 0 !important;
        opacity: 0.5;
    }
    .flatpickr-day {
        margin: 2px;
        padding: 10px;
        box-sizing: border-box;
        border: none !important;
    }
    .flatpickr-day:hover {
        background-color: #e0e0e0 !important;
    }
`;
document.head.appendChild(style);
