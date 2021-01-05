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
let sizePref;

const setPref = (size) => {
	const stored = store.get(storekey);
	size = (size !== undefined) ? size : stored ? stored : defaultSize;
    size = includes(settings.paginationItems, size) ? size :
                defaultSize; //FIXME probably shouldn't store anything instead?
    console.log(`setPref: storing pagination size ${size}`);
	store.put(storekey, size);
}

const getPref = () => {
    let pref;
    try {
        pref = store.get(storekey);
    } catch (error) {
        console.log("Exception getting size pref:", error);
        pref = undefined;
    }
    console.log(`After getting pref: ${pref}`);
    if (pref === undefined) {
        sizePref = defaultSize;
    } else {
        sizePref = parseInt(pref, 10);
        setPref(sizePref);
    }
    return sizePref;
};

console.log(`Required Pagination module...`);
let pag_view;
let rows_per_page = getPref();
let pag_payload;
let pag_items;
// this.items = items;
// this.setItems(items);
let current_page = 1;
let current_items;
// this.popParentFolder();
// this.computeTotalPages();
let buttons = [];
let $pagination_els;
// this.setupNavigation(items, this.$pagination_els);
let active = false;
// this.sortfn = require('../ext/sort').getSortPref;
// this.initial_sort();
let page_count = 0;
let parentFolder;

const setup = (items) => {
    console.log(`Pagination setup()`);
    // rows_per_page = getPref();
    // pag_payload = item;
    // this.items = items;
    updateItems(items);
    current_page = 1;
    current_items;
    // this.popParentFolder();
    // this.computeTotalPages();
    buttons = [];
    $pagination_els = base.$content.find('.nav_buttons');
    setupNavigation(items, $pagination_els);
    active = true;
    sortfn = require('../ext/sort').getSortPref;
    initial_sort();
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

const first_page = () => { return 1; }
const next_page = () => { return (current_page + 1); }
const prev_page = () => { return (current_page - 1); }
const last_page = () => { return page_count; }

const updateItems = (items) => {
    if (!items){
        items = pag_items;
        return;
    }
    pag_items = items;
    popParentFolder(pag_items);
    computeTotalPages();
}

const isActive = () => {
    // FIXME need more checks?
    return active;
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

//TODO put this in a setter for this.items to compute automatically when it's modified
const computeTotalPages = () => {
    console.log(`computeTotalPages() rows_per_page ${rows_per_page}`);
    if (rows_per_page == 0){
        page_count = 1;
        return 1;
    }
    page_count = Math.ceil(pag_items.length / rows_per_page);
    console.log(`Computed page count: ${page_count}`);
    return page_count;
}


const pushParentFolder = (items) => {
    if (parentFolder && items[0] !== parentFolder) {
        items.unshift(parentFolder);
    }
}

const set_current_page = (page) => {
    const parsed = parseInt(page, 10);
    if (!isNaN(parsed)) {
        current_page = parsed;
    }
    return parsed;
};

const setupNavigation = (items, wrapper) => {
    each(wrapper, key => {
        key.innerHTML = "";
    });

    for (let i = 0; i < btn_cls.length; i++) {
        each(wrapper, key => {
            let btn = paginationButton(btn_cls[i], this);
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
        let {page_input, go_btn} = pageInputForm(items);
        div.appendChild(page_input);
        div.appendChild(go_btn);
        key.appendChild(div);
        buttons.push(page_input);
        buttons.push(go_btn);
    });
}

const updateButtons = () => {
    let prev_buttons =  document.querySelectorAll('#btn_first, #btn_prev');
    let next_buttons =  document.querySelectorAll('#btn_next, #btn_last');
    if (current_page <= 1) {
        each(prev_buttons, button => button.disabled = true);
        each(next_buttons, button => button.disabled = false);
    } else if (current_page >= page_count && current_page > 1) {
        each(next_buttons, button => button.disabled = true);
        each(prev_buttons, button => button.disabled = false);
    } else {
        let nav_buttons = document.querySelectorAll('#btn_first, #btn_prev, #btn_next, #btn_last');
        each(nav_buttons, button => button.disabled = false);
    }
    let page_pos = document.querySelectorAll('.page_pos');
    each(page_pos, el => updatePageStatus(el));
}

const updatePageStatus = (div) => {
    _str = current_page.toString()
        .concat('/', page_count.toString());
    if (!div) {
        div = document.createElement('div');
        div.appendChild(document.createTextNode(_str));
        div.classList.add('page_pos');
        return div;
    }
    return div.innerText = _str;
}

const pageInputForm = () => {
    let input_field = document.createElement('input');
    input_field.type = 'text';
    input_field.classList.add('page_input_text');
    input_field.placeholder = 'page';

    let input_btn = document.createElement('input');
    input_btn.type = 'button';
    input_btn.classList.add('page_input_button');
    input_btn.value = 'GO';
    input_btn.addEventListener('click', () => {
        if (input_field.value !== '' && input_field.value !== current_page) {
            sliceItems(input_field.value);
        }
        input_field.value = "";
        input_field.focus();
    });

    input_field.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && input_field.value && /[^\s]/.test(input_field.value)) {
            if (input_field.value !== current_page) {
                e.preventDefault();
                sliceItems(input_field.value);
            }
            input_field.value = "";
            input_field.focus();
        };
    });

    // Only allow digits, new line and max page, no leading zero or spaces
    setInputFilter(input_field, (value) => {
        return /^[^0\s][\d]*$/.test(value) && value <= page_count;
    });

    return {page_input: input_field, go_btn: input_btn};
}

