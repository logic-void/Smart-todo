const taskContainer = document.getElementById("task-container");
const sortBtn = document.getElementById("sortBtn");
const filterBtn = document.getElementById("filterBtn");
const sortOptions = document.querySelector(".optionsForSort");
const filterOptions = document.querySelector(".optionsForFilter");
const sortLabel = document.getElementById("sortLabel");
const filterLabel = document.getElementById("filterLabel");
const form = document.querySelector("main form");
const inputs = document.querySelectorAll("main form input");
const taskInput = inputs[0];
const assignedInput = inputs[1];

let currentSort = "oldest";
let currentFilter = "all";

function parseTime(value, fallback = null) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() !== "") {
        const parsed = Date.parse(value);
        if (Number.isFinite(parsed)) return parsed;
    }
    return fallback;
}

function normalizeStatus(status) {
    const value = String(status || "pending").toLowerCase();

    if (value.includes("progress")) return "in-progress";
    if (
        value.includes("complete") ||
        value === "done" ||
        value === "finished"
    ) {
        return "completed";
    }

    return "pending";
}

function normalizeTask(task) {
    const fallbackId = Number(task.id) || Date.now();

    return {
        id: fallbackId,
        taskName: task.taskName ?? task.text ?? "",
        assignedTo: task.assignedTo ?? "",
        status: normalizeStatus(task.status),
        createdAt: parseTime(task.createdAt, fallbackId),
        startedAt: parseTime(task.startedAt, null),
        endedAt: parseTime(task.endedAt, null),
        durationMs:
            typeof task.durationMs === "number" &&
            Number.isFinite(task.durationMs)
                ? task.durationMs
                : null
    };
}

const tasks = JSON.parse(localStorage.getItem("tasks") || "[]").map(
    normalizeTask
);

function saveTasks() {
    localStorage.setItem("tasks", JSON.stringify(tasks));
}

saveTasks();

function formatDateTime(timestamp) {
    if (timestamp === null || timestamp === undefined) return "Not started yet";

    return new Date(timestamp).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
    });
}

