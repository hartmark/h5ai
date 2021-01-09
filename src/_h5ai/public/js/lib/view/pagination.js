const {each, includes, dom, values} = require('../util');
const event = require('../core/event');
const store = require('../core/store');
const allsettings = require('../core/settings');
const base = require('./base');

const paginationItems = [100, 0, 50, 250, 500];
const settings = Object.assign({
    paginationItems,
    hideParentFolder: false,
}, allsettings.view);
const defaultSize = settings.paginationItems.length ? settings.paginationItems[0] : 0;
const sortedSizes = [...new Set(settings.paginationItems)].sort((a, b) => a - b)
const storekey = 'pagination';
const paginationTpl =
        `<div id="pagination_btm" class="pagination">
            <div id="nav_btm" class="nav_buttons"></div>
        </div>`;
const selectorTpl =
        `<div id="pag_sidebar" class="block">
        <h1 class="l10n-pagination">Pagination</h1>
            <form id="pag_form">
                <select id="pag_select" name='Pagination size'>
                </select>
                <noscript><input type="submit" value="Submit"></noscript>
            </form>
        </div>`;
const $pagination = dom(paginationTpl);
const btn_cls = [['btn_first', '<<'], ['btn_prev', '<'], ['btn_next', '>'], ['btn_last', '>>']];

let active = false;
let buttons = [];
let current_page = 1;
let pag_items;
let pag_payload;
let pag_view;
let page_count = 0;
let parentFolder;
let rowsPref;

const setup = (items) => {
    console.log(`setup(items.length=${items ? items.length : items})`);
    updateItems(items);
    current_page = 1;
    buttons = [];
    let $pagination_els = base.$content.find('.nav_buttons');
    setupNavigation($pagination_els);
    active = true;
    sortfn = require('../ext/sort').getSortFunc;
    initialSort();
}

const updateItems = (items) => {
    if (!items){
        // send back "cached" items
        console.log(`updateItems(${items})`);
        items = pag_items;
        return;
    }
    pag_items = items;
    popParentFolder(pag_items);
    totalPages();
}

const clear = () => {
    console.log("Pagination clear()");
    if (active){
        buttons.forEach(e => e.remove());
        // delete buttons;
        buttons = [];
    }
    active = false;
}

const isActive = () => {
    // FIXME need more checks?
    return active;
}

const totalPages = () => {
    console.log(`totalPages() rowsPref ${rowsPref}`);
    if (rowsPref == 0){  // ALL
        return page_count = 1;
    }
    page_count = Math.ceil(pag_items.length / rowsPref);
    console.log(`Computed page count: ${page_count}`);
    return page_count;
}

const popParentFolder = (items) => {
    if (items.length > 0 && !settings.hideParentFolder){
        parentFolder = items.shift();
        console.log(`popParentFolder: parentFolder = ${parentFolder.label}`);
        return;
    }
    parentFolder = undefined;
    console.log(`popParentFolder: parentFolder ${parentFolder}`);
}

const pushParentFolder = (items) => {
    if (parentFolder && items[0] !== parentFolder) {
        items.unshift(parentFolder);
    }
}

// FIXME take into account the parent dir which counts towards items length
const setCurrentPage = (page, update = true) => {
    if (isNaN(page)) {
        throw(`Page ${page} is not a number!`);
    }
    current_page = page;
    // console.log(`setCurrentPage: at page ${page}, current_page ${this.current_page}, rows: ${this.rowsPref}`);

    const paginatedItems = computeSlice(
        pag_items, current_page, rowsPref);

    pushParentFolder(paginatedItems);

    if (update) {
        updateButtons();
        if (page_count <= 1) {
            base.$content.find('.nav_buttons').addCls('hidden');
            active = false;
        } else {
            base.$content.find('.nav_buttons').rmCls('hidden');
            active = true;
        }
        console.log(`setCurrentPage(${page}) pagination ${active ? 'active' : 'inactive'}`);
        pag_view.doSetItems(paginatedItems);
    }
    // this.current_items = paginatedItems;
    // return paginatedItems;
}

const computeSlice = (items, page, rows_per_page) => {
    // FIXME this returns either a ref to items, or a shallow copy (the slice)
    if (!rows_per_page){
        return items;
    }
    page--;
    const start = rows_per_page * page;
    const end = start + rows_per_page;
    return items.slice(start, end);
}

const getNewCurrentPage = () => {
    // Recompute the current page
    const page = (current_page <= page_count) ? current_page : page_count;
    console.log(`getNewCurrentPage(): ${page}`);
    return page;
}

