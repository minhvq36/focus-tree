const { ipcRenderer } = require('electron');

/*
Configuration and Constants
*/
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const BLOCKS = ['morning', 'afternoon'];
const COLOR_PALETTE = [
    '#4285F4',
    '#EA4335',
    '#FBBC05',
    '#34A853',
    '#9C27B0',
    '#00ACC1'
];

/*
State
*/
let weekData = null;
let currentTab = 'Mon';

/*
Initialize
*/
document.addEventListener('DOMContentLoaded', () => {
    loadData();
});

/*
Data Management
*/
function loadData() {
    ipcRenderer.invoke('load-productivity-data').then(data => {
        weekData = data;
        renderTabs();
        renderCharts();
        renderStats();
    }).catch(err => {
        console.error('Failed to load data:', err);
        weekData = initializeEmptyData();
        renderTabs();
        renderCharts();
        renderStats();
    });
}

function initializeEmptyData() {
    const data = {};
    DAYS.forEach(day => {
        data[day] = {};
        BLOCKS.forEach(block => {
            data[day][block] = [];
        });
    });
    return data;
}

function saveData() {
    ipcRenderer.invoke('save-productivity-data', weekData).catch(err => {
        console.error('Failed to save data:', err);
    });
}

/*
Data Operations
*/
function addStack(day, block, stackType, minutes) {
    const stacks = weekData[day][block];

    /* First stack must be "work" */
    if (stacks.length === 0 && stackType !== 'work') {
        return;
    }

    /* Cannot add same type consecutively */
    if (stacks.length > 0 && stacks[stacks.length - 1][0] === stackType) {
        return;
    }

    stacks.push([stackType, minutes]);
    saveData();
    renderTab(day);
    renderCharts();
    renderStats();
}

function removeStack(day, block) {
    const stacks = weekData[day][block];
    if (stacks.length > 0) {
        stacks.pop();
        saveData();
        renderTab(day);
        renderCharts();
        renderStats();
    }
}

function clearBlock(day, block) {
    weekData[day][block] = [];
    saveData();
    renderTab(day);
    renderCharts();
    renderStats();
}

function summarizeBlock(day, block) {
    let work = 0;
    let rest = 0;
    weekData[day][block].forEach(([type, minutes]) => {
        if (type === 'work') {
            work += minutes;
        } else {
            rest += minutes;
        }
    });
    return { work, rest };
}

/*
Rendering
*/
function renderTabs() {
    const tabsContainer = document.getElementById('tabs-container');
    const contentContainer = document.getElementById('tabs-content');

    tabsContainer.innerHTML = '';
    contentContainer.innerHTML = '';

    DAYS.forEach((day, index) => {
        /* Tab button */
        const button = document.createElement('button');
        button.className = `tab-button ${index === 0 ? 'active' : ''}`;
        button.textContent = day;
        button.addEventListener('click', () => switchTab(day, button));
        tabsContainer.appendChild(button);

        /* Tab content */
        const content = document.createElement('div');
        content.className = `tab-content ${index === 0 ? 'active' : ''}`;
        content.id = `tab-${day}`;
        contentContainer.appendChild(content);
    });

    /* Render first tab */
    renderTab('Mon');
}

function renderTab(day) {
    const tabElement = document.getElementById(`tab-${day}`);
    if (!tabElement) return;

    tabElement.innerHTML = '';

    /* Create two columns */
    const columns = document.createElement('div');
    columns.className = 'columns';

    /* Morning column */
    columns.appendChild(createBlockColumn(day, 'morning'));

    /* Afternoon column */
    columns.appendChild(createBlockColumn(day, 'afternoon'));

    tabElement.appendChild(columns);
}

