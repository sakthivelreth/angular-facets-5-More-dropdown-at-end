import {
  Component,
  EventEmitter,
  Input,
  Output,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';

export interface FacetFilter {
  column: string;
  value: string;
}

@Component({
  selector: 'app-faceted-search',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './faceted-search.component.html',
  styleUrls: ['./faceted-search.component.css'],
})
export class FacetedSearchComponent {
  @Input() columns: string[] = [];
  @Input() rows: Record<string, any>[] = [];
  @Input() activeFilters: FacetFilter[] = [];

  @Output() filtersChange = new EventEmitter<FacetFilter[]>();

  searchFocused = signal(false);
  selectedColumn = signal<string | null>(null);
  possibleValues = signal<string[]>([]);
  filters = signal<FacetFilter[]>([]);

  ngOnInit() {
    this.filters.set(this.activeFilters);
  }

  onFocus() {
    this.searchFocused.set(true);
  }

  onColumnSelect(column: string) {
    this.selectedColumn.set(column);
    this.searchFocused.set(false);

    const uniqueValues = Array.from(new Set(this.rows.map((r) => r[column])));
    this.possibleValues.set(uniqueValues);
  }

  onValueSelect(value: string) {
    const col = this.selectedColumn();
    if (!col) return;

    const newFilters = [...this.filters(), { column: col, value }];
    this.filters.set(newFilters);
    this.filtersChange.emit(newFilters);

    // remove the column from future dropdowns
    this.columns = this.columns.filter((c) => c !== col);

    // reset UI
    this.selectedColumn.set(null);
    this.possibleValues.set([]);
  }

  removeFilter(f: FacetFilter) {
    const updated = this.filters().filter(
      (x) => !(x.column === f.column && x.value === f.value)
    );
    this.filters.set(updated);
    this.filtersChange.emit(updated);
  }

  showColumns() {
    return this.searchFocused() && !this.selectedColumn();
  }
}
