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
  AfterViewChecked,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface Column {
  key: string;
  label: string;
  type: 'text' | 'select';
  values?: string[];
}

@Component({
  selector: 'mgui-facet-filter',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './faceted-search.component.html',
  styleUrls: ['./faceted-search.component.css'],
})
export class FacetFilterComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('valueInput', { read: ElementRef }) valueInputRef?: ElementRef<HTMLInputElement>;

  // Signal to track left offset of the dropdown
  dropdownOffset = signal(0);
  private listenerAttached = false;

  ngAfterViewChecked() {
    const input = this.valueInputRef?.nativeElement;
    if (input && !this.listenerAttached) {
      input.addEventListener('input', () => this.updateDropdownPosition());
      input.addEventListener('click', () => this.updateDropdownPosition());
      this.listenerAttached = true;
    }
  }

  @Input() columns: Column[] = [];
  @Input() visibleChipCount = 2;
  @Input() dynamicValuesProvider?: (colKey: string, searchTerm: string) => string[] | Promise<string[]>;

  @Output() filtersChange = new EventEmitter<Record<string, string>>();

  // Signals
  activeFilters = signal<Record<string, string>>({});
  selectedColumn = signal<Column | null>(null);
  inputValue = signal('');
  showDropdown = signal(false);
  moreDropdownOpen = signal(false);
  filteredValues = signal<string[]>([]);

  // Computed
  hasFilters = computed(() => Object.keys(this.activeFilters()).length > 0);
  lastVisibleChips = computed(() => {
    const entries = Object.entries(this.activeFilters());
    return entries.slice(-this.visibleChipCount).map(([key, value]) => ({ key, value }));
  });
  moreChips = computed(() => {
    const entries = Object.entries(this.activeFilters());
    return entries.slice(0, -this.visibleChipCount).map(([key, value]) => ({ key, value }));
  });

  filteredColumns = computed(() => {
    const q = this.inputValue().toLowerCase();
    const activeKeys = Object.keys(this.activeFilters());
    return this.columns.filter((c) => !activeKeys.includes(c.key) && c.label.toLowerCase().includes(q));
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

  updateDropdownPosition() {
    const input = this.valueInputRef?.nativeElement;
    if (!input) return;

    const selectionStart = input.selectionStart || 0;

    const span = document.createElement('span');
    span.style.visibility = 'hidden';
    span.style.position = 'absolute';
    span.style.whiteSpace = 'pre';
    span.style.font = getComputedStyle(input).font;
    span.textContent = input.value.slice(0, selectionStart);

    document.body.appendChild(span);
    const offset = span.getBoundingClientRect().width;
    document.body.removeChild(span);

    this.dropdownOffset.set(offset);
  }

  // --- Handlers ---
  onFocus() {
    this.showDropdown.set(true);
  }

  onSearchInput(val: string) {
    this.inputValue.set(val);
    this.showDropdown.set(true);
  }

  selectColumn(col: Column) {
    this.selectedColumn.set(col);
    this.inputValue.set('');
    this.showDropdown.set(col.type === 'select');

    // Focus the value input after the column token renders
    setTimeout(() => {
      this.valueInputRef?.nativeElement.focus();
    });
  }

  selectColumnOnEnter() {
    const match = this.filteredColumns()[0];
    if (match) this.selectColumn(match);
  }

  selectValue(val: string) {
    const col = this.selectedColumn();
    if (!col) return;

    // Update active filters
    this.activeFilters.update((f) => ({ ...f, [col.key]: val }));

    // Emit to parent immediately
    this.filtersChange.emit(this.activeFilters());

    this.resetInput();
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

  removeChip(key: string) {
    this.activeFilters.update((f) => {
      const { [key]: _, ...rest } = f;
      //Emit updated filters to parent
      this.filtersChange.emit(rest);
      return rest;
    });
  }

  clearAll() {
    this.activeFilters.set({});
    this.filtersChange.emit({});
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

  getColumnLabel(key: string) {
    return this.columns.find((c) => c.key === key)?.label || key;
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
  }

  ngOnDestroy() {
    document.removeEventListener('click', this.onDocumentClick, true);
  }
}