function createBlockColumn(day, block) {
    const { work, rest } = summarizeBlock(day, block);
    const stacks = weekData[day][block];

    const column = document.createElement('div');
    column.className = 'column';

    /* Block title */
    const title = document.createElement('h4');
    title.textContent = block === 'morning' ? '🌅 Morning' : '🌤️ Afternoon';
    column.appendChild(title);

    /* Expander for viewing stacks */
    const expander = document.createElement('div');
    expander.className = 'expander';

    const expanderHeader = document.createElement('button');
    expanderHeader.className = 'expander-header';
    expanderHeader.textContent = '📋 View stacks';
    expanderHeader.style.width = '100%';

    const expanderContent = document.createElement('div');
    expanderContent.className = 'expander-content';

    if (stacks.length === 0) {
        expanderContent.innerHTML = '<p style="color: #9ca3af;">No data yet</p>';
    } else {
        stacks.forEach((stack, index) => {
            const emoji = stack[0] === 'work' ? '💼' : '☕';
            const label = stack[0].charAt(0).toUpperCase() + stack[0].slice(1);
            const p = document.createElement('p');
            p.textContent = `${index + 1}. ${emoji} ${label} - ${stack[1]}min`;
            expanderContent.appendChild(p);
        });
    }

    expanderHeader.addEventListener('click', () => {
        expanderHeader.classList.toggle('open');
        expanderContent.classList.toggle('open');
    });

    expander.appendChild(expanderHeader);
    expander.appendChild(expanderContent);
    column.appendChild(expander);

    /* Input and buttons */
    const inputRow = document.createElement('div');
    inputRow.className = 'input-row';

    const input = document.createElement('input');
    input.type = 'number';
    input.min = '1';
    input.max = '300';
    input.value = '50';

    const buttonGroup = document.createElement('div');
    buttonGroup.className = 'button-group';

    const workBtn = document.createElement('button');
    workBtn.textContent = '💼 Work';
    workBtn.addEventListener('click', () => {
        addStack(day, block, 'work', parseInt(input.value));
    });

    const restBtn = document.createElement('button');
    restBtn.textContent = '☕ Rest';
    restBtn.addEventListener('click', () => {
        addStack(day, block, 'rest', parseInt(input.value));
    });

    buttonGroup.appendChild(workBtn);
    buttonGroup.appendChild(restBtn);

    inputRow.appendChild(input);
    inputRow.appendChild(buttonGroup);
    column.appendChild(inputRow);

    /* Action buttons */
    const actionButtons = document.createElement('div');
    actionButtons.className = 'action-buttons';

    const removeBtn = document.createElement('button');
    removeBtn.textContent = '↶ Remove';
    removeBtn.addEventListener('click', () => {
        removeStack(day, block);
    });

    const clearBtn = document.createElement('button');
    clearBtn.textContent = '🗑️ Clear';
    clearBtn.addEventListener('click', () => {
        clearBlock(day, block);
    });

    actionButtons.appendChild(removeBtn);
    actionButtons.appendChild(clearBtn);
    column.appendChild(actionButtons);

    /* Efficiency Check */
    const efficiencyTitle = document.createElement('h3');
    efficiencyTitle.textContent = 'Efficiency Check';
    efficiencyTitle.style.marginTop = '24px';
    column.appendChild(efficiencyTitle);

    const efficiencyGrid = document.createElement('div');
    efficiencyGrid.className = 'efficiency-grid';

    /* Rest <= Work */
    const eff1 = document.createElement('div');
    eff1.className = 'efficiency-item';
    const label1 = document.createElement('div');
    label1.className = 'efficiency-label';
    label1.textContent = 'Rest ≤ Work';
    const value1 = document.createElement('div');
    value1.className = 'efficiency-value';
    const color1 = rest <= work ? '#2e7d32' : '#c62828';
    value1.innerHTML = `<span class="efficiency-dot" style="color: ${color1};">●</span><span class="efficiency-number">${rest}/${work}</span>`;
    eff1.appendChild(label1);
    eff1.appendChild(value1);
    efficiencyGrid.appendChild(eff1);

    /* Work >= 120 */
    const eff2 = document.createElement('div');
    eff2.className = 'efficiency-item';
    const label2 = document.createElement('div');
    label2.className = 'efficiency-label';
    label2.textContent = 'Work ≥ 120min';
    const value2 = document.createElement('div');
    value2.className = 'efficiency-value';
    const color2 = work >= 120 ? '#2e7d32' : '#c62828';
    value2.innerHTML = `<span class="efficiency-dot" style="color: ${color2};">●</span><span class="efficiency-number">${work}min</span>`;
    eff2.appendChild(label2);
    eff2.appendChild(value2);
    efficiencyGrid.appendChild(eff2);

    column.appendChild(efficiencyGrid);

    return column;
}

function switchTab(day, buttonElement) {
    /* Update buttons */
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });
    buttonElement.classList.add('active');

    /* Update content */
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`tab-${day}`).classList.add('active');

    currentTab = day;
}

function renderCharts() {
    const container = document.getElementById('charts-container');
    container.innerHTML = '';

    /* Morning chart */
    const morningChartDiv = document.createElement('div');
    morningChartDiv.className = 'chart-container';
    container.appendChild(morningChartDiv);

    const afternoonChartDiv = document.createElement('div');
    afternoonChartDiv.className = 'chart-container';
    container.appendChild(afternoonChartDiv);

    const morningData = buildChartData('morning');
    const afternoonData = buildChartData('afternoon');

    renderVegaChart(morningChartDiv, morningData, 'Morning Productivity');
    renderVegaChart(afternoonChartDiv, afternoonData, 'Afternoon Productivity');
}

