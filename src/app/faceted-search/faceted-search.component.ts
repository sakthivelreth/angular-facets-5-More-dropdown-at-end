import {
  Component,
  Input,
  Output,
  EventEmitter,
  signal,
  computed,
  OnInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  Signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface Column {
  key: string;
  label: string;
  type: 'text' | 'select';
  values?: string[];
  preferred?: boolean;
  mutuallyExclusive?: string[];
  multi?: boolean;
}

// Base filter type
interface ActiveFilter {
  key: string;
  label: string;
  value: string;
}

// Grouped filter type
interface GroupedFilter {
  key: string;
  label: string;
  values: string[];
}

@Component({
  selector: 'mgui-facet-filter',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './faceted-search.component.html',
  styleUrls: ['./faceted-search.component.css'],
})
export class FacetFilterComponent implements OnInit, OnDestroy {
  @ViewChild('searchInput', { read: ElementRef }) searchInputRef?: ElementRef<HTMLInputElement>;
  @ViewChild('valueInput', { read: ElementRef }) valueInputRef?: ElementRef<HTMLInputElement>;

  private removeTokenContainer = false;
  private allColumnsCache: Column[] = [];

  @Input() columns?: Signal<Column[]>;

  @Input() visibleChipCount = 2;
  @Input() dynamicValuesProvider?: (colKey: string, searchTerm: string) => string[] | Promise<string[]>;

  @Output() filtersChange = new EventEmitter<ActiveFilter[]>();

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

  // Computeds
  hasFilters = computed(() => this.activeFilters().length > 0);

  // groupedFilters: transforms activeFilters -> grouped by key with values array
  groupedFilters = computed<GroupedFilter[]>(() => {
    const map = new Map<string, GroupedFilter>();
    for (const f of this.activeFilters()) {
      if (!map.has(f.key)) {
        map.set(f.key, { key: f.key, label: f.label, values: [] });
      }
      map.get(f.key)!.values.push(f.value);
    }
    return Array.from(map.values());
  });

  // last/more groups for UI (derived from groupedFilters)
  lastVisibleGroups = computed(() => {
    const groups = this.groupedFilters();
    return groups.slice(-this.visibleChipCount);
  });

  moreGroups = computed(() => {
    const groups = this.groupedFilters();
    return groups.slice(0, -this.visibleChipCount);
  });

  // A map for quick lookup of selected values per column (used by checkbox checked binding)
  selectedValuesMap = computed(() => {
    const map = new Map<string, Set<string>>();
    for (const f of this.activeFilters()) {
      if (!map.has(f.key)) map.set(f.key, new Set());
      map.get(f.key)!.add(f.value);
    }
    return map;
  });

  filteredColumns = computed(() => {
    const q = this.inputValue().toLowerCase();
    // use cached full list if available, else use latest input columns
    const all = this.allColumnsCache.length ? this.allColumnsCache : this.columns?.() ?? [];
    const filters = this.activeFilters();
    const activeKeys = filters.map((f) => f.key);

    // build mutually excluded keys
    const mutuallyExcluded = new Set<string>();
    for (const f of filters) {
      const col = all.find((c) => c.key === f.key);
      col?.mutuallyExclusive?.forEach((k) => mutuallyExcluded.add(k));
    }

    // filter while preserving original order
    const filtered = all.filter(
      (c) => !activeKeys.includes(c.key) && !mutuallyExcluded.has(c.key) && c.label.toLowerCase().includes(q)
    );

    // preferred first but keep their relative order
    const preferred = filtered.filter((c) => c.preferred);
    const others = filtered.filter((c) => !c.preferred);
    return [...preferred, ...others];
  });

  // Clean: This method is to add the selected text in the input field after each selection. The text input modal should bind this method to show the value. Not using this now
  displayInputValue = computed(() => {
    const col = this.selectedColumn();
    if (!col) return this.inputValue(); // when no column selected → normal input text
    if (col.multi) {
      const selected = Array.from(this.tempSelectedValues().get(col.key) ?? []);
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

    // If dynamicValuesProvider is provided, use it
    if (this.dynamicValuesProvider) {
      const result = this.dynamicValuesProvider(col.key, this.inputValue());
      return Array.isArray(result) ? result : [];
    }

    // fallback to static values for select columns
    if (col.type === 'select' && col.values) {
      const q = this.inputValue().toLowerCase();
      return col.values.filter((v) => v.toLowerCase().includes(q));
    }

    return [];
  });

  // --- Handlers ---
  onFocus() {
    this.highlightedIndex.set(-1);
    if (!this.removeTokenContainer) {
      this.showDropdown.set(true);
    } else {
      this.removeTokenContainer = false;
    }
  }

  onSearchInput(val: string) {
    this.inputValue.set(val);
    this.showDropdown.set(true);
    this.highlightedIndex.set(0);
  }

  removeColumn() {
    this.removeTokenContainer = true;
    this.resetInput();
  }

  selectColumn(col: Column) {
    this.selectedColumn.set(col);
    this.inputValue.set('');
    this.showDropdown.set(col.type === 'select');
    this.highlightedIndex.set(-1);

    // Initialize temp selections for multi-select
    if (col.multi) {
      const activeSet = this.selectedValuesMap().get(col.key) ?? new Set<string>();
      const temp = new Map(this.tempSelectedValues());
      temp.set(col.key, new Set([...activeSet]));
      this.tempSelectedValues.set(temp);
    }

    setTimeout(() => {
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
        this.highlightedIndex.update((i) => (i < lastIndex ? i + 1 : 0));
        break;

      case 'ArrowUp':
        event.preventDefault();
        this.highlightedIndex.update((i) => (i > 0 ? i - 1 : lastIndex));
        break;

      case 'Enter':
        event.preventDefault();
        const selected = safeList[this.highlightedIndex()];
        if (selected) this.selectColumn(selected);
        else this.selectColumnOnEnter(); // fallback to first
        break;
    }
  }

  selectValue(val: string) {
    const col = this.selectedColumn();
    if (!col) return;

    this.activeFilters.update((filters) => {
      const existing = [...filters];
      const others = existing.filter((f) => f.key !== col.key);
      return [...others, { key: col.key, label: col.label, value: val }];
    });

    this.filtersChange.emit(this.activeFilters());
    this.resetInput();
    setTimeout(() => this.searchInputRef?.nativeElement.focus());
  }

  onRowClick(event: MouseEvent, col: Column, val: string) {
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

  onCheckboxClick(event: MouseEvent, col: Column, val: string) {
    event.stopPropagation(); // Prevent li click
    this.toggleValue(col, val); // Use Angular state to toggle
  }

  toggleValue(col: Column, match: string) {
    if (!col.multi) return;
    const temp = new Map(this.tempSelectedValues());
    const set = new Set(temp.get(col.key) ?? []);
    set.has(match) ? set.delete(match) : set.add(match);
    temp.set(col.key, set);
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
          this.selectValue(val);
        }
      }
      return; // stop here — no dropdown navigation
    }

    // --- Case 2: Select (dropdown-based) ---
    const list: string[] = this.possibleValues();
    const lastIndex = list.length - 1;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.highlightedIndex.update((i) => (i < lastIndex ? i + 1 : 0));
        break;

      case 'ArrowUp':
        event.preventDefault();
        this.highlightedIndex.update((i) => (i > 0 ? i - 1 : lastIndex));
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
    const selectedValues = temp.get(col.key) ?? new Set<string>();

    const newFilters = this.activeFilters()
      .filter((f) => f.key !== col.key)
      .concat([...selectedValues].map((v) => ({ key: col.key, label: col.label, value: v })));

    this.activeFilters.set(newFilters);

    // Emit the current filters to the parent
    this.filtersChange.emit(newFilters);

    // Reset and close dropdown
    this.tempSelectedValues.set(new Map());
    this.resetInput();

    // Refocus the main search input
    setTimeout(() => this.searchInputRef?.nativeElement.focus());
  }

  /** User clicks "Close" in multi-select mode (cancel) */
  cancelMultiSelection() {
    this.tempSelectedValues.set(new Map());
    this.resetInput();
  }

  removeChip(key: string) {
    this.activeFilters.update((filters) => {
      const updated = filters.filter((f) => f.key !== key);

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
    this.resetInput();
    this.moreDropdownOpen.set(false);
  }

  resetInput() {
    this.selectedColumn.set(null);
    this.inputValue.set('');
    this.showDropdown.set(false);
    this.highlightedIndex.set(-1);
  }

  toggleMoreDropdown() {
    this.moreDropdownOpen.update((v) => !v);
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

  private readonly onDocumentClick = (event: MouseEvent) => {
    if (!this.elRef.nativeElement.contains(event.target as Node)) {
      this.showDropdown.set(false);
      this.moreDropdownOpen.set(false);
    }
  };

  // Emit whenever filters change
  constructor(private elRef: ElementRef<HTMLElement>) {
    // reactive emit for non-multi filters only
    computed(() => {
      const col = this.selectedColumn();
      if (!col || col.multi) return;
      this.filtersChange.emit(this.activeFilters());
    });
  }

  ngOnInit() {
    document.addEventListener('click', this.onDocumentClick, true);
    if (this.columns) {
      const cols = this.columns();
      if (cols && !this.allColumnsCache.length) {
        this.allColumnsCache = [...cols];
      }
    }
  }

  ngOnDestroy() {
    document.removeEventListener('click', this.onDocumentClick, true);
  }
}
