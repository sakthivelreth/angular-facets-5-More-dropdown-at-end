import {
  Component,
  Input,
  input,
  Output,
  EventEmitter,
  signal,
  computed,
  OnInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  effect,
  TemplateRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface ColumnValue {
  key: string | number;
  value: string;
}
export interface Column {
  label: string;
  map: string;
  type: 'text' | 'select';
  options?: ColumnValue[];
  preferred?: boolean;
  mutuallyExclusive?: string[];
  multi?: boolean;
  translate?: boolean;
}

// Base filter type
export interface ActiveFilter {
  map: string;
  label: string;
  values: ColumnValue[];
}

// Grouped filter type
interface GroupedFilter {
  map: string;
  label: string;
  values: string[];
}

@Component({
  selector: 'mgui-facet-filter',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './faceted-search.component.html',
  styleUrls: ['./faceted-search.component.css']
})
export class FacetFilterComponent implements OnInit, OnDestroy {
  @ViewChild('searchInput', { read: ElementRef }) searchInputRef?: ElementRef<HTMLInputElement>;
  @ViewChild('valueInput', { read: ElementRef }) valueInputRef?: ElementRef<HTMLInputElement>;
  @ViewChild('chipsMiddle', { static: false }) chipsMiddleRef?: ElementRef<HTMLDivElement>;
  @ViewChild('searchContainer', { read: TemplateRef }) searchContainer!: TemplateRef<any>;
  @ViewChild('pillsContainer', { read: TemplateRef }) pillsContainer!: TemplateRef<any>;

  preSelectedFilters = input<ActiveFilter[] | null>(null);

  columns = input.required<Column[]>(); // Signal<Column[]>;
  @Input() dynamicValuesProvider?: (colKey: string, searchTerm: string) => string[] | Promise<string[]>;

  //Basid search change event emit
  @Output() basicSearchChange = new EventEmitter<string>(); // <— NEW

  //Advanced search change event emit
  @Output() filtersChange = new EventEmitter<ActiveFilter[]>();

  // Emit the Search and Chips templates to the caller to use the right templates
  @Output() searchTemplate = new EventEmitter<TemplateRef<any>>();
  @Output() pillsTemplate = new EventEmitter<TemplateRef<any>>();

  //Not used now
  initialized = signal(false);

  // Signals
  activeFilters = signal<ActiveFilter[]>([]);
  selectedColumn = signal<Column | null>(null);
  inputValue = signal('');
  showDropdown = signal(false);
  moreDropdownOpen = signal(false);
  filteredValues = signal<string[]>([]);

  // Temporary selection map for multi-select
  tempSelectedValues = signal<Map<string, Set<string>>>(new Map());

  // Mouse events up/down and enter for dropdown
  highlightedIndex = signal(-1);

  // Accept parent-provided initial mode
  isAdvancedModeInput = input<boolean>(false);

  // Search mode change and capture the basic search string
  isAdvancedMode = signal(false);
  basicSearchText = signal('');

  // dynamic signals for visible vs hidden chips
  visibleGroups = signal<GroupedFilter[]>([]);
  hiddenGroups = signal<GroupedFilter[]>([]);

  private resizeObserver?: ResizeObserver;

  // Computeds
  hasFilters = computed(() => this.activeFilters().length > 0);

  // groupedFilters: transforms activeFilters -> grouped by key with values array
  groupedFilters = computed<GroupedFilter[]>(() => {
    const map = new Map<string, GroupedFilter>();

    for (const f of this.activeFilters()) {
      if (!map.has(f.map)) {
        map.set(f.map, { map: f.map, label: f.label, values: [] });
      }
      const group = map.get(f.map)!;
      group.values.push(...f.values.map(v => v.value));
    }

    return Array.from(map.values());
  });

  // A map for quick lookup of selected values per column (used by checkbox checked binding)
  selectedValuesMap = computed(() => {
    const map = new Map<string, Set<string>>();
    for (const f of this.activeFilters()) {
      if (!map.has(f.map)) map.set(f.map, new Set());
      f.values.forEach(v => map.get(f.map)!.add(v.value));
    }
    return map;
  });

  filteredColumns = computed(() => {
    const q = this.inputValue().toLowerCase();
    // use cached full list if available, else use latest input columns
    const all = this.columns?.() ?? [];
    const filters = this.activeFilters();
    const activeKeys = filters.map(f => f.map);

    // build mutually excluded keys
    const mutuallyExcluded = new Set<string>();
    for (const f of filters) {
      const col = all.find(c => c.map === f.map);
      col?.mutuallyExclusive?.forEach(k => mutuallyExcluded.add(k));
    }

    // filter while preserving original order
    const filtered = all.filter(
      c => !activeKeys.includes(c.map) && !mutuallyExcluded.has(c.map) && c.label.toLowerCase().includes(q)
    );

    // preferred first but keep their relative order
    const preferred = filtered.filter(c => c.preferred);
    const others = filtered.filter(c => !c.preferred);
    return [...preferred, ...others];
  });

  // Clean: This method is to add the selected text in the input field after each selection. The text input modal should bind this method to show the value. Not using this now
  displayInputValue = computed(() => {
    const col = this.selectedColumn();
    if (!col) return this.inputValue(); // when no column selected → normal input text
    if (col.multi) {
      const selected = Array.from(this.tempSelectedValues().get(col.map) ?? []);
      return selected.length
        ? `${selected.join(', ')}${this.inputValue() ? ', ' + this.inputValue() : ''}`
        : this.inputValue();
    }
    return this.inputValue();
  });

  possibleValues = computed(() => {
    const col = this.selectedColumn();
    if (!col || col.type !== 'select') return []; //only select columns

    //if (!col) return []; //All the columns values will be auto populated

    // fallback to static values for select columns
    if (col.type === 'select' && col.options && col.options.length > 0) {
      const q = this.inputValue().toLowerCase();
      return col.options.filter(v => v.value.toLowerCase().includes(q));
    }

    if (col.type === 'select' && this.dynamicValuesProvider) {
      const result = this.dynamicValuesProvider(col.map, this.inputValue());

      let normalized: ColumnValue[] = [];

      if (Array.isArray(result)) {
        const first = result[0];

        // Case 1: Array of strings
        if (typeof first === 'string') {
          normalized = result.map(v => ({ key: v, value: v }));
        }

        // Case 2: Array of objects { key, value }. Currently this is not supported from the dynamicValuesProvider
        if (first && typeof first === 'object' && 'key' in first && 'value' in first) {
          normalized = result as unknown as ColumnValue[];
        }

        // Update column values so rest of component uses latest list
        col.options = normalized;

        // Return the normalized list
        return normalized;
      }

      return [];
    }

    // Fallback
    return [];
  });

  // --- Handlers ---
  onFocus() {
    this.highlightedIndex.set(-1);
    this.showDropdown.set(true);
  }

  onSearchInput(val: string) {
    this.inputValue.set(val);
    this.showDropdown.set(true);
    this.highlightedIndex.set(0);
  }

  removeColumn() {
    this.resetInput(true);
  }

  selectColumn(col: Column) {
    this.selectedColumn.set(col);
    this.inputValue.set('');
    this.showDropdown.set(col.type === 'select');
    this.highlightedIndex.set(-1);

    // Initialize temp selections for multi-select
    if (col.multi) {
      const activeSet = this.selectedValuesMap().get(col.map) ?? new Set<string>();
      const temp = new Map(this.tempSelectedValues());
      temp.set(col.map, new Set([...activeSet]));
      this.tempSelectedValues.set(temp);
    }

    Promise.resolve().then(() => {
      this.valueInputRef?.nativeElement.focus();
    });
  }

  selectColumnOnEnter() {
    const match = (this.filteredColumns() ?? [])[0];
    if (!match) return;
    this.selectColumn(match);
  }

  onColumnKeydown(event: KeyboardEvent) {
    const list = this.filteredColumns();
    const safeList = list ?? [];
    if (!safeList.length) return;

    const lastIndex = safeList.length - 1;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.highlightedIndex.update(i => (i < lastIndex ? i + 1 : 0));
        break;

      case 'ArrowUp':
        event.preventDefault();
        this.highlightedIndex.update(i => (i > 0 ? i - 1 : lastIndex));
        break;

      case 'Enter':
        event.preventDefault();
        const selected = safeList[this.highlightedIndex()];
        if (selected) this.selectColumn(selected);
        else this.selectColumnOnEnter(); // fallback to first
        break;
    }
  }

  selectValue(val: ColumnValue) {
    const col = this.selectedColumn();
    if (!col) return;

    this.activeFilters.update(filters => {
      const existing = [...filters];
      const others = existing.filter(f => f.map !== col.map);

      return [
        ...others,
        {
          map: col.map,
          label: col.label,
          values: [{ key: val.key, value: val.value }]
        }
      ] as ActiveFilter[];
    });

    this.filtersChange.emit(this.activeFilters());
    this.resetInput(true);
    //setTimeout(() => this.searchInputRef?.nativeElement.focus());
  }

  onRowClick(event: MouseEvent, col: Column, val: ColumnValue) {
    event.stopPropagation();
    if (col.multi) {
      // Prevent double toggle when clicking directly on the checkbox
      const target = event.target as HTMLElement;
      if (target.tagName.toLowerCase() === 'input') return;

      this.toggleValue(col, val);
    } else {
      this.selectValue(val);
    }
  }

  onCheckboxClick(event: MouseEvent, col: Column, val: ColumnValue) {
    event.stopPropagation(); // Prevent li click
    this.toggleValue(col, val); // Use Angular state to toggle
  }

  toggleValue(col: Column, val: ColumnValue) {
    if (!col.multi) return;
    const temp = new Map(this.tempSelectedValues());
    const set = new Set(temp.get(col.map) ?? []);
    const match = val.value;
    set.has(match) ? set.delete(match) : set.add(match);
    temp.set(col.map, set);
    this.tempSelectedValues.set(temp);
    this.inputValue.set('');
  }

  onValueKeydown(event: KeyboardEvent) {
    const col = this.selectedColumn();
    if (!col) return;

    // --- Case 1: Text / free input columns ---
    if (col.type === 'text') {
      if (event.key === 'Enter') {
        event.preventDefault();
        const val = this.inputValue().trim();
        if (val) {
          this.selectValue({ key: val, value: val });
        }
      }
      return; // stop here — no dropdown navigation
    }

    // --- Case 2: Select (dropdown-based) ---
    const list: ColumnValue[] = this.possibleValues();
    const lastIndex = list.length - 1;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.highlightedIndex.update(i => (i < lastIndex ? i + 1 : 0));
        break;

      case 'ArrowUp':
        event.preventDefault();
        this.highlightedIndex.update(i => (i > 0 ? i - 1 : lastIndex));
        break;

      case 'Enter': {
        event.preventDefault();
        const idx = this.highlightedIndex() >= 0 ? this.highlightedIndex() : 0;
        const match = list[idx] ?? list[0];
        if (!match) return;

        if (col.multi) {
          this.toggleValue(col, match);
        } else {
          this.selectValue(match);
        }
        break;
      }
    }
  }

  applyMultiSelection() {
    const col = this.selectedColumn();
    if (!col) return;

    const temp = this.tempSelectedValues();
    const selectedValues = temp.get(col.map) ?? new Set<string>();

    // find corresponding ColumnValue objects for selectedValues
    const matchedValues = col.options?.filter(v => selectedValues.has(v.value)) ?? [];

    const newFilters: ActiveFilter[] = this.activeFilters()
      .filter(f => f.map !== col.map)
      .concat([
        {
          map: col.map,
          label: col.label,
          values: matchedValues.map(v => ({ key: v.key, value: v.value }))
        }
      ]);

    this.activeFilters.set(newFilters);

    // Emit the current filters to the parent
    this.filtersChange.emit(newFilters);

    // Reset and close dropdown
    this.tempSelectedValues.set(new Map());
    this.resetInput(true);

    // ensure dropdown closes cleanly
    Promise.resolve().then(() => {
      this.showDropdown.set(false);
      this.moreDropdownOpen.set(false);
    });
  }

  /** User clicks "Close" in multi-select mode (cancel) */
  cancelMultiSelection() {
    this.tempSelectedValues.set(new Map());
    this.resetInput(true);
  }

  removeChip(key: string) {
    this.activeFilters.update(filters => {
      const updated = filters.filter(f => f.map !== key);

      // Emit updated filters to parent
      this.filtersChange.emit(updated);

      // Hide dropdown when a chip is removed
      this.showDropdown.set(false);
      this.moreDropdownOpen.set(false);

      return updated;
    });
  }

  clearAll() {
    this.activeFilters.set([]);
    this.filtersChange.emit([]);
    this.resetInput(true);
    this.moreDropdownOpen.set(false);
  }

  resetInput(keepDropdownClosed = false) {
    this.selectedColumn.set(null);
    this.inputValue.set('');
    this.showDropdown.set(!keepDropdownClosed && false);
    this.highlightedIndex.set(-1);
  }

  toggleMoreDropdown() {
    this.moreDropdownOpen.update(v => !v);
  }

  highlightMatch(text: string): string {
    const query = this.inputValue().toLowerCase();
    if (!query) return text;
    const idx = text.toLowerCase().indexOf(query);
    if (idx === -1) return text;
    return `${text.substring(0, idx)}<span class="highlight">${text.substring(
      idx,
      idx + query.length
    )}</span>${text.substring(idx + query.length)}`;
  }
  constructor(private elRef: ElementRef<HTMLElement>) {
    //Todo: Use this, if the preselected filters are not emitted to the parent in the ngOnInit. Not used now
    /* effect(() => {
      const initial = this.preSelectedFilters();

      // Run only once when valid filters arrive
      if (!this.initialized && initial && initial.length > 0) {
        this.activeFilters.set([...initial]);
        this.initialized = true;
      }
    }); */

    // Sync input to local state (runs whenever parent updates)
    effect(() => {
      this.isAdvancedMode.set(this.isAdvancedModeInput());
    });

    // watch for chip or filter changes
    effect(() => {
      this.groupedFilters();
      queueMicrotask(() => this.calculateVisibleChips());
    });

    // reactive emit for non-multi filters only
    computed(() => {
      const col = this.selectedColumn();
      if (!col || col.multi) return;
      this.filtersChange.emit(this.activeFilters());
    });
  }

  ngOnInit() {
    document.addEventListener('mousedown', this.onDocumentMouseDown, true);

    if (this.isAdvancedModeInput()) {
      const initial = this.preSelectedFilters();
      if (initial?.length && !this.activeFilters().length) {
        this.activeFilters.set([...initial]);
      }
    } else {
      this.activeFilters.set([]);
      this.filtersChange.emit([]);
    }
  }

  ngAfterViewInit() {
    this.searchTemplate.emit(this.searchContainer);
    this.pillsTemplate.emit(this.pillsContainer);

    if (this.activeFilters().length) {
      this.filtersChange.emit(this.activeFilters());
    }

    // run initial calc after view ready
    this.calculateVisibleChips();

    // watch resize
    this.resizeObserver = new ResizeObserver(() => {
      this.calculateVisibleChips();
    });
    this.resizeObserver.observe(this.elRef.nativeElement);
  }

  ngOnDestroy() {
    document.removeEventListener('mousedown', this.onDocumentMouseDown, true);
  }

  private readonly onDocumentMouseDown = (event: MouseEvent) => {
    const target = event.target as HTMLElement;

    // 1) If click is inside the component host → do nothing
    if (this.elRef.nativeElement.contains(target)) return;

    // 2) If click is inside any dropdown UI → do nothing
    if (target.closest('.dropdown') || target.closest('.value-dropdown')) return;

    // 3) If click is inside caller-projected UI → do nothing
    if (target.closest('.facet-projected')) return;

    // Otherwise → close dropdowns
    this.showDropdown.set(false);
    this.moreDropdownOpen.set(false);
  };

  private calculateVisibleChips() {
    const container = this.chipsMiddleRef?.nativeElement;
    if (!container) return;

    const allGroups = this.groupedFilters();
    if (!allGroups.length) {
      this.visibleGroups.set([]);
      this.hiddenGroups.set([]);
      return;
    }

    // reset all chips
    this.visibleGroups.set(allGroups);
    this.hiddenGroups.set([]);

    // Measure total width
    const availableWidth = container.clientWidth; //Middle chips container width
    const chipMaxWidth = 225; // Limiting max width to 225px for every chips
    const moreOptionWidth = 95; // reserve ~95px for "+ More Filters"
    let total = 0;
    const visible: GroupedFilter[] = [];
    const hidden: GroupedFilter[] = [];

    // create temp elements for width measurement
    const tempContainer = document.createElement('div');
    tempContainer.style.visibility = 'hidden';
    tempContainer.style.position = 'absolute';
    tempContainer.style.whiteSpace = 'nowrap';
    document.body.appendChild(tempContainer);

    for (let i = allGroups.length - 1; i >= 0; i--) {
      const group = allGroups[i];
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.innerText = `${group.label}: ${group.values.join(', ')}`;
      tempContainer.appendChild(chip);
      const chipWidth = chip.offsetWidth + 8; // margin/gap

      // Limiting max width to 150px for every chips
      if (chipWidth < chipMaxWidth) {
        total += chipWidth;
      } else {
        total = total + chipMaxWidth;
      }

      if (total < availableWidth - moreOptionWidth) {
        visible.unshift(group);
      } else {
        hidden.unshift(group);
      }
    }
    document.body.removeChild(tempContainer);

    this.visibleGroups.set(visible);
    this.hiddenGroups.set(hidden);
  }

  // Toggle logic for basic and advanced search switches
  toggleMode() {
    this.isAdvancedMode.update(v => !v);
    this.resetInput();

    if (!this.isAdvancedMode()) {
      // reset advanced filters when switching to basic
      this.activeFilters.set([]);
      this.filtersChange.emit([]);
    } else {
      // reset basic text when switching to advanced
      this.basicSearchText.set('');
      this.basicSearchChange.emit('');
    }
  }

  //Capture the basic search string and emit to the caller
  onBasicSearchInput(val: string) {
    this.basicSearchText.set(val);
    this.basicSearchChange.emit(val);
  }
}
