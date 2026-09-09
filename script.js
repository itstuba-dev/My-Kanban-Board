const board = document.getElementById("board");
const addListSlot = document.getElementById("addListSlot");
const modal = document.getElementById("taskModal");

let currentListId = null;
let idCounter = 0;

function nextId() {
    idCounter += 1;
    return "id" + idCounter;
}

function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}

// Turns any element into an inline editor on click (Enter/blur saves, Esc cancels)
function swapToInput(el, multiline, fallback) {
    const oldText = el.textContent;
    const input = document.createElement(multiline ? "textarea" : "input");
    input.value = oldText;
    input.className = "inline-edit";
    el.replaceChildren(input);
    input.focus();
    if (!multiline) input.select();

    const finish = () => {
        const value = input.value.trim();
        el.textContent = value || fallback;
    };
    input.addEventListener("blur", finish);
    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && (!multiline || !e.shiftKey)) {
            e.preventDefault();
            input.blur();
        }
        if (e.key === "Escape") {
            input.value = oldText;
            input.blur();
        }
    });
}

function addList(title) {
    const listId = nextId();
    const list = document.createElement("div");
    list.className = "list";

    list.innerHTML =
        '<div class="list-header">' +
            '<span class="list-title">' + escapeHtml(title) + "</span>" +
            '<button type="button" class="delete-list-btn" title="Delete list">&times;</button>' +
        "</div>" +
        '<div class="cards" id="cards-' + listId + '"></div>' +
        '<button type="button" class="add-card-btn">+ Add a card</button>';

    const titleEl = list.querySelector(".list-title");
    titleEl.addEventListener("click", () => swapToInput(titleEl, false, "Untitled list"));
    list.querySelector(".delete-list-btn").addEventListener("click", () => list.remove());
    list.querySelector(".add-card-btn").addEventListener("click", () => openModal(listId));

    board.insertBefore(list, addListSlot);
    return listId;
}

function addCard(listId, title, desc) {
    const cardId = nextId();
    const card = document.createElement("div");
    card.className = "card";
    card.id = cardId;
    card.draggable = true;

    card.innerHTML =
        '<div class="card-title">' + escapeHtml(title) + "</div>" +
        (desc ? '<div class="card-desc">' + escapeHtml(desc) + "</div>" : "") +
        '<div class="checkpoints" id="cp-' + cardId + '"></div>' +
        '<div class="cp-progress" id="cpp-' + cardId + '" hidden>' +
            '<div class="cp-bar"><div class="cp-fill"></div></div>' +
            '<span class="cp-count"></span>' +
        "</div>" +
        '<div class="cp-add">' +
            '<input type="text" class="cp-input" placeholder="Add an item..." maxlength="80">' +
            '<button type="button" class="cp-add-btn">Add</button>' +
        "</div>" +
        '<div class="card-actions"><button type="button" class="card-delete">Delete</button></div>';

    card.addEventListener("dragstart", onDragStart);
    card.addEventListener("dragend", onDragEnd);

    const titleEl = card.querySelector(".card-title");
    titleEl.addEventListener("click", (e) => {
        if (!e.target.classList.contains("inline-edit")) swapToInput(titleEl, false, "Untitled");
    });
    const descEl = card.querySelector(".card-desc");
    if (descEl) {
        descEl.addEventListener("click", (e) => {
            if (!e.target.classList.contains("inline-edit")) swapToInput(descEl, true, "");
        });
    }
    card.querySelector(".card-delete").addEventListener("click", () => card.remove());

    const cpInput = card.querySelector(".cp-input");
    const submitCp = () => {
        const text = cpInput.value.trim();
        if (text) addCheckpoint(cardId, text);
        cpInput.value = "";
        cpInput.focus();
    };
    card.querySelector(".cp-add-btn").addEventListener("click", submitCp);
    cpInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") submitCp();
    });

    document.getElementById("cards-" + listId).appendChild(card);
    return cardId;
}

function addCheckpoint(cardId, text) {
    const area = document.getElementById("cp-" + cardId);
    const row = document.createElement("div");
    row.className = "cp-row";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";

    const label = document.createElement("span");
    label.className = "cp-text";
    label.textContent = text;

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "cp-del";
    delBtn.innerHTML = "&times;";
    delBtn.title = "Remove item";

    checkbox.addEventListener("change", () => {
        label.classList.toggle("cp-done", checkbox.checked);
        updateProgress(cardId);
    });
    label.addEventListener("click", () => {
        checkbox.checked = !checkbox.checked;
        checkbox.dispatchEvent(new Event("change"));
    });
    delBtn.addEventListener("click", () => {
        row.remove();
        updateProgress(cardId);
    });

    row.appendChild(checkbox);
    row.appendChild(label);
    row.appendChild(delBtn);
    area.appendChild(row);
    updateProgress(cardId);
}