const sort = (fn) => {
    // Do not filterPayload, we don't need parent folder item
    pag_items = values(pag_payload.content).sort(fn);
}

const initialSort = (update = false) => {
    sort(sortfn());
    setCurrentPage(getNewCurrentPage(), update);
}

const setupNavigation = (wrapper) => {
    each(wrapper, key => {
        key.innerHTML = "";
    });

    for (let i = 0; i < btn_cls.length; i++) {
        each(wrapper, key => {
            const btn = paginationButton(btn_cls[i], this);
            key.appendChild(btn);
            buttons.push(btn);
        });
    }

    each(wrapper, key => {
        // Page status numbers
        let div = updatePageStatus(null);
        key.insertBefore(div, key.childNodes[2]);
        buttons.push(div);

        // Manual page number selection
        div = document.createElement('div');
        div.classList.add('page_input');
        let {input_field, input_btn} = pageInputForm();
        div.appendChild(input_field);
        div.appendChild(input_btn);
        key.appendChild(div);
        buttons.push(input_field);
        buttons.push(input_btn);
    });
}

const paginationButton = (cls) => {
	const button = document.createElement('button');
    button.innerText = cls[1];
    button.classList.add('nav_button');

    button.id = cls[0];

    switch (cls[0]) {
        case 'btn_prev':
            button.req_page = () => current_page - 1;
            button.disabled = true;
            break;
        case 'btn_next':
            button.req_page = () => current_page + 1;
            button.disabled = false;
            break;
        case 'btn_last':
            button.req_page = () => page_count;
            button.disabled = false;
            break;
        default: // 'btn_first'
            button.req_page = () => 1;
            button.disabled = true;
	}
	button.addEventListener('click', function() {
		setCurrentPage(this.req_page());
	});
	return button;
};

const updateButtons = () => {
    const prev_buttons =  dom('#btn_first, #btn_prev');
    const next_buttons =  dom('#btn_next, #btn_last');
    if (current_page <= 1) {
        each(prev_buttons, button => button.disabled = true);
        each(next_buttons, button => button.disabled = false);
    } else if (current_page >= page_count && current_page > 1) {
        each(next_buttons, button => button.disabled = true);
        each(prev_buttons, button => button.disabled = false);
    } else {
        const nav_buttons = dom('#btn_first, #btn_prev, #btn_next, #btn_last');
        each(nav_buttons, button => button.disabled = false);
    }
    const pag_pos = dom('.pag_pos');
    each(pag_pos, el => updatePageStatus(el));
}

const updatePageStatus = (div) => {
    const status = current_page.toString().concat('/', page_count.toString());
    if (!div) {
        const div = document.createElement('div');
        div.appendChild(document.createTextNode(status));
        div.classList.add('pag_pos');
        return div;
    }
    return div.innerText = status;
}

const pageInputForm = () => {
    const input_field = document.createElement('input');
    input_field.type = 'text';
    // Use title instead of placeholder due to some translations not fitting in
    input_field.classList.add('l10n_title-pagInputTxt'); // input_field.title = 'page';
    input_field.placeholder = '...';

    const input_btn = document.createElement('input');
    input_btn.type = 'button';
    input_btn.classList.add('l10n_val-pagInputBtn'); // input_btn.value = 'GO';

    input_btn.addEventListener('click', () => {
        if (input_field.value !== '' && input_field.value !== current_page) {
            let parsed = parseInt(input_field.value, 10);
            if (!isNaN(parsed)) {
                setCurrentPage(parsed);
            }
        }
        input_field.value = "";
        input_field.focus();
    });

    input_field.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && input_field.value && /[^\s]/.test(input_field.value)) {
            if (input_field.value !== current_page) {
                e.preventDefault();
                let parsed = parseInt(input_field.value, 10);
                if (!isNaN(parsed) && parsed !== current_page) {
                    setCurrentPage(parsed);
                }
            }
            input_field.value = "";
            input_field.focus();
        };
    });

    // Only allow digits, new line and max page, no leading zero or spaces
    setInputFilter(input_field, (value) => {
        return /^[^0\s][\d]*$/.test(value) && value <= page_count;
    });

    return {input_field, input_btn};
}