function formatDuration(ms) {
    if (!Number.isFinite(ms) || ms < 0) return "Not finished yet";

    const totalSeconds = Math.floor(ms / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const parts = [];
    if (days) parts.push(`${days}d`);
    if (hours || parts.length) parts.push(`${hours}h`);
    if (minutes || parts.length) parts.push(`${minutes}m`);
    parts.push(`${seconds}s`);

    return parts.join(" ");
}

function getStatusLabel(status) {
    if (status === "in-progress") return "In Progress";
    if (status === "completed") return "Completed";
    return "Pending";
}

function getActionText(task) {
    if (task.status === "pending") return "Start";
    if (task.status === "in-progress") return "Stop";
    return "Delete";
}

function getVisibleTasks() {
    let visible = [...tasks];

    if (currentFilter !== "all") {
        visible = visible.filter(task => task.status === currentFilter);
    }

    if (currentSort === "oldest") {
        visible.sort((a, b) => a.createdAt - b.createdAt);
    } else if (currentSort === "newest") {
        visible.sort((a, b) => b.createdAt - a.createdAt);
    } else if (currentSort === "started") {
        visible.sort((a, b) => {
            const aTime = a.startedAt ?? -1;
            const bTime = b.startedAt ?? -1;

            if (aTime === -1 && bTime === -1) return 0;
            if (aTime === -1) return 1;
            if (bTime === -1) return -1;

            return bTime - aTime;
        });
    }

    return visible;
}

function clearRenderedTasks() {
    document.querySelectorAll("#task-container li").forEach(li => li.remove());
}

function createTaskElement(task) {
    const listItem = document.createElement("li");
    listItem.id = task.id;

    const actionText = getActionText(task);

    listItem.innerHTML = `
        <div class="task-header">
            <p>${task.taskName}</p>
            <button type="button" class="toggle-details">⌵</button>
        </div>

        <div class="dropdown">
            <p>Created At :- ${formatDateTime(task.createdAt)}</p>
            <p>Started At :- ${formatDateTime(task.startedAt)}</p>
            <p>Ended At :- ${formatDateTime(task.endedAt)}</p>
            <p>Assigned to :- ${task.assignedTo}</p>
            <p>Status :- ${getStatusLabel(task.status)}</p>
            <p>Task ran for :- ${
                task.durationMs !== null
                    ? formatDuration(task.durationMs)
                    : "Not finished yet"
            }</p>
            <button type="button" class="task-action-btn">${actionText}</button>
        </div>
    `;

    const toggleBtn = listItem.querySelector(".toggle-details");
    const dropdown = listItem.querySelector(".dropdown");
    const actionBtn = listItem.querySelector(".task-action-btn");

    toggleBtn.addEventListener("click", () => {
        dropdown.classList.toggle("active");
        toggleBtn.classList.toggle("active");
    });

    actionBtn.addEventListener("click", () => {
        handleTaskAction(task.id);
    });

    return listItem;
}

function renderTasks() {
    clearRenderedTasks();

    const visibleTasks = getVisibleTasks();

    if (visibleTasks.length === 0) {
        const empty = document.createElement("li");
        empty.className = "empty-state";
        empty.textContent = "No tasks match this filter.";
        taskContainer.appendChild(empty);
        return;
    }

    visibleTasks.forEach(task => {
        taskContainer.appendChild(createTaskElement(task));
    });
}

function handleTaskAction(taskId) {
    const taskIndex = tasks.findIndex(task => task.id === taskId);
    if (taskIndex === -1) return;

    const task = tasks[taskIndex];

    if (task.status === "pending") {
        task.status = "in-progress";
        if (task.startedAt === null) task.startedAt = Date.now();
    } else if (task.status === "in-progress") {
        task.status = "completed";
        task.endedAt = Date.now();

        if (task.startedAt !== null) {
            task.durationMs = task.endedAt - task.startedAt;
        }
    } else if (task.status === "completed") {
        tasks.splice(taskIndex, 1);
    }

    saveTasks();
    renderTasks();
}

function addTask() {
    const taskName = taskInput.value.trim();
    const assignedTo = assignedInput.value.trim();

    if (!taskName || !assignedTo) return;

    const taskObj = {
        id: Date.now(),
        taskName,
        assignedTo,
        status: "pending",
        createdAt: Date.now(),
        startedAt: null,
        endedAt: null,
        durationMs: null
    };

    tasks.push(taskObj);
    saveTasks();
    renderTasks();

    taskInput.value = "";
    assignedInput.value = "";
    taskInput.focus();
}

form.addEventListener("submit", e => {
    e.preventDefault();
    addTask();
});

sortBtn.addEventListener("click", e => {
    e.preventDefault();
    sortBtn.classList.toggle("active");
    sortOptions.classList.toggle("active");
});

filterBtn.addEventListener("click", e => {
    e.preventDefault();
    filterBtn.classList.toggle("active");
    filterOptions.classList.toggle("active");
});

document.querySelectorAll(".optionsForSort div").forEach(option => {
    option.addEventListener("click", e => {
        const choice = e.target.textContent.trim();

        if (choice === "Oldest First") currentSort = "oldest";
        else if (choice === "Newest First") currentSort = "newest";

        sortLabel.textContent = `Sorted by ${choice}`;
        sortBtn.classList.remove("active");
        sortOptions.classList.remove("active");
        renderTasks();
    });
});

document.querySelectorAll(".optionsForFilter div").forEach(option => {
    option.addEventListener("click", e => {
        const choice = e.target.textContent.trim();

        if (choice === "All") currentFilter = "all";
        else if (choice === "Pending") currentFilter = "pending";
        else if (choice === "In Progress") currentFilter = "in-progress";
        else if (choice === "Completed") currentFilter = "completed";

        filterLabel.textContent = `Filter: ${choice}`;
        filterBtn.classList.remove("active");
        filterOptions.classList.remove("active");
        renderTasks();
    });
});

document.addEventListener("click", e => {
    if (!sortBtn.contains(e.target) && !sortOptions.contains(e.target)) {
        sortBtn.classList.remove("active");
        sortOptions.classList.remove("active");
    }

    if (!filterBtn.contains(e.target) && !filterOptions.contains(e.target)) {
        filterBtn.classList.remove("active");
        filterOptions.classList.remove("active");
    }
});

renderTasks();
