const {each, map, includes, intersection, dom} = require('../util');
const event = require('../core/event');
const format = require('../core/format');
const location = require('../core/location');
const resource = require('../core/resource');
const store = require('../core/store');
const allsettings = require('../core/settings');
const base = require('./base');

const modes = ['details', 'grid', 'icons'];
const sizes = [20, 40, 60, 80, 100, 150, 200, 250, 300, 350, 400];
const settings = Object.assign({
    binaryPrefix: false,
    hideFolders: false,
    hideParentFolder: false,
    maxIconSize: 40,
    modes,
    setParentFolderLabels: false,
    sizes
}, allsettings.view);
const sortedSizes = settings.sizes.sort((a, b) => a - b);
const checkedModes = intersection(settings.modes, modes);
const storekey = 'view';
const viewTpl =
        `<div id="view">
            <ul id="items" class="clearfix">
                <li class="header">
                    <a class="icon"></a>
                    <a class="label" href="#"><span class="l10n-name"/></a>
                    <a class="date" href="#"><span class="l10n-lastModified"/></a>
                    <a class="size" href="#"><span class="l10n-size"/></a>
                </li>
            </ul>
            <div id="view-hint"></div>
        </div>`;
const paginationTpl =
        `<div id="pagination_btm" class="pagination">
            <div id="nav_btm" class="nav_buttons"></div>
        </div>`;
const itemTpl =
        `<li class="item">
            <a>
                <span class="icon square"><img/></span>
                <span class="icon landscape"><img/></span>
                <span class="label"></span>
                <span class="date"></span>
                <span class="size"></span>
            </a>
        </li>`;
const $view = dom(viewTpl);
const $items = $view.find('#items');
const $hint = $view.find('#view-hint');
const $pagination = dom(paginationTpl);
const btn_cls = [['btn_first', '<<'], ['btn_prev', '<'], ['btn_next', '>'], ['btn_last', '>>']];
var page_nav = {};

const cropSize = (size, min, max) => Math.min(max, Math.max(min, size));

const createStyles = size => {
    const dsize = cropSize(size, 20, 80);
    const gsize = cropSize(size, 40, 160);
    const isize = cropSize(size, 80, 1000);
    const ilsize = Math.round(isize * 4 / 3);
    const important = '!important;';
    const detailsPrefix = `#view.view-details.view-size-${size}`;
    const gridPrefix = `#view.view-grid.view-size-${size}`;
    const iconsPrefix = `#view.view-icons.view-size-${size}`;
    const rules = [
        `${detailsPrefix} .item .label {line-height: ${dsize + 14}px ${important}}`,
        `${detailsPrefix} .item .date {line-height: ${dsize + 14}px ${important}}`,
        `${detailsPrefix} .item .size {line-height: ${dsize + 14}px ${important}}`,
        `${detailsPrefix} .square {width: ${dsize}px ${important} height: ${dsize}px ${important}}`,
        `${detailsPrefix} .square img {width: ${dsize}px ${important} height: ${dsize}px ${important}}`,
        `${detailsPrefix} .label {margin-left: ${dsize + 32}px ${important}}`,

        `${gridPrefix} .item .label {line-height: ${gsize}px ${important}}`,
        `${gridPrefix} .square {width: ${gsize}px ${important} height: ${gsize}px ${important}}`,
        `${gridPrefix} .square img {width: ${gsize}px ${important} height: ${gsize}px ${important}}`,

        `${iconsPrefix} .item {width: ${ilsize}px ${important}}`,
        `${iconsPrefix} .landscape {width: ${ilsize}px ${important} height: ${isize}px ${important}}`,
        `${iconsPrefix} .landscape img {width: ${isize}px ${important} height: ${isize}px ${important}}`,
        `${iconsPrefix} .landscape .thumb {width: ${ilsize}px ${important}}`
    ];

    return rules.join('\n');
};

const addCssStyles = () => {
    const styles = map(sortedSizes, size => createStyles(size));
    styles.push(`#view .icon img {max-width: ${settings.maxIconSize}px; max-height: ${settings.maxIconSize}px;}`);
    dom('<style></style>').text(styles.join('\n')).appTo('head');
};

