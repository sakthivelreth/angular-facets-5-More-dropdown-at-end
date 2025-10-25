import { Component, signal, computed } from '@angular/core';
import { NgFor, NgIf, KeyValuePipe } from '@angular/common';

interface Column {
  key: string;
  label: string;
  type: 'text' | 'select';
  values?: string[];
}

@Component({
  selector: 'app-root',
  standalone: true,
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  imports: [NgFor, NgIf, KeyValuePipe],
})
export class AppComponent {
  columns: Column[] = [
    {
      key: 'enclosure',
      label: 'Enclosure',
      type: 'select',
      values: ['BP_PSV_0_1', 'BP_PSV_0_2', 'BP_TNK_1'],
    },
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      values: ['Active', 'Inactive'],
    },
    { key: 'description', label: 'Description', type: 'text' },
  ];

  data = signal([
    { enclosure: 'BP_PSV_0_1', status: 'Active', description: 'Unit 1' },
    { enclosure: 'BP_PSV_0_2', status: 'Inactive', description: 'Unit 2' },
    { enclosure: 'BP_TNK_1', status: 'Active', description: 'Tank 1' },
  ]);

  // Signals
  activeFilters = signal<Record<string, string>>({});
  selectedColumn = signal<Column | null>(null);
  inputValue = signal('');
  showDropdown = signal(false);

  // Signal to track if collapsed chips are expanded
  chipsExpanded = signal(false);

  // Track whether the More dropdown is open
  moreDropdownOpen = signal(false); // tracks if the More dropdown is open

  toggleMoreDropdown() {
    console.log('Inside');
    this.moreDropdownOpen.update((v) => !v);
  }

  // Safe computed to check if there are any active filters
  get hasFilters(): boolean {
    const filters = this.activeFilters();
    return !!filters && Object.keys(filters).length > 0;
  }

  // Helper to check if more than 2 filters exist
  get hasMoreThanTwoFilters(): boolean {
    const filters = this.activeFilters();
    return !!filters && Object.keys(filters).length > 2;
  }

  // --- Column filtering for type-ahead ---
  filteredColumns = computed(() => {
    const activeKeys = Object.keys(this.activeFilters());
    const q = this.inputValue().toLowerCase();
    return this.columns.filter(
      (c) => !activeKeys.includes(c.key) && c.label.toLowerCase().includes(q)
    );
  });

  // --- Dynamic possible values based on current filtered table ---
  possibleValues = computed(() => {
    const col = this.selectedColumn();
    if (!col) return [];

    // Ignore current column for value extraction
    const filters = { ...this.activeFilters() };
    delete filters[col.key];

    // Filter rows based on other active filters
    const currentRows = this.data().filter((row) =>
      Object.entries(filters).every(([key, val]) =>
        (row as any)[key]?.toString().toLowerCase().includes(val.toLowerCase())
      )
    );

    // Extract unique values for this column
    const valuesSet = new Set<string>();
    currentRows.forEach((row) => {
      const value = (row as any)[col.key];
      if (value != null) valuesSet.add(value);
    });

    // Apply type-ahead filtering
    const q = this.inputValue().toLowerCase();
    return Array.from(valuesSet).filter((v) => v.toLowerCase().includes(q));
  });

  // --- Filtered table data ---
  filteredData = computed(() => {
    const filters = this.activeFilters();
    return this.data().filter((row) =>
      Object.entries(filters).every(([key, val]) =>
        (row as any)[key]?.toString().toLowerCase().includes(val.toLowerCase())
      )
    );
  });

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
    this.showDropdown.set(col.type === 'select'); // show dropdown only for select
  }

  selectColumnOnEnter() {
    const match = this.filteredColumns()[0];
    if (match) this.selectColumn(match);
  }

  selectValue(val: string) {
    const col = this.selectedColumn();
    if (!col) return;
    this.activeFilters.update((f) => ({ ...f, [col.key]: val }));
    this.resetInput();
  }

  selectValueOnEnter() {
    const col = this.selectedColumn();
    if (!col) return;

    if (col.type === 'select') {
      const match = this.possibleValues()[0]; // only select if value exists in filtered table
      if (match) this.selectValue(match);
    } else {
      // text column → allow free typing
      if (this.inputValue()) this.selectValue(this.inputValue());
    }
  }

  removeChip(key: string) {
    this.activeFilters.update((f) => {
      const { [key]: _, ...rest } = f;
      return rest;
    });
  }

  resetInput() {
    this.selectedColumn.set(null);
    this.inputValue.set('');
    this.showDropdown.set(false);
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
}