function buildChartData(block) {
    const rows = [];

    DAYS.forEach(day => {
        const stacks = weekData[day][block];

        /* Zero baseline row */
        rows.push({
            Day: day,
            Minutes: 0,
            StackIndex: -1,
            Color: 'rgba(0,0,0,0)'
        });

        stacks.forEach((stack, idx) => {
            rows.push({
                Day: day,
                Minutes: stack[1],
                StackIndex: idx,
                Color: COLOR_PALETTE[idx % COLOR_PALETTE.length]
            });
        });
    });

    return rows;
}

function renderVegaChart(container, data, title) {
    const spec = {
        $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
        description: title,
        data: { values: data },
        title: title,
        mark: 'bar',
        encoding: {
            x: {
                field: 'Day',
                type: 'nominal',
                sort: DAYS,
                scale: { paddingInner: 0.5, paddingOuter: 0.3 },
                axis: { labelFontSize: 12, titleFontSize: 12 }
            },
            y: {
                field: 'Minutes',
                type: 'quantitative',
                stack: true,
                axis: { labelFontSize: 12, titleFontSize: 12 }
            },
            color: {
                field: 'Color',
                type: 'nominal',
                scale: null,
                legend: null
            },
            order: {
                field: 'StackIndex',
                type: 'quantitative'
            },
            tooltip: [
                { field: 'Day', type: 'nominal', title: 'Day' },
                { field: 'Minutes', type: 'quantitative', title: 'Minutes' }
            ]
        },
        width: 'container',
        height: 340
    };

    vegaEmbed(container, spec, { renderer: 'canvas', actions: false });
}

function renderStats() {
    const container = document.getElementById('stats-container');
    container.innerHTML = '';

    let weekMorningWork = 0;
    let weekMorningRest = 0;
    let weekAfternoonWork = 0;
    let weekAfternoonRest = 0;

    DAYS.forEach(day => {
        const [mWork, mRest] = [
            summarizeBlock(day, 'morning').work,
            summarizeBlock(day, 'morning').rest
        ];
        const [aWork, aRest] = [
            summarizeBlock(day, 'afternoon').work,
            summarizeBlock(day, 'afternoon').rest
        ];

        weekMorningWork += mWork;
        weekMorningRest += mRest;
        weekAfternoonWork += aWork;
        weekAfternoonRest += aRest;
    });

    const totalWork = weekMorningWork + weekAfternoonWork;
    const totalRest = weekMorningRest + weekAfternoonRest;
    const workRatio = totalWork + totalRest > 0 ? ((totalWork / (totalWork + totalRest)) * 100).toFixed(0) : 0;
    const dailyAvg = totalWork > 0 ? Math.floor(totalWork / 7) : 0;

    /* Total Work */
    const stat1 = document.createElement('div');
    stat1.className = 'stat-card';
    const label1 = document.createElement('div');
    label1.className = 'stat-label';
    label1.textContent = '📅 Total Work';
    const value1 = document.createElement('div');
    value1.className = 'stat-value';
    value1.textContent = totalWork >= 60 ? `${(totalWork / 60).toFixed(1)}h` : `${totalWork}min`;
    stat1.appendChild(label1);
    stat1.appendChild(value1);
    container.appendChild(stat1);

    /* Total Rest */
    const stat2 = document.createElement('div');
    stat2.className = 'stat-card';
    const label2 = document.createElement('div');
    label2.className = 'stat-label';
    label2.textContent = '☕ Total Rest';
    const value2 = document.createElement('div');
    value2.className = 'stat-value';
    value2.textContent = totalRest >= 60 ? `${(totalRest / 60).toFixed(1)}h` : `${totalRest}min`;
    stat2.appendChild(label2);
    stat2.appendChild(value2);
    container.appendChild(stat2);

    /* Work Ratio */
    const stat3 = document.createElement('div');
    stat3.className = 'stat-card';
    const label3 = document.createElement('div');
    label3.className = 'stat-label';
    label3.textContent = '📊 Work Ratio';
    const value3 = document.createElement('div');
    value3.className = 'stat-value';
    value3.textContent = `${workRatio}%`;
    stat3.appendChild(label3);
    stat3.appendChild(value3);
    container.appendChild(stat3);

    /* Daily Avg */
    const stat4 = document.createElement('div');
    stat4.className = 'stat-card';
    const label4 = document.createElement('div');
    label4.className = 'stat-label';
    label4.textContent = '📆 Daily Avg';
    const value4 = document.createElement('div');
    value4.className = 'stat-value';
    value4.textContent = `${dailyAvg}min`;
    stat4.appendChild(label4);
    stat4.appendChild(value4);
    container.appendChild(stat4);
}