const set = (mode, size) => {
    const stored = store.get(storekey);

    mode = mode || stored && stored.mode;
    size = size || stored && stored.size;
    mode = includes(settings.modes, mode) ? mode : settings.modes[0];
    size = includes(settings.sizes, size) ? size : settings.sizes[0];
    store.put(storekey, {mode, size});

    each(checkedModes, m => {
        if (m === mode) {
            $view.addCls('view-' + m);
        } else {
            $view.rmCls('view-' + m);
        }
    });

    each(sortedSizes, s => {
        if (s === size) {
            $view.addCls('view-size-' + s);
        } else {
            $view.rmCls('view-size-' + s);
        }
    });

    event.pub('view.mode.changed', mode, size);
};

const getModes = () => checkedModes;
const getMode = () => store.get(storekey).mode;
const setMode = mode => set(mode, null);

const getSizes = () => sortedSizes;
const getSize = () => store.get(storekey).size;
const setSize = size => set(null, size);

const onMouseenter = ev => {
    const item = ev.target._item;
    event.pub('item.mouseenter', item);
};

const onMouseleave = ev => {
    const item = ev.target._item;
    event.pub('item.mouseleave', item);
};

const createHtml = item => {
    const $html = dom(itemTpl);
    const $a = $html.find('a');
    const $iconImg = $html.find('.icon img');
    const $label = $html.find('.label');
    const $date = $html.find('.date');
    const $size = $html.find('.size');

    $html
        .addCls(item.isFolder() ? 'folder' : 'file')
        .on('mouseenter', onMouseenter)
        .on('mouseleave', onMouseleave);

    location.setLink($a, item);

    $label.text(item.label).attr('title', item.label);
    $date.attr('data-time', item.time).text(format.formatDate(item.time));
    $size.attr('data-bytes', item.size).text(format.formatSize(item.size));
    item.icon = resource.icon(item.type);

    if (item.isFolder() && !item.isManaged) {
        $html.addCls('page');
        item.icon = resource.icon('folder-page');
    }

    if (item.isCurrentParentFolder()) {
        item.icon = resource.icon('folder-parent');
        if (!settings.setParentFolderLabels) {
            $label.addCls('l10n-parentDirectory');
        }
        $html.addCls('folder-parent');
    }
    $iconImg.attr('src', item.icon).attr('alt', item.type);

    item.$view = $html;
    $html[0]._item = item;

    return $html;
};

const checkHint = () => {
    const hasNoItems = $items.find('.item').length === $items.find('.folder-parent').length;

    if (hasNoItems) {
        $hint.show();
    } else {
        $hint.hide();
    }
};

// TODO: make a proxy handler for Search here to avoid big lists?
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy
const setItems = items => {
    const removed = map($items.find('.item'), el => el._item);

    $items.find('.item').rm();

    each(items, item => $items.app(createHtml(item)));

    base.$content[0].scrollLeft = 0;
    base.$content[0].scrollTop = 0;
    checkHint();
    event.pub('view.changed', items, removed);
};

const changeItems = (add, remove) => {
    each(add, item => {
        createHtml(item).hide().appTo($items).show();
    });

    each(remove, item => {
        item.$view.hide().rm();
    });

    checkHint();
    event.pub('view.changed', add, remove);
};

const setHint = l10nKey => {
    $hint.rmCls().addCls('l10n-' + l10nKey);
    checkHint();
};

const rows_per_page = 30;

const onLocationChanged = item => {
    if (!item) {
        item = location.getItem();
    }

    const items = [];

    if (item.parent && !settings.hideParentFolder) {
        items.push(item.parent);
    }

    each(item.content, child => {
        if (!(child.isFolder() && settings.hideFolders)) {
            items.push(child);
        }
    });

    setHint('empty');

    // Destroy previous buttons if they exist
    if (page_nav.buttons) {
        page_nav.buttons.forEach(e => e.remove());
        delete page_nav.buttons;
        // delete page_nav;
    }
    // each($view.find('.nav_buttons'), el => destroyNavBar(el));

    if (items.length > rows_per_page) {
        page_nav = new Pagination(items);
        displayItems(items, rows_per_page, page_nav.current_page);
    } else {
        setItems(items);
    }
};

class Pagination {
    constructor(items) {
        this.items = items;
        this.current_page = 1;
        this.page_count = Math.ceil(items.length / rows_per_page);
        this.buttons = [];
        this.$pagination_els = base.$content.find('.nav_buttons');
        console.log("element:", this.$pagination_els);
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
            let div = updatePageStatus(null, this);
            key.insertBefore(div, key.childNodes[2]);
            this.buttons.push(div);

            // Page number selection
            div = document.createElement('div');
            div.classList.add('page_input');
            let {page_input, go_btn} = pageInputForm(items);
            div.appendChild(page_input);
            div.appendChild(go_btn);
            key.appendChild(div);
            this.buttons.push(page_input);
            this.buttons.push(go_btn);
        });
    }
}

