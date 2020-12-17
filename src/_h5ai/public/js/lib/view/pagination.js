const {each, map, includes, intersection, dom} = require('../util');
// const event = require('../core/event');
// const format = require('../core/format');
// const location = require('../core/location');
// const resource = require('../core/resource');
const store = require('../core/store');
const allsettings = require('../core/settings');
const base = require('./base');
// const view = require('./view');

const paginationItems = [100, 0, 50, 250, 500];
const settings = Object.assign({
	paginationItems
}, allsettings.view);
const defaultSize = settings.paginationItems[0];
// FIXME: make sure each value is unique (cast to a set?)
const sortedSizes = settings.paginationItems.sort((a, b) => a - b);
const storekey = 'pagination';
const paginationTpl =
        `<div id="pagination_btm" class="pagination">
            <div id="nav_btm" class="nav_buttons"></div>
		</div>`;
const $pagination = dom(paginationTpl);
const btn_cls = [['btn_first', '<<'], ['btn_prev', '<'], ['btn_next', '>'], ['btn_last', '>>']];
var page_nav = undefined;

const getDefaultSize = () => {
	return defaultSize;
};

const set = (size) => {
	const stored = store.get(storekey);
	size = size || stored && stored.size;
	size = includes(settings.paginationItems, size) ? size : settings.paginationItems[0];
	store.put(storekey, size);
}

const getAvailableSizes = () => sortedSizes;
const getStoredSize = () => store.get(storekey).size;


class Pagination {
    constructor(items, view) {
		this.view = view;
        this.rows_per_page = defaultSize; //TODO user selection should change this
        this.items = items;
        this.current_page = 1;
        this.page_count = Math.ceil(items.length / this.rows_per_page);
        this.buttons = [];
        this.$pagination_els = base.$content.find('.nav_buttons');
        this.setupPagination(items, this.$pagination_els);
    }
    get next_page() { return (this.current_page + 1); }
    get prev_page() { return (this.current_page - 1); }
    get last_page() { return this.page_count; }

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
                let btn = paginationButton(btn_cls[i], items, this);
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
		let prev_buttons =  document.querySelectorAll('.btn_first, .btn_prev');
		let next_buttons =  document.querySelectorAll('.btn_next, .btn_last');
		if (this.current_page <= 1) {
			each(prev_buttons, button => button.disabled = true);
			each(next_buttons, button => button.disabled = false);
		} else if (this.current_page >= this.page_count && this.current_page > 1) {
			each(next_buttons, button => button.disabled = true);
			each(prev_buttons, button => button.disabled = false);
		} else {
			let nav_buttons = document.querySelectorAll('.btn_first, .btn_prev, .btn_next, .btn_last');
			each(nav_buttons, button => button.disabled = false);
		}
		let page_pos = document.querySelectorAll('.page_pos');
		each(page_pos, el => this.updatePageStatus(el));
	}

	updatePageStatus(div) {
		_str = this.current_page.toString().concat('/', this.page_count.toString());
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

	sliceItems(page) {
		page = this.set_current_page(page); // FIXME
		if (isNaN(page)) {
			return;
		}
		page--;
		let start = this.rows_per_page * page;
		let end = start + this.rows_per_page;
		let paginatedItems = this.items.slice(start, end);

		this.updateButtons();
		this.view.setItems(paginatedItems);
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

const paginationButton = (cls, items, page_nav) => {
	let button = document.createElement('button');
    button.innerText = cls[1];

    _class = cls[0];
    button.classList.add(_class);

    switch (_class) {
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
	// FIXME can we set this to page nav instead?
    button.items = items;

	button.addEventListener('click', function onButtonClicked() {
		page_nav.sliceItems(this.req_page());
	});
	return button;
};


const destroyNavBar = (el) => {
    // page_nav.buttons.forEach(el => {
    //     // el.removeEventListener()
    //     // delete el;
    // });
    console.log("destroying el:", el);
    el.innerHTML = "";
    // each(el.childNodes, e => {
    //     if (e !== undefined) e.remove();
    // });
};

const addSettings = () => {
}

const onToggle = () => {
	selected = 39; // FIXME PLACEHOLDER
    view.setPagination(selected);
};

const addSelector = () => {
    if (settings.paginationItems.length > 0) {
        dom(selectorTpl)
            .on('click', onSelect)
            .appTo(base.$toolbar);
    }
};

const init = () => {
    // addSettings();
    // addSelector(); // add to sidebar
	// onChanged(view.getSize());
};

init();

module.exports = {
	$el: $pagination,
	getDefaultSize,
	getAvailableSizes,
	getStoredSize,
	Pagination
}