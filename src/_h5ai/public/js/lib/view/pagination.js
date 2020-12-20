const {each, includes, dom} = require('../util');
const event = require('../core/event');
// const location = require('../core/location');
const store = require('../core/store');
const allsettings = require('../core/settings');
const base = require('./base');
// const view = require('./view');
const sidebar = require('./sidebar');

const paginationItems = [100, 0, 50, 250, 500];
const settings = Object.assign({
    paginationItems,
    hideParentFolder: false,
}, allsettings.view);
// FIXME write function to make sure paginationItems is not empty
const defaultSize = settings.paginationItems[0];
const sortedSizes = [...new Set(settings.paginationItems)].sort((a, b) => a - b)
const storekey = 'pagination';
const paginationTpl =
        `<div id="pagination_btm" class="pagination">
            <div id="nav_btm" class="nav_buttons"></div>
        </div>`;
const selectorTpl =
`
<div id="pag_sidebar" class="block">
<h1 class="l10n-pagination">Pagination</h1>
    <form id="pag_form">
        <select id="pag_select" name='Pagination size'>
        </select>
        <noscript><input type="submit" value="Submit"></noscript>
    </form>
</div>
`
const $pagination = dom(paginationTpl);
const btn_cls = [['btn_first', '<<'], ['btn_prev', '<'], ['btn_next', '>'], ['btn_last', '>>']];
let sizePref;

class Pagination {
    constructor(items, view) {
		this.view = view;
        this.rows_per_page = getPref();
        this.items = items;
        this.current_page = 1;
        this.current_items;
        this.popParentFolder();
        this.computeTotalPages();
        this.buttons = [];
        this.$pagination_els = base.$content.find('.nav_buttons');
        this.setupPagination(items, this.$pagination_els);
    }
    get next_page() { return (this.current_page + 1); }
    get prev_page() { return (this.current_page - 1); }
    get last_page() { return this.page_count; }

    computeTotalPages() {
        if (this.rows_per_page == 0){
            this.page_count = 1;
            return 1;
        }
        this.page_count = Math.ceil(this.items.length / this.rows_per_page);
        console.log(`Computed page count: ${this.page_count}`);
        return this.page_count;
    }

    popParentFolder() {
        if (this.items.length > 0 && !settings.hideParentFolder){
            let first = this.items.shift();
            this.parentFolder = first;
            console.log(`shifted items ${items}, parent ${this.parentFolder}`);
            return;
        }
        this.parentFolder = undefined;
    }

    pushParentFolder(items) {
        if (this.parentFolder && items[0] !== this.parentFolder) {
            items.unshift(this.parentFolder);
        }
    }

    set_current_page(page) {
        const parsed = parseInt(page, 10);
        if (!isNaN(parsed)) {
            this.current_page = parsed;
        }
        return parsed;
    };

    setupPagination(items, wrapper) {
        each(wrapper, key => {
            key.innerHTML = "";
        });

        for (let i = 0; i < btn_cls.length; i++) {
            each(wrapper, key => {
                let btn = paginationButton(btn_cls[i], this);
                key.appendChild(btn);
                this.buttons.push(btn);
            });
        }

        each(wrapper, key => {
            // Page status
            let div = this.updatePageStatus(null);
            key.insertBefore(div, key.childNodes[2]);
            this.buttons.push(div);

            // Page number selection
            div = document.createElement('div');
            div.classList.add('page_input');
            let {page_input, go_btn} = this.pageInputForm(items);
            div.appendChild(page_input);
            div.appendChild(go_btn);
            key.appendChild(div);
            this.buttons.push(page_input);
            this.buttons.push(go_btn);
        });
	}

	updateButtons() {
		let prev_buttons =  document.querySelectorAll('#btn_first, #btn_prev');
		let next_buttons =  document.querySelectorAll('#btn_next, #btn_last');
		if (this.current_page <= 1) {
			each(prev_buttons, button => button.disabled = true);
			each(next_buttons, button => button.disabled = false);
		} else if (this.current_page >= this.page_count && this.current_page > 1) {
			each(next_buttons, button => button.disabled = true);
			each(prev_buttons, button => button.disabled = false);
		} else {
			let nav_buttons = document.querySelectorAll('#btn_first, #btn_prev, #btn_next, #btn_last');
			each(nav_buttons, button => button.disabled = false);
		}
		let page_pos = document.querySelectorAll('.page_pos');
		each(page_pos, el => this.updatePageStatus(el));
	}