// Restricts input for the given textbox to the given inputFilter function.
// In the future we could use beforeinput instead.
function setInputFilter(textbox, inputFilter) {
    ["input", "keydown", "keyup", "mousedown", "mouseup", "select",
    "contextmenu", "drop"].forEach(function(event) {
        textbox.addEventListener(event, function(e) {
            if (this.value === '') {
                this.oldValue = this.value;
            }
            if (inputFilter(this.value)) {
                this.oldValue = this.value;
                this.oldSelectionStart = this.selectionStart;
                this.oldSelectionEnd = this.selectionEnd;
            } else if (this.hasOwnProperty("oldValue")) {
                this.value = this.oldValue;
                this.setSelectionRange(this.oldSelectionStart, this.oldSelectionEnd);
            } else {
                this.value = "";
            }
        });
    });
}

const initPagSelector = () => {
    if (settings.paginationItems.length > 0) {
        dom(selectorTpl).appTo('#sidebar');

        document.querySelector('#pag_select')
            .addEventListener('change', onSelect);

        const cached_pref = getCachedPref();

        for (let option of addOptions(cached_pref)) {
            option.appTo('#pag_select');
        }
    }
};

function onSelect() {
    setPref(parseInt(this.value, 10));
    onPagPrefUpdated();
}

// Return an array of selectable options for the select list
const addOptions = (cached_pref) => {
    const options = [];
    if (cached_pref === undefined){
        cached_pref = defaultSize;
    }
    let set_default = false;
    for (let size of sortedSizes){
        let element;
        if (size === cached_pref && !set_default) {
            element = dom(`<option selected value="${size}"></option>`);
            set_default = true;
        } else {
            element = dom(`<option value="${size}"></option>`);
        }
        element.addCls((size === 0) ? 'l10n-displayAll' : 'l10n_rp-perPage');
        options.push(element);
    }
    return options;
}

const onLocationChanged = item => {
    // Workaround to append this to the sidebar at the last position
    // since the view module includes us before the other extensions
    if (dom('#pag_select').length === 0){
        initPagSelector();
    }
}

const setPayload = (payload) => {
    // FIXME not a copy, we probably should not alter it.
    pag_payload = payload;
}

const getCachedPref = () => {
    if (rowsPref === undefined)
        return defaultSize;
    return rowsPref;
};

// The module won't work if a view is not set first! We need to reuse some funcs
const setView = (view) => {
    pag_view = view;
}

const onPagPrefUpdated = () => {
    console.log(`PagPref Updated while ${isActive() ? "active" : "not active"}.`);
    if (isActive()) {
        totalPages();
        setCurrentPage(getNewCurrentPage());
        return;
    }
    // setup(displayItems.slice(0));
    setup(); // reuse cached items
    totalPages();
    setCurrentPage(1);
}

const canHandle = (items) => {
    clear();
    if (items.length > getCachedPref()) {
        setup(items.slice(0)); // copy displayItems
        setCurrentPage(1);
        return true;
    }
    return false;
}

const isSortHandled = (fn) => {
    if (!isActive()) {
        return false;
    }
    sort(fn);
    setCurrentPage(getNewCurrentPage());
    return true;
}

const isRefreshHandled = (item) => {
    setPayload(item);
    // Block if pagination is active
    console.log(`Refresh->items.len=${values(item.content).length}, pref: ${getCachedPref()}`);
    if (values(item.content).length > getCachedPref()) {
        if (isActive()){
            updateItems(pag_view.filterPayload(item));
            // page_nav.totalPages();
            initialSort(true);
            return true;
        }
        setup(pag_view.filterPayload(item));
        setCurrentPage(1);
        return true;
    }
    // No need for pagination, recreate the items, hide, pass to default logic
    if (isActive()){
        console.log(`WARN: location refresh, pagination Active but not needed anymore...`);
        // page_nav.items = values(item.content);
        updateItems(pag_view.filterPayload(item)); //BUG?
        // page_nav.totalPages();
        setCurrentPage(1);
        clear();
        return true;
    }
    // We are not interested in handling the items
    return false;
}

const setPref = (size) => {
	const stored = store.get(storekey);
    size = (size !== undefined) ? size : stored ? stored : defaultSize;
    size = includes(settings.paginationItems, size) ? size : defaultSize;
    store.put(storekey, size);
    rowsPref = size;
}

const init = () => {
    setPref();
    event.sub('location.changed', onLocationChanged);
};

init();

module.exports = {
	$el: $pagination,
    canHandle,
    clear,
    getCachedPref,
    getNewCurrentPage,
    isActive,
    isRefreshHandled,
    isSortHandled,
    setPayload,
    setup,
    setView,
    setCurrentPage,
}