const displayItems = (items, rows_per_page, page) => {
    page = page_nav.set_current_page(page);
    if (isNaN(page)) {
        return;
    }
    page--;
    let start = rows_per_page * page;
    let end = start + rows_per_page;
    let paginatedItems = items.slice(start, end);

    setItems(paginatedItems);
    updateButtons(page_nav);
};

const onLocationRefreshed = (item, added, removed) => {
    const add = [];

    each(added, child => {
        if (!(child.isFolder() && settings.hideFolders)) {
            add.push(child);
        }
    });

    setHint('empty');
    changeItems(add, removed);
};

const pageInputForm = (items) => {
    let input_field = document.createElement('input');
    input_field.type = 'text';
    input_field.classList.add('page_input_text');
    input_field.placeholder = 'page';

    let input_btn = document.createElement('input');
    input_btn.type = 'button';
    input_btn.classList.add('page_input_button');
    input_btn.value = 'GO';
    input_btn.addEventListener('click', () => {
        if (input_field.value !== '' && input_field.value !== page_nav.current_page) {
            displayItems(items, rows_per_page, input_field.value);
        }
        input_field.value = "";
        input_field.focus();
    });

    input_field.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && input_field.value && !/[^\s]/.test(input_field.value)) {
            if (input_field.value !== page_nav.current_page) {
                e.preventDefault();
                displayItems(items, rows_per_page, input_field.value);
            }
            input_field.value = "";
            input_field.focus();
        };
    });

    // Only allow digits, Enter and max page, no leading zero or spaces
    setInputFilter(input_field, function(value) {
        return /^[^0\s][\d]*$/.test(value) && value <= page_nav.page_count;
    });

    return {page_input: input_field, go_btn: input_btn};
};

// Restricts input for the given textbox to the given inputFilter function.
// In the future we could use beforeinput instead.
function setInputFilter(textbox, inputFilter) {
    ["input", "keydown", "keyup", "mousedown", "mouseup", "select",
    "contextmenu", "drop"].forEach(function(event) {
        textbox.addEventListener(event, function(e) {
            if (this.value === '') {
                console.log("inputbox: blocking empty value!");
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
    button.items = items;

	button.addEventListener('click', onButtonClicked);
	return button;
};

const updatePageStatus = (div, page_nav) => {
    _str = page_nav.current_page.toString().concat('/', page_nav.page_count.toString());
    if (!div) {
        div = document.createElement('div');
        div.appendChild(document.createTextNode(_str));
        div.classList.add('page_pos');
        return div;
    }
    return div.innerText = _str;
};

function onButtonClicked (ev) {
    displayItems(this.items, rows_per_page, this.req_page());
}

function updateButtons(page_nav){
    let prev_buttons =  document.querySelectorAll('.btn_first, .btn_prev');
    let next_buttons =  document.querySelectorAll('.btn_next, .btn_last');
    if (page_nav.current_page <= 1) {
        each(prev_buttons, button => button.disabled = true);
        each(next_buttons, button => button.disabled = false);
    } else if (page_nav.current_page >= page_nav.page_count && page_nav.current_page > 1) {
        each(next_buttons, button => button.disabled = true);
        each(prev_buttons, button => button.disabled = false);
    } else {
        let nav_buttons = document.querySelectorAll('.btn_first, .btn_prev, .btn_next, .btn_last');
        each(nav_buttons, button => button.disabled = false);
    }
    let page_pos = document.querySelectorAll('.page_pos');
    each(page_pos, el => updatePageStatus(el, page_nav));
}

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

const onResize = () => {
    const width = $view[0].offsetWidth;

    $view.rmCls('width-0').rmCls('width-1');
    if (width < 320) {
        $view.addCls('width-0');
    } else if (width < 480) {
        $view.addCls('width-1');
    }
};

const init = () => {
    addCssStyles();
    set();

    $view.appTo(base.$content);
    $pagination.appTo(base.$content);
    $hint.hide();

    format.setDefaultMetric(settings.binaryPrefix);

    event.sub('location.changed', onLocationChanged);
    event.sub('location.refreshed', onLocationRefreshed);
    event.sub('resize', onResize);
    onResize();
};

init();

module.exports = {
    $el: $view,
    setItems,
    changeItems,
    setLocation: onLocationChanged,
    setHint,
    getModes,
    getMode,
    setMode,
    getSizes,
    getSize,
    setSize
};
