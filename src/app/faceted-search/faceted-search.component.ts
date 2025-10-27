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

  @Output() filtersChange = new EventEmitter<{ label: string; key: string; value: string }[]>();

  // Signals
  activeFilters = signal<{ label: string; key: string; value: string }[]>([]);
  selectedColumn = signal<Column | null>(null);
  inputValue = signal('');
  showDropdown = signal(false);
  moreDropdownOpen = signal(false);
  filteredValues = signal<string[]>([]);

  // Mouse events up/down and enter for dropdown
  highlightedIndex = signal(-1);

  // Computed
  hasFilters = computed(() => this.activeFilters().length > 0);
  lastVisibleChips = computed(() => this.activeFilters().slice(-this.visibleChipCount));
  moreChips = computed(() => this.activeFilters().slice(0, -this.visibleChipCount));

  filteredColumns = computed(() => {
    const q = this.inputValue().toLowerCase();
    const all = this.allColumnsCache.length ? this.allColumnsCache : this.columns?.() ?? [];
    const filters = this.activeFilters();
    const activeKeys = filters.map((f) => f.key);

    const mutuallyExcluded = new Set<string>();
    for (const f of filters) {
      const col = all.find((c) => c.key === f.key);
      col?.mutuallyExclusive?.forEach((k) => mutuallyExcluded.add(k));
    }

    // Preserve original order; just filter
    const filtered = all.filter(
      (c) => !activeKeys.includes(c.key) && !mutuallyExcluded.has(c.key) && c.label.toLowerCase().includes(q)
    );

    // Preferred first (keep order)
    const preferred = filtered.filter((c) => c.preferred);
    const others = filtered.filter((c) => !c.preferred);
    return [...preferred, ...others];
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
    this.highlightedIndex.set(-1);
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

    // Focus the value input after the column token renders
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

    // Update active filters
    this.activeFilters.update((f) => [...f, { key: col.key, value: val, label: col.label }]);

    // Emit to parent immediately
    this.filtersChange.emit(this.activeFilters());

    this.resetInput();

    // Focus the input again
    setTimeout(() => this.searchInputRef?.nativeElement.focus());
  }

  selectValueOnEnter() {
    const col = this.selectedColumn();
    if (!col) return;

    if (col.type === 'select') {
      const match = this.possibleValues()[0];
      if (match) this.selectValue(match);
    } else {
      if (this.inputValue()) this.selectValue(this.inputValue());
    }
  }

  onValueKeydown(event: KeyboardEvent) {
    const list = this.possibleValues();
    const lastIndex = list.length - 1;

    if (!list.length) return;

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
        const selected = list[this.highlightedIndex()];
        if (selected) this.selectValue(selected);
        else this.selectValueOnEnter(); // fallback to first
        break;
    }
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

  private onDocumentClick = (event: MouseEvent) => {
    if (!this.elRef.nativeElement.contains(event.target as Node)) {
      this.showDropdown.set(false);
      this.moreDropdownOpen.set(false);
    }
  };

  // Emit whenever filters change
  constructor(private elRef: ElementRef<HTMLElement>) {
    computed(() => {
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