	updatePageStatus(div) {
        _str = this.current_page.toString()
            .concat('/', this.page_count.toString());
		if (!div) {
			div = document.createElement('div');
			div.appendChild(document.createTextNode(_str));
			div.classList.add('page_pos');
			return div;
		}
		return div.innerText = _str;
	}

	pageInputForm() {
		let input_field = document.createElement('input');
		input_field.type = 'text';
		input_field.classList.add('page_input_text');
		input_field.placeholder = 'page';

		let input_btn = document.createElement('input');
		input_btn.type = 'button';
		input_btn.classList.add('page_input_button');
		input_btn.value = 'GO';
		input_btn.addEventListener('click', () => {
			if (input_field.value !== '' && input_field.value !== this.current_page) {
				this.sliceItems(input_field.value);
			}
			input_field.value = "";
			input_field.focus();
		});

		input_field.addEventListener('keydown', (e) => {
			if (e.key === 'Enter' && input_field.value && !/[^\s]/.test(input_field.value)) {
				if (input_field.value !== this.current_page) {
					e.preventDefault();
					this.sliceItems(input_field.value);
				}
				input_field.value = "";
				input_field.focus();
			};
		});

		// Only allow digits, Enter and max page, no leading zero or spaces
		setInputFilter(input_field, (value) => {
			return /^[^0\s][\d]*$/.test(value) && value <= this.page_count;
		});

		return {page_input: input_field, go_btn: input_btn};
	}

	sliceItems(page, update = true) {
		page = this.set_current_page(page); // FIXME can be improved
		if (isNaN(page)) {
            console.log(`Page ${page} is NaN!`);
			return;
        }
        console.log(`sliceItems: at page ${page}, current_page ${this.current_page}, rows: ${this.rows_per_page}`);

        let paginatedItems = this.computeSlice(
                    this.items, this.current_page, this.rows_per_page);
        this.pushParentFolder(paginatedItems);

        if (update) {
            this.updateButtons();
            if (this.last_page == 1) {
                base.$content.find('.nav_buttons').addCls('hidden');
            } else {
                base.$content.find('.nav_buttons').rmCls('hidden');
            }
            this.view.setItems(paginatedItems);
        }
        // this.current_items = paginatedItems;
        // return paginatedItems;
    }

    computeSlice(items, page, rows_per_page){
        // FIXME this returns either a ref to items, or a shallow copy (the slice)
        if (!rows_per_page){
            return items;
        }
        page--;
		let start = rows_per_page * page;
		let end = start + rows_per_page;
		return items.slice(start, end);
    }
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

const paginationButton = (cls, page_nav) => {
	let button = document.createElement('button');
    button.innerText = cls[1];
    button.classList.add('nav_button');

    button.id = cls[0];

    switch (cls[0]) {
        case 'btn_prev':
            button.req_page = () => page_nav.prev_page;
            button.disabled = true;
            break;
        case 'btn_next':
            button.req_page = () => page_nav.next_page;
            button.disabled = false;
            break;
        case 'btn_last':
            button.req_page = () => page_nav.last_page;
            button.disabled = false;
            break;
        default: // 'btn_first'
            button.req_page = () => 1;
            button.disabled = true;
	}
	button.addEventListener('click', function () {
		page_nav.sliceItems(this.req_page());
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
const addOptions = () => {
    var options = [];
    // TODO translations needed here
    for (let size of sortedSizes){
        let label = size === 0? 'ALL' :`${size} per page`;
        let element = size === defaultSize ?
            `<option selected value="${size}">${label}</option>` :
            `<option value="${size}">${label}</option>`
        options.push(element);
    }
    return options;
}

function onSelect() {
    console.log(`selected ${this.value}`);
    sizePref = parseInt(this.value, 10);
    setPref(sizePref);
    event.pub('pagination.pref.changed', sizePref);
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

        for (let item of addOptions()) {
            dom(item).appTo('#pag_select');
        }
    }
};

const setPref = (size) => {
	const stored = store.get(storekey);
	size = (size !== undefined) ? size : stored ? stored : defaultSize;
    size = includes(settings.paginationItems, size) ?
        size :
        defaultSize; //FIXME probably shouldn't store anything instead?
    console.log(`setPref: storing pagination size ${size}`);
	store.put(storekey, size);
}

const getCachedPref = () => {
    if (sizePref === undefined)
        return defaultSize;
    return sizePref;
};

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

const init = () => {
    setPref();
    getPref();
    event.sub('location.changed', onLocationChanged);
};

init();

module.exports = {
	$el: $pagination,
    getPref,
    getCachedPref,
	Pagination
}