
const form = document.getElementById("task-form");
const titleInput = document.getElementById("task-title");
const descriptionInput = document.getElementById("task-description");
const taskList = document.getElementById("task-list");
const statusMessage = document.getElementById("status-message");
const submitButton = document.getElementById("task-submit");
const cancelButton = document.getElementById("cancel-edit");
const formHeading = document.getElementById("form-heading");

let apiUrl;
let apiKey;
let editingId = null;

function showMessage(message, error = false) {
    statusMessage.textContent = message;
    statusMessage.classList.toggle("error", error);
}

async function initialize() {
    try {
        const response = await fetch("config.json");

        if (!response.ok) {
            throw new Error("Cannot load config.json");
        }

        const config = await response.json();

        if (!config.supabaseUrl || !config.supabasePublishableKey ||
            config.tableName !== "tasks") {
            throw new Error("Invalid Supabase configuration");
        }

        apiUrl = config.supabaseUrl.replace(/\/$/, "") +
            "/rest/v1/" + config.tableName;

        apiKey = config.supabasePublishableKey;

        await loadTasks();
    } catch (error) {
        showMessage(error.message, true);
    }
}

async function request(endpoint = "", options = {}) {
    const response = await fetch(apiUrl + endpoint, {
        ...options,
        headers: {
            "apikey": apiKey,
            "Content-Type": "application/json",
            "Prefer": "return=representation",
            ...options.headers
        }
    });

    if (!response.ok) {
        const details = await response.text();
        throw new Error("Database error: " + details);
    }

    if (response.status === 204) {
        return null;
    }

    return response.json();
}

async function loadTasks() {
    try {
        const tasks = await request("?select=*&order=id.desc");
        taskList.replaceChildren();

        if (tasks.length === 0) {
            taskList.textContent = "No tasks yet. Add your first task!";
            return;
        }

        tasks.forEach(displayTask);
    } catch (error) {
        showMessage(error.message, true);
    }
}

function createButton(text, className, handler) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = text;
    button.className = className;
    button.addEventListener("click", handler);
    return button;
}

function displayTask(task) {
    const item = document.createElement("div");
    item.className = "task-item";
    item.dataset.id = task.id;

    if (task.completed) {
        item.classList.add("completed");
    }

    const title = document.createElement("h3");
    title.className = "task-title";
    title.textContent = task.title;

    const description = document.createElement("p");
    description.className = "task-description";
    description.textContent = task.description || "";

    const status = document.createElement("span");
    status.className = "task-status";
    status.textContent = task.completed ? "Completed" : "Pending";

    const actions = document.createElement("div");
    actions.className = "task-actions";

    const editButton = createButton("Edit", "edit-task", () => {
        editingId = task.id;
        titleInput.value = task.title;
        descriptionInput.value = task.description || "";
        submitButton.textContent = "Save Changes";
        formHeading.textContent = "Edit Task";
        cancelButton.hidden = false;
        titleInput.focus();
    });

    const toggleButton = createButton(
        task.completed ? "Incomplete" : "Complete",
        "toggle-task",
        () => updateTask(task.id, { completed: !task.completed })
    );

    const deleteButton = createButton(
        "Delete",
        "delete-task",
        () => deleteTask(task.id)
    );

    actions.append(editButton, toggleButton, deleteButton);
    item.append(title, description, status, actions);
    taskList.appendChild(item);
}

function resetForm() {
    form.reset();
    editingId = null;
    submitButton.textContent = "Add Task";
    formHeading.textContent = "Add New Task";
    cancelButton.hidden = true;
}

async function updateTask(id, data) {
    try {
        await request("?id=eq." + encodeURIComponent(id), {
            method: "PATCH",
            body: JSON.stringify(data)
        });

        showMessage("Task updated successfully!");
        await loadTasks();
    } catch (error) {
        showMessage(error.message, true);
    }
}

async function deleteTask(id) {
    try {
        await request("?id=eq." + encodeURIComponent(id), {
            method: "DELETE"
        });

        if (editingId === id) {
            resetForm();
        }

        showMessage("Task deleted successfully!");
        await loadTasks();
    } catch (error) {
        showMessage(error.message, true);
    }
}

form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const title = titleInput.value.trim();
    const description = descriptionInput.value.trim();

    if (!title) {
        showMessage("Task title is required.", true);
        return;
    }

    submitButton.disabled = true;

    try {
        if (editingId !== null) {
            await request("?id=eq." + encodeURIComponent(editingId), {
                method: "PATCH",
                body: JSON.stringify({ title, description })
            });

            showMessage("Task updated successfully!");
        } else {
            await request("", {
                method: "POST",
                body: JSON.stringify({
                    title,
                    description,
                    completed: false
                })
            });

            showMessage("Task added successfully!");
        }

        resetForm();
        await loadTasks();
    } catch (error) {
        showMessage(error.message, true);
    } finally {
        submitButton.disabled = false;
    }
});

cancelButton.addEventListener("click", resetForm);

initialize();
