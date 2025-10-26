import { Component, signal, computed } from '@angular/core';
import { NgFor } from '@angular/common';
import { FacetFilterComponent, Column } from './faceted-search/faceted-search.component';

@Component({
  selector: 'app-root',
  standalone: true,
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  imports: [NgFor, FacetFilterComponent],
})
export class AppComponent {
  columns: Column[] = [
    { key: 'enclosure', label: 'Enclosure', type: 'select', values: ['BP_PSV_0_1', 'BP_PSV_0_2', 'BP_TNK_1'] },
    { key: 'status', label: 'Status', type: 'select', values: ['Active', 'Inactive'] },
    { key: 'description', label: 'Description', type: 'text' },
  ];

  data = signal([
    { enclosure: 'BP_PSV_0_1', status: 'Active', description: 'Unit 1' },
    { enclosure: 'BP_PSV_0_2', status: 'Inactive', description: 'Unit 2' },
    { enclosure: 'BP_TNK_1', status: 'Active', description: 'Tank 1' },
  ]);

  activeFilters = signal<Record<string, string>>({});

  filteredData = computed(() => {
    const filters = this.activeFilters();
    return this.data().filter((row) =>
      Object.entries(filters).every(([key, val]) =>
        (row as any)[key]?.toString().toLowerCase().includes(val.toLowerCase())
      )
    );
  });

  getColumnValues(colKey: string, searchTerm: string) {
    // Optional dynamic values provider
    return this.data()
      .map((row) => row[colKey as keyof typeof row])
      .filter((v, i, arr) => v && arr.indexOf(v) === i)
      .filter((v) => v.toLowerCase().includes(searchTerm.toLowerCase()));
  }
}
