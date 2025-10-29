import { Component, signal, computed, OnInit } from '@angular/core';
import { NgFor } from '@angular/common';
import { FacetFilterComponent, Column } from './faceted-search/faceted-search.component';

@Component({
  selector: 'app-root',
  standalone: true,
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  imports: [NgFor, FacetFilterComponent],
})
export class AppComponent implements OnInit {
  // --- Signals ---
  columns = signal<Column[]>([]);

  basicSearch = signal('');
  activeFilters = signal<{ label: string; key: string; value: string }[]>([]);

  data = signal<any[]>([]);

  // Clean: Preferred column keys. Not using this now
  preferredKeys = ['enclosure', 'status', 'location'];

  // --- Lifecycle ---
  ngOnInit() {
    this.fetchColumns();
    this.fetchData();
  }

  // --- Data setup ---
  fetchColumns() {
    setTimeout(() => {
      const allColumns: Column[] = [
        {
          key: 'enclosure',
          label: 'Enclosure',
          type: 'select',
          values: ['BP_PSV_0_1', 'BP_PSV_0_2', 'BP_TNK_1', 'BP_TNK_2', 'BP_PMP_3', 'BP_VALVE_4'],
          preferred: false,
          mutuallyExclusive: ['status', 'location'],
        },
        {
          key: 'status',
          label: 'Status',
          type: 'select',
          values: ['Active', 'Inactive', 'Maintenance', 'Decommissioned'],
          preferred: true,
          mutuallyExclusive: ['enclosure', 'location'],
          multi: true,
        },
        { key: 'description', label: 'Description', type: 'text', preferred: false },
        {
          key: 'location',
          label: 'Location',
          type: 'select',
          values: [],
          preferred: true,
          multi: true,
          mutuallyExclusive: ['status'],
        },
        { key: 'lastUpdated', label: 'Last Updated', type: 'text', preferred: false },
        {
          key: 'operator',
          label: 'Operator',
          type: 'select',
          values: ['Alice', 'Bob', 'Charlie', 'Diana'],
          preferred: true,
          multi: true,
        },
        { key: 'temperature', label: 'Temperature (°C)', type: 'text', preferred: false },
      ];

      this.columns.set(allColumns);
    }, 500);
  }

  fetchData() {
    this.data.set([
      {
        enclosure: 'BP_PSV_0_1',
        status: 'Active',
        description: 'Unit 1',
        location: 'Zone A',
        lastUpdated: '2025-10-20',
        operator: 'Alice',
        temperature: '75',
      },
      {
        enclosure: 'BP_PSV_0_2',
        status: 'Inactive',
        description: 'Unit 2',
        location: 'Zone B',
        lastUpdated: '2025-10-18',
        operator: 'Bob',
        temperature: '68',
      },
      {
        enclosure: 'BP_TNK_1',
        status: 'Active',
        description: 'Tank 1',
        location: 'Zone C',
        lastUpdated: '2025-10-22',
        operator: 'Charlie',
        temperature: '82',
      },
      {
        enclosure: 'BP_TNK_2',
        status: 'Maintenance',
        description: 'Tank 2 under inspection',
        location: 'Zone D',
        lastUpdated: '2025-10-19',
        operator: 'Diana',
        temperature: '60',
      },
      {
        enclosure: 'BP_PMP_3',
        status: 'Active',
        description: 'Pump 3 operational',
        location: 'Zone A',
        lastUpdated: '2025-10-21',
        operator: 'Alice',
        temperature: '77',
      },
      {
        enclosure: 'BP_VALVE_4',
        status: 'Decommissioned',
        description: 'Valve 4 retired',
        location: 'Zone B',
        lastUpdated: '2025-10-15',
        operator: 'Bob',
        temperature: 'N/A',
      },
      {
        enclosure: 'BP_PSV_0_1',
        status: 'Maintenance',
        description: 'Unit 1 scheduled for service',
        location: 'Zone C',
        lastUpdated: '2025-10-23',
        operator: 'Charlie',
        temperature: '70',
      },
      {
        enclosure: 'BP_TNK_2',
        status: 'Inactive',
        description: 'Tank 2 offline',
        location: 'Zone D',
        lastUpdated: '2025-10-17',
        operator: 'Diana',
        temperature: '65',
      },
      {
        enclosure: 'BP_PMP_3',
        status: 'Active',
        description: 'Pump 3 running at full capacity',
        location: 'Zone A',
        lastUpdated: '2025-10-24',
        operator: 'Alice',
        temperature: '80',
      },
      {
        enclosure: 'BP_VALVE_4',
        status: 'Active',
        description: 'Valve 4 reactivated',
        location: 'Zone B',
        lastUpdated: '2025-10-16',
        operator: 'Bob',
        temperature: '72',
      },
    ]);
  }

  // --- Derived signals ---
  availableColumns = computed(() => {
    return this.columns();
  });

  // --- Helpers ---
  // Clean: To reorder the columns based on the preferredKeys array. Not using this now
  reorderColumns(cols: Column[]): Column[] {
    const preferred: Column[] = [];
    const remaining: Column[] = [];

    this.preferredKeys.forEach((key) => {
      const match = cols.find((c) => c.key === key);
      if (match) preferred.push(match);
    });

    remaining.push(...cols.filter((c) => !this.preferredKeys.includes(c.key)));

    return [...preferred, ...remaining];
  }

  onBasicSearch(term: string) {
    this.basicSearch.set(term);
  }

  filteredData = computed(() => {
    //basic search
    const search = this.basicSearch().trim().toLowerCase();
    if (search) {
      return this.data().filter((row) => Object.values(row).some((v) => v?.toString().toLowerCase().includes(search)));
    }

    const filters = this.activeFilters();
    const grouped = filters.reduce((map, f) => {
      (map[f.key] ??= []).push(f.value.toLowerCase());
      return map;
    }, {} as Record<string, string[]>);

    return this.data().filter((row) =>
      Object.entries(grouped).every(([key, values]) => {
        const col = this.columns().find((c) => c.key === key);
        const cellValue = (row as any)[key]?.toString().toLowerCase();
        if (!cellValue) return false;

        if (col?.type === 'select') {
          // OR-match for any of the select values
          return values.includes(cellValue);
        } else {
          // Match if any of the values is included
          return values.some((v) => cellValue.includes(v));
        }
      })
    );
  });

  // Clean: Show the values dynamically base on the column selection with respect to available entries in the table. Not using this now
  getColumnValues(colKey: string, searchTerm: string) {
    return this.data()
      .map((row) => row[colKey as keyof typeof row])
      .filter((v, i, arr) => v && arr.indexOf(v) === i)
      .filter((v) => v.toLowerCase().includes(searchTerm.toLowerCase()));
  }
}