function updateProgress(cardId) {
    const area = document.getElementById("cp-" + cardId);
    const progress = document.getElementById("cpp-" + cardId);
    const total = area.querySelectorAll("input[type='checkbox']").length;
    const done = area.querySelectorAll("input[type='checkbox']:checked").length;

    if (total === 0) {
        progress.hidden = true;
        return;
    }
    progress.hidden = false;
    const fill = progress.querySelector(".cp-fill");
    fill.style.width = (done / total) * 100 + "%";
    fill.classList.toggle("complete", done === total);
    progress.querySelector(".cp-count").textContent = done + "/" + total;
}

// ---------- Drag & drop ----------

let draggedCard = null;

function onDragStart() {
    draggedCard = this;
    this.classList.add("dragging");
}

function onDragEnd() {
    this.classList.remove("dragging");
    draggedCard = null;
    document.querySelectorAll(".cards.drag-over").forEach((area) => area.classList.remove("drag-over"));
}

// Finds the card the cursor is hovering over so the dragged card can be inserted in place
function cardBelow(area, y) {
    const cards = [...area.querySelectorAll(".card:not(.dragging)")];
    return cards.reduce((closest, card) => {
        const rect = card.getBoundingClientRect();
        const offset = y - rect.top - rect.height / 2;
        return offset < 0 && offset > closest.offset ? { offset: offset, card: card } : closest;
    }, { offset: -Infinity }).card;
}

document.addEventListener("dragover", (e) => {
    if (!draggedCard) return;
    e.preventDefault();
    const area = e.target.closest(".cards");
    if (!area) return;
    document.querySelectorAll(".cards.drag-over").forEach((c) => {
        if (c !== area) c.classList.remove("drag-over");
    });
    area.classList.add("drag-over");
    const after = cardBelow(area, e.clientY);
    if (after) area.insertBefore(draggedCard, after);
    else area.appendChild(draggedCard);
});

document.addEventListener("drop", (e) => {
    if (!draggedCard) return;
    e.preventDefault();
    const area = e.target.closest(".cards");
    if (area) area.classList.remove("drag-over");
});

// ---------- Task modal ----------

function openModal(listId) {
    currentListId = listId;
    document.getElementById("taskTitle").value = "";
    document.getElementById("taskDesc").value = "";
    modal.classList.add("show");
    document.getElementById("taskTitle").focus();
}

function closeModal() {
    modal.classList.remove("show");
}

document.getElementById("saveTaskBtn").addEventListener("click", () => {
    const title = document.getElementById("taskTitle").value.trim();
    const desc = document.getElementById("taskDesc").value.trim();
    if (!title) {
        alert("Please enter a task title.");
        return;
    }
    addCard(currentListId, title, desc);
    closeModal();
});
document.getElementById("cancelTaskBtn").addEventListener("click", closeModal);
modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
});
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
});
document.getElementById("taskTitle").addEventListener("keydown", (e) => {
    if (e.key === "Enter") document.getElementById("saveTaskBtn").click();
});

// ---------- Inline "add list" form ----------

const addListBtn = document.getElementById("addListBtn");
const addListForm = document.getElementById("addListForm");
const newListTitle = document.getElementById("newListTitle");

function closeListForm() {
    addListForm.hidden = true;
    addListBtn.hidden = false;
}

function createList() {
    const title = newListTitle.value.trim();
    if (title) addList(title);
    closeListForm();
}

addListBtn.addEventListener("click", () => {
    addListBtn.hidden = true;
    addListForm.hidden = false;
    newListTitle.value = "";
    newListTitle.focus();
});
document.getElementById("createListBtn").addEventListener("click", createList);
document.getElementById("cancelListBtn").addEventListener("click", closeListForm);
newListTitle.addEventListener("keydown", (e) => {
    if (e.key === "Enter") createList();
});

// Starter content
const todoId = addList("To Do");
addList("Done");
const demoCard = addCard(todoId, "Try me out", "Click any text to edit it, drag me between lists, and play with the checklist below.");
addCheckpoint(demoCard, "Drag this card to the Done list");
addCheckpoint(demoCard, "Tick an item to see the progress bar");