const refreshItems = (payload) => {
    this.pag_payload = payload;
    this.pag_items = view.filterPayload(pag_payload);
    if (isActive()){
        computeTotalPages();

    }
}

const getNewCurrentPage = () => {
    page = (current_page <= last_page()) ? current_page : last_page();
    console.log(`getNewCurrentPage: ${page}`);
    return page;
}

// FIXME take into account the parent dir which counts towards items length
const sliceItems = (page, update = true) => {
    page = set_current_page(page); // FIXME can be improved
    if (isNaN(page)) {
        console.log(`Page ${page} is NaN!`);
        return;
    }
    // console.log(`sliceItems: at page ${page}, current_page ${this.current_page}, rows: ${this.rows_per_page}`);

    let paginatedItems = computeSlice(
        pag_items, current_page, rows_per_page);
    pushParentFolder(paginatedItems);

    if (update) {
        updateButtons();
        if (last_page() <= 1) {
            base.$content.find('.nav_buttons').addCls('hidden');
            active = false;
        } else {
            base.$content.find('.nav_buttons').rmCls('hidden');
            active = true;
        }
        console.log(`SliceItems(${page}) pagination ${active ? 'active' : 'inactive'}`);
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
    let start = rows_per_page * page;
    let end = start + rows_per_page;
    return items.slice(start, end);
}

const sort = (fn) => {
    pag_items = values(pag_payload.content).sort(fn);
    // event.pub('pagination.refreshed', this.pag_payload, [], []);
}

const initial_sort = (update = false) => {
    sort(sortfn());
    page = getNewCurrentPage();
    sliceItems(page, update);
}


// Restricts input for the given textbox to the given inputFilter function.
// In the future we could use beforeinput instead.
function setInputFilter(textbox, inputFilter) {
    ["input", "keydown", "keyup", "mousedown", "mouseup", "select",
    "contextmenu", "drop"].forEach(function(event) {
        textbox.addEventListener(event, function(e) {
            if (this.value === '') {
                this.oldValue = this.value;
                // return;
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

const paginationButton = (cls) => {
	let button = document.createElement('button');
    button.innerText = cls[1];
    button.classList.add('nav_button');

    button.id = cls[0];

    switch (cls[0]) {
        case 'btn_prev':
            button.req_page = prev_page;
            button.disabled = true;
            break;
        case 'btn_next':
            button.req_page = next_page;
            button.disabled = false;
            break;
        case 'btn_last':
            button.req_page = last_page;
            button.disabled = false;
            break;
        default: // 'btn_first'
            button.req_page = first_page;
            button.disabled = true;
	}
	button.addEventListener('click', function () {
		sliceItems(this.req_page());
	});
	return button;
};


const destroyNavBar = (el) => {
    // page_nav.buttons.forEach(el => {
    //     // el.removeEventListener()
    //     // delete el;
    // });
    el.innerHTML = "";
    // each(el.childNodes, e => {
    //     if (e !== undefined) e.remove();
    // });
};

// Return an array of selectable options for the select list
const addOptions = (cached_pref) => {
    let options = [];
    if (cached_pref === undefined){
        cached_pref = defaultSize;
    }
    let has_set = false;
    // TODO translations needed here
    for (let size of sortedSizes){
        let element;
        let label = size === 0? 'ALL' :`${size} per page`;
        if (size === cached_pref && !has_set) {
            element = `<option selected value="${size}">${label}</option>`;
            has_set = true;
        } else {
            element = `<option value="${size}">${label}</option>`;
        }
        options.push(element);
    }
    return options;
}


function onSelect() {
    console.log(`selected ${this.value}`);
    sizePref = parseInt(this.value, 10);
    setPref(sizePref);
    onPagPrefUpdated(sizePref);
}

const onLocationChanged = item => {
    // Workaround to append this in the sidebar at last position since
    // the view module includes us before the other extensions
    if (document.querySelectorAll('#pag_select').length === 0){
        addSelector();
    }
}

const addSelector = () => {
    if (settings.paginationItems.length > 0) {
        dom(selectorTpl).appTo('#sidebar');

        document.querySelector('#pag_select')
            .addEventListener('change', onSelect);

        let cached_pref = getCachedPref();

        for (let item of addOptions(cached_pref)) {
            dom(item).appTo('#pag_select');
        }
    }
};

const setPayload = (payload) => {
    pag_payload = payload;
}

const getCachedPref = () => {
    if (sizePref === undefined)
        return defaultSize;
    return sizePref;
};

// The module won't work if a view is not set first!
const setView = (view) => {
    pag_view = view;
}

const setNumRows = (num) => {
    rows_per_page = num;
    computeTotalPages();
}

const onPagPrefUpdated = (pref) => {
    console.log(`Pagination updated, isActive? ${isActive()}`);
    if (!isActive()) {
        // setup(displayItems.slice(0));
        setup(); // reuse cached items
        setNumRows(pref);
        sliceItems(1);
        return;
    }
    setNumRows(pref);
    page = getNewCurrentPage();
    // console.log(`Result page ${page}, because ${page_nav.current_page}/ ${page_nav.last_page}`);
    sliceItems(page);
}

const isHandled = (item) => {
    setPayload(item);
    // Block if pagination is active
    console.log(`Refresh->items.len=${values(item.content).length}, pref: ${getCachedPref()}`);
    if (values(item.content).length > getCachedPref()) {
        if (isActive()){
            updateItems(pag_view.filterPayload(item));
            // page_nav.computeTotalPages();
            initial_sort(true);
            return true;
        }
        setup(pag_view.filterPayload(item));
        sliceItems(1);
        return true;
    }
    // we don't need pagination for now...
    // We recreate the items and remove ourselves to leave the default logic
    // do its thing
    if (isActive()){
        console.log(`WARN: location refresh, pagination Active but not needed anymore...`);
        // page_nav.items = values(item.content);
        updateItems(pag_view.filterPayload(item)); //BUG?
        // page_nav.computeTotalPages();
        sliceItems(1);
        // inst.buttons.forEach(e => e.remove());
        // delete inst.buttons;
        // inst = undefined;
        clear();
        return true;
    }
    // We are not interested in handling the items
    return false;
}


const init = () => {
    console.log("init from pagination");
    setPref();
    getPref();
    event.sub('location.changed', onLocationChanged);
};

init();

module.exports = {
	$el: $pagination,
    getPref,
    getCachedPref,
    pag_payload,
    updateItems,
    initial_sort,
    setup,
    sliceItems,
    isActive,
    clear,
    computeTotalPages,
    last_page,
    current_page,
    setNumRows,
    setPayload,
    sort,
    setView,
    getNewCurrentPage,
    isHandled,
}
