import { Component, signal, computed, OnInit, TemplateRef } from '@angular/core';
import { NgFor, NgTemplateOutlet } from '@angular/common';
import { FacetFilterComponent, Column, ActiveFilter } from './faceted-search/faceted-search.component';

@Component({
  selector: 'app-root',
  standalone: true,
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  imports: [NgFor, NgTemplateOutlet, FacetFilterComponent]
})
export class AppComponent implements OnInit {
  searchTpl!: TemplateRef<any>;
  pillsTpl!: TemplateRef<any>;

  columns: Column[] = [];

  basicSearch = signal('');
  activeFilters = signal<ActiveFilter[]>([]);

  //Show the preselected filters with chips and filtered table
  preSelectedFilters = [
    { map: 'status', label: 'Status', values: [{ key: 'active', value: 'Active' }] },
    { map: 'location', label: 'Location', values: [{ key: 'front', value: 'Front' }] }
  ];

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
          label: 'Enclosure',
          map: 'enclosure',
          type: 'select',
          options: [
            { key: 1, value: 'BP_PSV_0_1 Embedded controller in Slot 1' },
            { key: 2, value: 'BP_PSV_0_2 Extended controller in Slot 2' },
            { key: 3, value: 'BP_TNK_1' },
            { key: 4, value: 'BP_TNK_2 Embedded controller in Slot 2' },
            { key: 5, value: 'BP_PMP_3' },
            { key: 6, value: 'BP_VALVE_4' }
          ],
          preferred: false,
          mutuallyExclusive: ['status', 'location'],
          translate: true
        },
        {
          label: 'Type',
          map: 'type',
          type: 'select',
          options: [
            { key: 1, value: 'Embedded' },
            { key: 2, value: 'Integrated' }
          ],
          multi: true,
          translate: true
        },
        {
          label: 'Split Mode Capable',
          map: 'capable',
          type: 'select',
          options: [
            { key: 1, value: 'Capable' },
            { key: 2, value: 'Not-Capable' }
          ],
          multi: true,
          translate: true
        },
        {
          label: 'PCI Express Generation',
          map: 'PCIeGen',
          type: 'select',
          options: [
            { key: 1, value: 'Gen 3' },
            { key: 2, value: 'Gen 4' },
            { key: 3, value: 'Gen 5' },
            { key: 4, value: 'Gen 6' }
          ],
          multi: true,
          translate: true
        },
        { label: 'Description', map: 'description', type: 'text', preferred: false, translate: true },
        {
          label: 'Location',
          map: 'location',
          type: 'select',
          multi: true,
          options: [
            { key: 1, value: 'Front' },
            { key: 2, value: 'Back' }
          ],
          translate: true
        },
        { label: 'Last Updated', map: 'lastUpdated', type: 'text', preferred: false, translate: true },
        {
          label: 'Operator',
          map: 'operator',
          type: 'select',
          options: [
            { key: 1, value: 'Alice' },
            { key: 2, value: 'Bob' },
            { key: 3, value: 'Charlie' },
            { key: 4, value: 'Diana' }
          ],
          preferred: true,
          multi: true,
          translate: true
        },
        { label: 'Temperature (°C)', map: 'temperature', type: 'text', preferred: false, translate: true }
      ];

      this.columns = allColumns;
    }, 500);
  }

  fetchData() {
    this.data.set([
      {
        enclosure: 'BP_PSV_0_1',
        status: 'Active',
        description: 'Unit 1',
        lastUpdated: '2025-10-20',
        operator: 'Alice',
        temperature: '75',
        type: 'Embedded',
        capable: 'Capable',
        PCIeGen: 'Gen 3',
        location: 'Front'
      },
      {
        enclosure: 'BP_PSV_0_2',
        status: 'Inactive',
        description: 'Unit 2',
        lastUpdated: '2025-10-18',
        operator: 'Bob',
        temperature: '68',
        type: 'Integrated',
        capable: 'Not Capable',
        PCIeGen: 'Gen 4',
        location: 'Back'
      },
      {
        enclosure: 'BP_TNK_1',
        status: 'Active',
        description: 'Tank 1',
        lastUpdated: '2025-10-22',
        operator: 'Charlie',
        temperature: '82',
        type: 'Embedded',
        capable: 'Capable',
        PCIeGen: 'Gen 5',
        location: 'Front'
      },
      {
        enclosure: 'BP_TNK_2',
        status: 'Maintenance',
        description: 'Tank 2 under inspection',
        lastUpdated: '2025-10-19',
        operator: 'Diana',
        temperature: '60',
        type: 'Integrated',
        capable: 'Not Capable',
        PCIeGen: 'Gen 6',
        location: 'Back'
      },
      {
        enclosure: 'BP_PMP_3',
        status: 'Active',
        description: 'Pump 3 operational',
        lastUpdated: '2025-10-21',
        operator: 'Alice',
        temperature: '77',
        type: 'Embedded',
        capable: 'Capable',
        PCIeGen: 'Gen 3',
        location: 'Front'
      },
      {
        enclosure: 'BP_VALVE_4',
        status: 'Decommissioned',
        description: 'Valve 4 retired',
        lastUpdated: '2025-10-15',
        operator: 'Bob',
        temperature: 'N/A',
        type: 'Integrated',
        capable: 'Not Capable',
        PCIeGen: 'Gen 4',
        location: 'Back'
      },
      {
        enclosure: 'BP_PSV_0_1',
        status: 'Maintenance',
        description: 'Unit 1 scheduled for service',
        lastUpdated: '2025-10-23',
        operator: 'Charlie',
        temperature: '70',
        type: 'Embedded',
        capable: 'Capable',
        PCIeGen: 'Gen 5',
        location: 'Front'
      },
      {
        enclosure: 'BP_TNK_2',
        status: 'Inactive',
        description: 'Tank 2 offline',
        lastUpdated: '2025-10-17',
        operator: 'Diana',
        temperature: '65',
        type: 'Integrated',
        capable: 'Not Capable',
        PCIeGen: 'Gen 6',
        location: 'Back'
      },
      {
        enclosure: 'BP_PMP_3',
        status: 'Active',
        description: 'Pump 3 running at full capacity',
        lastUpdated: '2025-10-24',
        operator: 'Alice',
        temperature: '80',
        type: 'Embedded',
        capable: 'Capable',
        PCIeGen: 'Gen 3',
        location: 'Front'
      },
      {
        enclosure: 'BP_VALVE_4',
        status: 'Active',
        description: 'Valve 4 reactivated',
        lastUpdated: '2025-10-16',
        operator: 'Bob',
        temperature: '72',
        type: 'Integrated',
        capable: 'Not Capable',
        PCIeGen: 'Gen 4',
        location: 'Back'
      }
    ]);
  }

  // --- Helpers ---
  // Clean: To reorder the columns based on the preferredKeys array. Not using this now
  reorderColumns(cols: Column[]): Column[] {
    const preferred: Column[] = [];
    const remaining: Column[] = [];

    this.preferredKeys.forEach(key => {
      const match = cols.find(c => c.map === key);
      if (match) preferred.push(match);
    });

    remaining.push(...cols.filter(c => !this.preferredKeys.includes(c.map)));

    return [...preferred, ...remaining];
  }

  onBasicSearch(term: string) {
    this.basicSearch.set(term);
  }

  filteredData = computed(() => {
    //basic search
    const search = this.basicSearch().trim().toLowerCase();
    if (search) {
      return this.data().filter(row => Object.values(row).some(v => v?.toString().toLowerCase().includes(search)));
    }

    //For advanced search
    const filters = this.activeFilters();
    const grouped = filters.reduce((map, f) => {
      for (const v of f.values) {
        (map[f.map] ??= []).push(v.value.toLowerCase());
      }
      return map;
    }, {} as Record<string, string[]>);

    return this.data().filter(row =>
      Object.entries(grouped).every(([key, values]) => {
        const col = this.columns.find(c => c.map === key);
        const cellValue = (row as any)[key]?.toString().toLowerCase();
        if (!cellValue) return false;

        if (col?.type === 'select') {
          // OR-match for any of the select values
          return values.includes(cellValue);
        } else {
          // Match if any of the values is included
          return values.some(v => cellValue.includes(v));
        }
      })
    );
  });

  // Clean: Show the values dynamically base on the column selection with respect to available entries in the table. Not using this now
  getColumnValues(colKey: string, searchTerm: string) {
    return this.data()
      .map(row => row[colKey as keyof typeof row])
      .filter((v, i, arr) => v && arr.indexOf(v) === i)
      .filter(v => v.toLowerCase().includes(searchTerm.toLowerCase()));
  }
}
